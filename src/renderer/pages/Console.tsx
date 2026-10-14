/**
 * Live console: virtualised (only visible rows render), reads straight from the ring buffer, filters computed with
 * useDeferredValue so typing never blocks. Handles 20k+ lines and 1k lines/s.
 */
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDownToLine, Copy, Eraser, FileText, Search, Share2, WrapText } from 'lucide-react';
import type { LogLevel, LogLine } from '@shared/types';
import { call } from '../lib/ipc';
import { cn } from '../lib/util';
import { useLogs } from '../stores/logs';
import { useLaunch } from '../stores/launch';
import { useInstances } from '../hooks/queries';
import { attempt, toast } from '../stores/toasts';
import { CrashBanner } from '../components/CrashBanner';
import { IconButton, Input, Segmented } from '../components/ui/core';
import { Select } from '../components/ui/overlay';

type Level = 'all' | 'warn' | 'error';
const RANK: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, SUCCESS: 1, WARN: 2, ERROR: 3 };
const COLOR: Record<LogLevel, string> = { DEBUG: 'text-t3', INFO: 'text-t2', SUCCESS: 'text-success', WARN: 'text-warning', ERROR: 'text-danger' };
const GUTTER: Record<LogLevel, string> = { DEBUG: 'bg-t3/40', INFO: 'bg-bg4', SUCCESS: 'bg-success', WARN: 'bg-warning', ERROR: 'bg-danger' };

const Row = memo(function Row({ line, wrap }: { line: LogLine; wrap: boolean }) {
  const t = new Date(line.ts);
  return (
    <div className="flex gap-2 px-3 font-mono text-[12.5px] leading-[20px] hover:bg-bg2">
      <span className={cn('w-[3px] shrink-0 rounded-full my-[3px]', GUTTER[line.level])} />
      <span className="text-t3 shrink-0 tnum">{t.toLocaleTimeString([], { hour12: false })}</span>
      <span className={cn('flex-1 min-w-0 selectable', COLOR[line.level], wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre truncate', line.src === 'launcher' && 'italic')}>{line.msg}</span>
    </div>
  );
});

export default function Console() {
  const { ring, version, clear } = useLogs();
  const { data: instances = [] } = useInstances();
  const states = useLaunch((s) => s.states);
  const [level, setLevel] = useState<Level>('all');
  const [text, setText] = useState('');
  const [instance, setInstance] = useState('');
  const [wrap, setWrap] = useState(false);
  const [follow, setFollow] = useState(true);
  const dq = useDeferredValue(text.toLowerCase());
  const scroller = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    const min = level === 'all' ? 0 : level === 'warn' ? 2 : 3;
    const out: LogLine[] = [];
    for (let i = 0; i < ring.size; i++) {
      const l = ring.at(i);
      if (RANK[l.level] < min) continue;
      if (instance && l.instanceId !== instance) continue;
      if (dq && !l.msg.toLowerCase().includes(dq)) continue;
      out.push(l);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ring, version, level, dq, instance]);

  const virt = useVirtualizer({ count: lines.length, getScrollElement: () => scroller.current, estimateSize: () => 20, overscan: 30 });
  useEffect(() => {
    if (follow && lines.length) virt.scrollToIndex(lines.length - 1, { align: 'end' });
  }, [lines.length, follow, virt]);

  const crashed = Object.values(states).find((s) => s.status === 'crashed' && s.crash && (!instance || s.instanceId === instance));
  const running = Object.values(states).filter((s) => s.status === 'running').length;
  const asText = () => lines.map((l) => `[${new Date(l.ts).toISOString()}] [${l.level}] ${l.msg}`).join('\n');

  return (
    <div className="h-full flex flex-col p-6 gap-3">
      <div className="flex items-center gap-3">
        <h1 className="font-pixel text-xl">Console</h1>
        <span className={cn('text-xs inline-flex items-center gap-1.5', running ? 'text-success' : 'text-t3')}>
          <span className={cn('w-2 h-2 rounded-full', running ? 'bg-success' : 'bg-t3/50')} />
          {running ? `${running} game${running > 1 ? 's' : ''} running` : 'No game running'}
        </span>
      </div>
      {crashed && <CrashBanner state={crashed} />}
      <div className="flex flex-wrap items-center gap-2">
        <Segmented size="sm" value={level} onChange={setLevel} options={[{ value: 'all', label: 'All' }, { value: 'warn', label: 'Warnings' }, { value: 'error', label: 'Errors' }]} />
        <Select label="Profile" className="w-48 !h-9" value={instance} onChange={setInstance} options={[{ value: '', label: 'All profiles' }, ...instances.map((i) => ({ value: i.id, label: i.name }))]} />
        <Input className="w-64 !h-9" icon={Search} value={text} onChange={(e) => setText(e.target.value)} placeholder="Search log" right={dq ? <span className="text-2xs text-t3 tnum">{lines.length}</span> : undefined} />
        <div className="flex-1" />
        <IconButton icon={WrapText} label="Wrap lines" active={wrap} onClick={() => setWrap((w) => !w)} />
        <IconButton icon={ArrowDownToLine} label="Auto-scroll" active={follow} onClick={() => setFollow((f) => !f)} />
        <IconButton icon={Copy} label="Copy visible log" onClick={() => { void call('app:copy', asText()); toast.success(`Copied ${lines.length} lines`); }} />
        <IconButton icon={Share2} label="Upload to mclo.gs" onClick={async () => {
          const url = await attempt(() => call('app:upload-log', asText()), 'Upload failed');
          if (url) {
            void call('app:copy', url);
            toast.success('Log uploaded — link copied', url, { label: 'Open', run: () => void call('app:open-external', url) });
          }
        }} />
        <IconButton icon={FileText} label="Open logs folder" onClick={() => void (instance ? call('instances:open-folder', instance, 'logs') : call('app:open-logs'))} />
        <IconButton icon={Eraser} label="Clear console" onClick={clear} />
      </div>
      <div
        ref={scroller}
        className="flex-1 min-h-0 overflow-auto rounded-lg border border-line bg-[#080405] py-2"
        onWheel={(e) => e.deltaY < 0 && follow && setFollow(false)}
        data-testid="console"
      >
        {lines.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-t3">{ring.size ? 'No lines match the filter.' : 'Launch a profile to see its log here.'}</div>
        ) : (
          <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
            {virt.getVirtualItems().map((v) => (
              <div key={v.key} data-index={v.index} ref={wrap ? virt.measureElement : undefined} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${v.start}px)` }}>
                <Row line={lines[v.index]} wrap={wrap} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
