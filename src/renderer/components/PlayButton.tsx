/**
 * PLAY button that morphs into a same-size progress bar while preparing, then a "Playing · 12:41" + Stop state.
 * Subscribes only to its own profile's launch state, so download progress re-renders nothing else.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, Loader2, Play, Square } from 'lucide-react';
import type { InstanceSummary } from '@shared/types';
import { call } from '../lib/ipc';
import { cn, formatBytes, formatDuration, loaderName } from '../lib/util';
import { isActive, useLaunch } from '../stores/launch';
import { attempt } from '../stores/toasts';
import { useUi } from '../stores/ui';
import { Menu } from './ui/overlay';
import { useSettings } from '../stores/settings';

function useNow(active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function PlayButton({ instance, instances, compact }: { instance: InstanceSummary; instances?: InstanceSummary[]; compact?: boolean }) {
  const state = useLaunch((s) => s.states[instance.id]);
  const active = isActive(state);
  const running = state?.status === 'running';
  const now = useNow(running);
  const height = compact ? 'h-12' : 'h-16';
  const width = compact ? 'w-[220px]' : 'w-[300px]';

  const start = () => void attempt(() => call('launch:start', instance.id), 'Could not start Minecraft');
  const stop = () => void call('launch:cancel', instance.id);

  if (active && !running && state) {
    const pct = Math.round(state.progress * 100);
    const detail =
      state.status === 'downloading' && state.filesTotal
        ? `${state.filesDone.toLocaleString()} / ${state.filesTotal.toLocaleString()}${state.speedBps > 0 ? ` · ${formatBytes(state.speedBps)}/s` : ''}${state.etaSec > 0 ? ` · ${formatDuration(state.etaSec)} left` : ''}`
        : state.phase;
    return (
      <div className="flex items-center gap-3" data-testid="play-progress">
        <div className={cn('relative overflow-hidden rounded-lg bg-bg2 border border-line-strong flex flex-col justify-center px-5', height, width)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={state.phase}>
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-accent-lo/70 to-accent/60 transition-[width] duration-3 ease-out" style={{ width: `${Math.max(3, pct)}%` }} />
          <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent" style={{ animation: 'progress-sheen 1.8s linear infinite' }} />
          <div className="relative flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-t1 truncate flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />{state.phase}</div>
              {!compact && <div className="text-2xs text-t2 tnum truncate mt-0.5">{detail}</div>}
            </div>
            <span className="font-pixel text-md text-white tnum">{pct}%</span>
          </div>
        </div>
        <button type="button" onClick={stop} className="text-sm font-semibold text-t2 hover:text-danger">
          Cancel
        </button>
      </div>
    );
  }

  if (running && state) {
    return (
      <div className="flex items-center gap-3" data-testid="play-running">
        <div className={cn('rounded-lg bg-success/10 border border-success/30 flex items-center gap-3 px-5', height, width)}>
          <span className="w-2.5 h-2.5 rounded-full bg-success" style={{ animation: 'glow-pulse 2s infinite' }} />
          <div>
            <div className="text-sm font-semibold text-t1">Playing</div>
            <div className="text-2xs text-t2 tnum">{formatDuration((now - (state.runningSince ?? state.startedAt)) / 1000)}</div>
          </div>
        </div>
        <button type="button" onClick={stop} className="h-10 px-4 rounded-md border border-line-strong text-sm font-semibold text-t2 hover:text-danger hover:border-danger/50 inline-flex items-center gap-2">
          <Square className="w-3.5 h-3.5" /> Stop
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-stretch">
      <button
        type="button"
        data-testid="play"
        onClick={start}
        className={cn(
          'group relative rounded-l-lg font-pixel text-white tracking-[0.2em] flex items-center justify-center gap-3 border border-white/10 transition duration-2 active:scale-[0.98] overflow-hidden',
          'bg-gradient-to-b from-accent-hi via-accent to-accent-lo hover:shadow-glow',
          height,
          width,
          compact ? 'text-md' : 'text-lg',
          !instances?.length && 'rounded-r-lg',
        )}
      >
        <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
        <Play className={compact ? 'w-4 h-4' : 'w-5 h-5'} fill="currentColor" />
        PLAY
      </button>
      {instances && instances.length > 0 && (
        <Menu
          align="left"
          width={300}
          trigger={({ toggle }) => (
            <button type="button" aria-label="Choose profile" onClick={toggle} className={cn('rounded-r-lg border border-l-0 border-white/10 bg-accent-lo hover:bg-accent text-white grid place-items-center transition', height, compact ? 'w-12' : 'w-16')}>
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
          items={[
            ...instances.map((i) => ({
              label: i.name,
              hint: `${loaderName(i.loader)} ${i.version}`,
              onSelect: () => void useSettings.getState().patch({ selectedInstanceId: i.id }),
            })),
            'sep' as const,
            { label: 'New profile…', onSelect: () => useUi.getState().set({ newProfile: true }) },
          ]}
        />
      )}
    </div>
  );
}
