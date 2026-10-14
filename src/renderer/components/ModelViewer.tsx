/** skinview3d viewer. Imported lazily (three.js is the largest dependency) — only the Wardrobe page loads it. */
import { useEffect, useRef, useState } from 'react';
import { IdleAnimation, SkinViewer, WalkingAnimation, WaveAnimation } from 'skinview3d';
import { asset } from '../lib/util';
import { Spinner } from './ui/core';

export interface ModelViewerProps {
  skinUrl?: string;
  capeUrl?: string;
  slim?: boolean;
  animation: 'idle' | 'walk' | 'wave';
  back?: boolean;
  size?: number;
}

export default function ModelViewer({ skinUrl, capeUrl, slim, animation, back, size = 420 }: ModelViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<SkinViewer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!host.current) return;
    const canvas = document.createElement('canvas');
    host.current.appendChild(canvas);
    const v = new SkinViewer({ canvas, width: size, height: size, zoom: 0.8, fov: 50 });
    v.controls.enablePan = false;
    v.autoRotate = false;
    viewer.current = v;
    return () => {
      v.dispose();
      canvas.remove();
      viewer.current = null;
    };
  }, [size]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    setLoading(true);
    v.loadSkin(skinUrl ?? asset('skins/default.png'), { model: slim ? 'slim' : 'default' })
      .catch(() => v.loadSkin(asset('skins/default.png')))
      .finally(() => setLoading(false));
  }, [skinUrl, slim]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    if (capeUrl) void v.loadCape(capeUrl).catch(() => v.resetCape());
    else v.resetCape();
  }, [capeUrl]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.animation = animation === 'walk' ? new WalkingAnimation() : animation === 'wave' ? new WaveAnimation() : new IdleAnimation();
  }, [animation]);

  useEffect(() => {
    const v = viewer.current;
    if (!v) return;
    v.playerObject.rotation.y = back ? Math.PI : 0;
  }, [back]);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div ref={host} className="absolute inset-0" />
      {loading && <div className="absolute inset-0 grid place-items-center"><Spinner /></div>}
    </div>
  );
}
