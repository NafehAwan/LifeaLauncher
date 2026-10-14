/** 2D player head cropped from the skin with CSS (no three.js on the always-visible rail). */
import { memo } from 'react';
import { asset, cn } from '../lib/util';

export const SkinHead = memo(function SkinHead({ skinUrl, size = 32, className }: { skinUrl?: string; size?: number; className?: string }) {
  const url = skinUrl ?? asset('skins/default.png');
  const layer = (x: number, y: number) => ({
    backgroundImage: `url("${url}")`,
    backgroundSize: `${size * 8}px auto`,
    backgroundPosition: `-${x * size}px -${y * size}px`,
  });
  return (
    <div className={cn('relative shrink-0 rounded-md overflow-hidden pixelated bg-bg3', className)} style={{ width: size, height: size }} aria-hidden>
      <div className="absolute inset-0 pixelated" style={layer(1, 1)} />
      <div className="absolute inset-0 pixelated" style={layer(5, 1)} />
    </div>
  );
});
