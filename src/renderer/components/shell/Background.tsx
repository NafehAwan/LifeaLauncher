/**
 * Animated parallax scene behind Home. Performance rules:
 *  - WebP layers decoded once via createImageBitmap, pre-scaled to the canvas on resize (one drawImage per layer)
 *  - 30 fps accumulator; the loop STOPS (no rAF at all) when hidden, blurred >10 s, game running, or reduced motion
 *  - parallax input sampled once per frame; preallocated particle pool; DPR capped at 2
 * Theme IDs come from shared constants, so settings and folders can never disagree again (P1-1).
 */
import { memo, useEffect, useRef } from 'react';
import { THEMES } from '@shared/constants';
import type { ThemeId } from '@shared/types';
import { asset } from '../../lib/util';

export type CharacterAnim = 'idle' | 'wave' | 'walk' | 'dance';

const PARAMS: Record<string, { drift: number; parallax: number }> = {
  sky: { drift: 0, parallax: 0 },
  clouds: { drift: 7, parallax: 3 },
  dunes_far: { drift: 0, parallax: 6 },
  dunes_near: { drift: 0, parallax: 12 },
  cacti: { drift: 0, parallax: 20 },
  embers: { drift: 10, parallax: 16 },
};

async function loadBitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

export const Background = memo(function Background({ theme, animate, particles, speed, character, paused }: { theme: ThemeId; animate: boolean; particles: boolean; speed: number; character: CharacterAnim; paused: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ animate, particles, speed, paused, character });
  stateRef.current = { animate, particles, speed, paused, character };
  const kick = useRef<() => void>(() => undefined);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    const def = THEMES.find((t) => t.id === theme) ?? THEMES[0];
    let disposed = false;
    let raf = 0;
    let running = false;
    let last = 0;
    let acc = 0;
    let t = 0;
    let w = 0;
    let h = 0;
    let blurredAt = 0;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
    const layers: { name: string; bmp: ImageBitmap; scaled?: HTMLCanvasElement | OffscreenCanvas; sw: number }[] = [];
    const frames: Record<string, ImageBitmap[]> = {};
    const POOL = 120;
    const px = new Float32Array(POOL);
    const py = new Float32Array(POOL);
    const pv = new Float32Array(POOL);
    let alive = 0;

    const scaleLayers = () => {
      for (const l of layers) {
        const s = h / l.bmp.height;
        const sw = Math.ceil(l.bmp.width * s);
        const off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(sw, h) : Object.assign(document.createElement('canvas'), { width: sw, height: h });
        const o = off.getContext('2d') as CanvasRenderingContext2D | null;
        if (!o) continue;
        o.imageSmoothingEnabled = false;
        o.drawImage(l.bmp, 0, 0, sw, h);
        l.scaled = off;
        l.sw = sw;
      }
    };

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, Math.round(rect.width * dpr));
      h = Math.max(1, Math.round(rect.height * dpr));
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = false;
      scaleLayers();
      draw();
    };

    const draw = () => {
      ctx.fillStyle = '#0b0607';
      ctx.fillRect(0, 0, w, h);
      for (const l of layers) {
        if (!l.scaled) continue;
        const p = PARAMS[l.name] ?? { drift: 0, parallax: 0 };
        const ox = -p.parallax * (mouse.x - 0.5) * 2 * (h / 720);
        const oy = -p.parallax * 0.4 * (mouse.y - 0.5) * 2 * (h / 720);
        if (p.drift) {
          const off = ((t * p.drift * (h / 720)) % l.sw + l.sw) % l.sw;
          for (let x = -off + ox - l.sw; x < w; x += l.sw) ctx.drawImage(l.scaled, Math.round(x), Math.round(oy));
        } else {
          const x = (w - l.sw) / 2 + ox;
          if (l.sw >= w) ctx.drawImage(l.scaled, Math.round(x), Math.round(oy));
          else for (let xx = x % l.sw - l.sw; xx < w; xx += l.sw) ctx.drawImage(l.scaled, Math.round(xx), Math.round(oy));
        }
      }
      const s = stateRef.current;
      const anim = frames[s.character];
      if (anim?.length) {
        const f = anim[Math.floor(t * 4) % anim.length];
        const size = Math.round(h * 0.16);
        ctx.drawImage(f, Math.round(w * 0.78), Math.round(h * 0.8 - size), size, size);
      }
      if (s.particles && alive) {
        ctx.fillStyle = 'rgba(255, 106, 43, 0.55)';
        const unit = Math.max(1, Math.round(h / 480));
        for (let i = 0; i < alive; i++) ctx.fillRect(px[i] | 0, py[i] | 0, unit * pv[i], unit * pv[i]);
      }
    };

    const step = (dt: number) => {
      const s = stateRef.current;
      t += dt * (s.speed / 100);
      mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 6);
      mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 6);
      if (s.particles) {
        if (alive < POOL && Math.random() < dt * 30) {
          px[alive] = -4;
          py[alive] = Math.random() * h;
          pv[alive] = Math.random() < 0.7 ? 1 : 2;
          alive++;
        }
        const v = (h / 720) * 60 * dt * (s.speed / 100);
        for (let i = alive - 1; i >= 0; i--) {
          px[i] += v * (1.2 + pv[i]);
          py[i] -= v * 0.15;
          if (px[i] > w + 4 || py[i] < -4) {
            alive--;
            px[i] = px[alive];
            py[i] = py[alive];
            pv[i] = pv[alive];
          }
        }
      } else alive = 0;
    };

    const shouldRun = () => {
      const s = stateRef.current;
      if (!s.animate || s.paused || document.visibilityState === 'hidden') return false;
      if (blurredAt && Date.now() - blurredAt > 10_000) return false;
      return true;
    };

    const loop = (now: number) => {
      if (disposed) return;
      if (!shouldRun()) {
        running = false;
        return;
      }
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc >= 1 / 30) {
        step(acc);
        acc = 0;
        draw();
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || disposed || !shouldRun()) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    kick.current = () => {
      start();
      if (!running) draw();
    };

    const onMove = (e: MouseEvent) => {
      mouse.tx = e.clientX / window.innerWidth;
      mouse.ty = e.clientY / window.innerHeight;
    };
    const onVis = () => start();
    const onBlur = () => (blurredAt = Date.now());
    const onFocus = () => {
      blurredAt = 0;
      start();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);

    void (async () => {
      const bmps = await Promise.all(def.layers.map((n) => loadBitmap(asset(`scenes/${def.id}/${n}.webp`))));
      for (const anim of ['idle', 'wave', 'walk', 'dance']) {
        const f = await Promise.all([0, 1, 2, 3].map((i) => loadBitmap(asset(`sprites/character/${anim}_${i}.webp`))));
        frames[anim] = f.filter((b): b is ImageBitmap => !!b);
      }
      if (disposed) return;
      def.layers.forEach((name, i) => {
        const bmp = bmps[i];
        if (bmp) layers.push({ name, bmp, sw: bmp.width });
      });
      resize();
      canvas.dataset.ready = String(layers.length);
      start();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      layers.forEach((l) => l.bmp.close());
      Object.values(frames).flat().forEach((b) => b.close());
    };
  }, [theme]);

  // Restart / redraw when toggles change without rebuilding the scene.
  useEffect(() => kick.current(), [animate, particles, speed, paused, character]);

  return <canvas ref={ref} data-testid="background" data-theme={theme} className="absolute inset-0 w-full h-full pixelated" aria-hidden />;
});
