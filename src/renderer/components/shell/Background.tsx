/**
 * Parallax scene behind Home, built for near-zero idle cost:
 *  - every layer is its own GPU-composited element; parallax is a transform updated only when the mouse moves
 *  - clouds drift with a compositor-only CSS animation; the character is a 4-frame sprite sheet with steps()
 *  - embers are the only JS animation: a half-resolution canvas at 20 fps with a preallocated pool
 *  - everything pauses (CSS play-state + no rAF) when hidden, blurred > 10 s, the game is running, or reduced motion
 *  - "lite" mode (no GPU compositing: VMs, RDP, old drivers) keeps the look but drops drift and embers, which are
 *    cheap on a GPU but cost a whole CPU core in software compositing
 * Theme IDs come from shared constants, so settings and asset folders can never disagree (P1-1).
 */
import { memo, useEffect, useRef, useState } from 'react';
import { THEMES } from '@shared/constants';
import type { ThemeId } from '@shared/types';
import { asset, cn } from '../../lib/util';

export type CharacterAnim = 'idle' | 'wave' | 'walk' | 'dance';

const PARALLAX: Record<string, number> = { sky: 0, clouds: 3, dunes_far: 6, dunes_near: 12, cacti: 20, embers: 16 };

function useScenePaused(paused: boolean, animate: boolean) {
  const [idle, setIdle] = useState(document.visibilityState === 'hidden');
  useEffect(() => {
    let blurTimer: ReturnType<typeof setTimeout> | undefined;
    const onVis = () => setIdle(document.visibilityState === 'hidden');
    const onBlur = () => (blurTimer = setTimeout(() => setIdle(true), 10_000));
    const onFocus = () => {
      clearTimeout(blurTimer);
      setIdle(document.visibilityState === 'hidden');
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  return paused || !animate || idle;
}

function Embers({ running }: { running: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !running) return;
    const POOL = 90;
    const x = new Float32Array(POOL);
    const y = new Float32Array(POOL);
    const s = new Float32Array(POOL);
    let alive = 0;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width / 2));
      canvas.height = Math.max(1, Math.round(r.height / 2));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      acc += now - last;
      last = now;
      if (acc < 50) return; // 20 fps is plenty for drifting embers
      const dt = Math.min(0.2, acc / 1000);
      acc = 0;
      const w = canvas.width;
      const h = canvas.height;
      if (alive < POOL && Math.random() < dt * 14) {
        x[alive] = -2;
        y[alive] = h * (0.25 + Math.random() * 0.75);
        s[alive] = Math.random() < 0.75 ? 1 : 2;
        alive++;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255, 106, 43, 0.6)';
      const v = (h / 360) * 40 * dt;
      for (let i = alive - 1; i >= 0; i--) {
        x[i] += v * (1 + s[i]);
        y[i] -= v * 0.2;
        if (x[i] > w + 2 || y[i] < -2) {
          alive--;
          x[i] = x[alive];
          y[i] = y[alive];
          s[i] = s[alive];
          continue;
        }
        ctx.fillRect(x[i] | 0, y[i] | 0, s[i], s[i]);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [running]);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pixelated" aria-hidden />;
}

/** 4-frame sprite sheet moved by transform at 4 fps: the frame change is a compositor move, not a repaint. */
function Character({ anim, running }: { anim: CharacterAnim; running: boolean }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !running) return;
    let f = 0;
    const t = setInterval(() => {
      f = (f + 1) % 4;
      el.style.transform = `translate3d(${-25 * f}%, 0, 0)`;
    }, 250);
    return () => clearInterval(t);
  }, [running, anim]);
  return (
    <div className="scene-character">
      <img ref={ref} src={asset(`sprites/character/${anim}.webp`)} alt="" draggable={false} />
    </div>
  );
}

export const Background = memo(function Background({ theme, animate, particles, character, paused, lite }: { theme: ThemeId; animate: boolean; particles: boolean; character: CharacterAnim; paused: boolean; lite?: boolean }) {
  const def = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const root = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(0);
  const stopped = useScenePaused(paused, animate);

  // Preload + decode all layers before showing them (no pop-in), and report how many loaded.
  useEffect(() => {
    let cancelled = false;
    setReady(0);
    void Promise.all(
      def.layers.map(async (l) => {
        const img = new Image();
        img.src = asset(`scenes/${def.id}/${l}.webp`);
        try {
          await img.decode();
          return 1;
        } catch {
          return 0;
        }
      }),
    ).then((n) => !cancelled && setReady(n.reduce<number>((a, b) => a + b, 0)));
    return () => {
      cancelled = true;
    };
  }, [def]);

  // Parallax: one rAF-coalesced CSS variable update per mouse move; nothing runs while the mouse is still.
  useEffect(() => {
    const el = root.current;
    if (!el || stopped) return;
    let raf = 0;
    let tx = 0;
    let ty = 0;
    const onMove = (e: MouseEvent) => {
      tx = e.clientX / window.innerWidth - 0.5;
      ty = e.clientY / window.innerHeight - 0.5;
      if (!raf)
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.style.setProperty('--mx', tx.toFixed(3));
          el.style.setProperty('--my', ty.toFixed(3));
        });
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [stopped]);

  return (
    <div
      ref={root}
      data-testid="background"
      data-theme={theme}
      data-ready={ready}
      data-layers={def.layers.length}
      data-lite={lite ? '1' : '0'}
      className={cn('scene absolute inset-0 overflow-hidden bg-bg0', (stopped || lite) && 'scene-paused')}
      aria-hidden
    >
      {def.layers.map((l) => {
        const k = PARALLAX[l] ?? 0;
        const url = `url("${asset(`scenes/${def.id}/${l}.webp`)}")`;
        if (l === 'clouds' || l === 'embers') {
          return (
            <div key={l} className="scene-layer" style={{ transform: `translate3d(calc(var(--mx, 0) * ${-k * 2}px), calc(var(--my, 0) * ${-k * 0.8}px), 0)` }}>
              <div className="scene-drift" style={{ backgroundImage: url }} />
            </div>
          );
        }
        return <div key={l} className="scene-layer" style={{ backgroundImage: url, transform: k ? `translate3d(calc(var(--mx, 0) * ${-k * 2}px), calc(var(--my, 0) * ${-k * 0.8}px), 0)` : undefined }} />;
      })}
      {animate && <Character anim={character} running={!stopped && !lite} />}
      {particles && !lite && <Embers running={!stopped} />}
    </div>
  );
});
