/** Pixel-art profile icons drawn as crisp 8×8 SVGs — no network, no image files. */
import { memo } from 'react';
import { cn } from '../lib/util';

// Each icon: palette + 8 rows of 8 chars ('.' = transparent).
const ICONS: Record<string, { p: Record<string, string>; rows: string[] }> = {
  grass: { p: { g: '#5fbf3a', G: '#3f8f26', d: '#8b5a2b', D: '#6b4220' }, rows: ['gGgggGgg', 'ggGggggG', 'GdgdGdgd', 'dDddDddD', 'ddDdddDd', 'DddDdddd', 'dddddDdd', 'dDdddddD'] },
  diamond: { p: { a: '#9ff3ff', b: '#4fd6e8', c: '#1d9fb3', d: '#0f6b7a' }, rows: ['...aa...', '..abba..', '.abccba.', 'abccccba', '.bccccb.', '..bccb..', '...dd...', '........'] },
  sword: { p: { s: '#e6e6e6', S: '#a9a9a9', h: '#8b5a2b', g: '#e11d2e' }, rows: ['......ss', '.....ssS', '....ssS.', '...ssS..', 'g.ssS...', '.ggS....', '.hgg....', 'h..g....'] },
  pickaxe: { p: { c: '#4fd6e8', C: '#1d9fb3', h: '#8b5a2b', H: '#5e3b1a' }, rows: ['.cccccc.', 'cC.hh.Cc', 'c..hH..c', '...hH...', '...hH...', '...hH...', '...hH...', '...HH...'] },
  tnt: { p: { r: '#e11d2e', R: '#9b0f1c', w: '#f6eef0', k: '#222222', f: '#ffb020' }, rows: ['...ff...', 'rrrrrrrr', 'RrRrRrRr', 'wwwwwwww', 'wkwkwkkw', 'wwwwwwww', 'rRrRrRrR', 'RRRRRRRR'] },
  ender: { p: { a: '#1d6b5f', b: '#2fae94', c: '#0b2e29', k: '#000000' }, rows: ['..aaaa..', '.abbbba.', 'abbccbba', 'abckkcba', 'abckkcba', 'abbccbba', '.abbbba.', '..aaaa..'] },
  redstone: { p: { r: '#ff3b4a', R: '#9b0f1c', d: '#5a0a12' }, rows: ['........', '..r..r..', '.rRrrRr.', '..rRRr..', '.rRRRRr.', '..rRRr..', '.r.rr.r.', '...dd...'] },
  netherite: { p: { a: '#4a3d40', b: '#2b2224', c: '#6b5a5e', r: '#e11d2e' }, rows: ['aaaaaaaa', 'abbbbbba', 'abcbbcba', 'abbrrbba', 'abbrrbba', 'abcbbcba', 'abbbbbba', 'aaaaaaaa'] },
};

export const INSTANCE_ICON_IDS = Object.keys(ICONS);

export const InstanceIcon = memo(function InstanceIcon({ icon, size = 48, className }: { icon: string; size?: number; className?: string }) {
  const def = ICONS[icon] ?? ICONS.grass;
  const rects: JSX.Element[] = [];
  def.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = def.p[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />);
    }),
  );
  return (
    <div className={cn('grid place-items-center rounded-[12px] bg-bg1 border border-line-strong shrink-0', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 8 8" width={size * 0.62} height={size * 0.62} shapeRendering="crispEdges" aria-hidden>
        {rects}
      </svg>
    </div>
  );
});
