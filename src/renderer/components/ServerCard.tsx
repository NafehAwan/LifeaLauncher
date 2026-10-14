import { memo, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Users } from 'lucide-react';
import type { MotdSegment, ServerStatus } from '@shared/types';
import { call } from '../lib/ipc';
import { cn } from '../lib/util';
import { attempt } from '../stores/toasts';

export function Motd({ segments, className }: { segments?: MotdSegment[]; className?: string }) {
  if (!segments?.length) return null;
  return (
    <div className={cn('font-mono text-2xs leading-4 whitespace-pre-wrap break-words', className)}>
      {segments.map((s, i) => (
        <span
          key={i}
          style={{ color: s.color }}
          className={cn(s.bold && 'font-bold', s.italic && 'italic', s.underlined && 'underline', s.strikethrough && 'line-through', s.obfuscated && 'blur-[2px]')}
        >
          {s.text}
        </span>
      ))}
    </div>
  );
}

export function PingBars({ ms }: { ms?: number }) {
  const bars = ms === undefined ? 0 : ms < 80 ? 4 : ms < 150 ? 3 : ms < 300 ? 2 : 1;
  return (
    <span className="inline-flex items-end gap-[2px] h-3" title={ms !== undefined ? `${ms} ms` : 'Offline'}>
      {[1, 2, 3, 4].map((b) => (
        <span key={b} className={cn('w-[3px] rounded-sm', b <= bars ? (bars >= 3 ? 'bg-success' : bars === 2 ? 'bg-warning' : 'bg-danger') : 'bg-bg4')} style={{ height: `${b * 25}%` }} />
      ))}
    </span>
  );
}

/** Ping on view and every 60 s while visible. */
export function useServerStatus(address: string) {
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  useEffect(() => {
    const fn = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', fn);
    return () => document.removeEventListener('visibilitychange', fn);
  }, []);
  return useQuery<ServerStatus>({
    queryKey: ['ping', address],
    queryFn: () => call('servers:ping', address),
    staleTime: 55_000,
    refetchInterval: visible ? 60_000 : false,
  });
}

export const ServerCard = memo(function ServerCard({ name, address, instanceId, subtitle }: { name: string; address: string; instanceId?: string; subtitle?: string }) {
  const { data: st, isLoading } = useServerStatus(address);
  return (
    <div className="glass border border-line rounded-lg p-3 flex gap-3 items-center">
      <div className="w-11 h-11 rounded-md bg-bg3 border border-line-strong overflow-hidden shrink-0 grid place-items-center">
        {st?.favicon ? <img src={st.favicon} alt="" className="w-full h-full pixelated" /> : <span className="font-pixel text-xs text-t3">{name.slice(0, 2).toUpperCase()}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold truncate">{name}</span>
          {isLoading ? <span className="w-8 h-3 skeleton rounded" /> : <PingBars ms={st?.online ? st.pingMs : undefined} />}
        </div>
        {st?.online ? (
          <Motd segments={st.motd} className="line-clamp-2 text-t2" />
        ) : (
          <div className="text-2xs text-t3 truncate">{isLoading ? address : subtitle ?? (st?.error ? 'Offline' : address)}</div>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {st?.online && (
          <span className="text-2xs text-t3 tnum inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            {st.players?.online.toLocaleString()}/{st.players?.max.toLocaleString()}
          </span>
        )}
        {instanceId && (
          <button
            type="button"
            onClick={() => void attempt(() => call('launch:start', instanceId, { server: address }), 'Could not join')}
            className="h-7 px-2.5 rounded-md bg-accent-soft text-accent-hi text-xs font-semibold hover:bg-accent hover:text-white inline-flex items-center gap-1 transition"
          >
            <Play className="w-3 h-3" fill="currentColor" /> Join
          </button>
        )}
      </div>
    </div>
  );
});
