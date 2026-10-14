import { useEffect, useState } from 'react';
import { Copy, Download, Minus, Search, Square, X } from 'lucide-react';
import type { UpdaterState } from '@shared/types';
import { call, on } from '../../lib/ipc';
import { asset, cn } from '../../lib/util';
import { useLaunch } from '../../stores/launch';
import { useUi } from '../../stores/ui';
import { Kbd, Tooltip } from '../ui/core';
import { FriendsToggle } from './FriendsDrawer';

function DownloadRing() {
  const busy = useLaunch((s) => Object.values(s.states).filter((x) => x.status === 'downloading' || x.status === 'installing'));
  if (!busy.length) return null;
  const p = busy.reduce((a, b) => a + b.progress, 0) / busy.length;
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <Tooltip label={`${busy.length} download${busy.length > 1 ? 's' : ''} · ${Math.round(p * 100)}%`} side="bottom">
      <div className="no-drag relative w-7 h-7 grid place-items-center" aria-label="Downloads in progress">
        <svg width="24" height="24" viewBox="0 0 24 24" className="-rotate-90">
          <circle cx="12" cy="12" r={r} stroke="var(--bg-4)" strokeWidth="3" fill="none" />
          <circle cx="12" cy="12" r={r} stroke="var(--accent)" strokeWidth="3" fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - p)} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-3" />
        </svg>
        <Download className="absolute w-3 h-3 text-t2" />
      </div>
    </Tooltip>
  );
}

function UpdateButton() {
  const [state, setState] = useState<UpdaterState>({ status: 'idle' });
  useEffect(() => {
    void call('updater:state').then(setState);
    return on('updater:state', setState);
  }, []);
  if (state.status !== 'ready') return null;
  return (
    <button type="button" onClick={() => void call('updater:install')} className="no-drag h-7 px-3 rounded-md bg-success/15 text-success text-xs font-semibold hover:bg-success/25">
      Restart to update{state.version ? ` (${state.version})` : ''}
    </button>
  );
}

export function TitleBar() {
  const [max, setMax] = useState(false);
  const openPalette = () => useUi.getState().set({ palette: true });
  useEffect(() => {
    void call('window:is-maximized').then(setMax);
    return on('window:maximized', setMax);
  }, []);
  const isMac = navigator.userAgent.includes('Mac');
  return (
    <header className="drag h-10 shrink-0 flex items-center gap-3 pl-4 pr-1 bg-bg1 border-b border-line relative z-40">
      <div className={cn('flex items-center gap-2', isMac && 'pl-16')}>
        <img src={asset('icons/logo.svg')} alt="" className="w-5 h-5 pixelated" />
        <span className="font-pixel text-[13px] tracking-[0.2em] text-t1">LIFEA</span>
      </div>
      <div className="flex-1 flex justify-center">
        <button type="button" onClick={openPalette} className="no-drag h-7 w-[360px] max-w-[40vw] rounded-md bg-bg2 border border-line text-t3 text-xs flex items-center gap-2 px-2.5 hover:border-line-strong hover:text-t2 transition">
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Search profiles, pages, settings…</span>
          <Kbd>{isMac ? '⌘' : 'Ctrl'} K</Kbd>
        </button>
      </div>
      <div className="flex items-center gap-1">
        <UpdateButton />
        <DownloadRing />
        <FriendsToggle />
        {!isMac && (
          <div className="no-drag flex">
            <button type="button" aria-label="Minimize" className="w-11 h-9 grid place-items-center text-t2 hover:bg-bg3 hover:text-t1 rounded-md" onClick={() => void call('window:minimize')}>
              <Minus className="w-4 h-4" />
            </button>
            <button type="button" aria-label={max ? 'Restore' : 'Maximize'} className="w-11 h-9 grid place-items-center text-t2 hover:bg-bg3 hover:text-t1 rounded-md" onClick={() => void call('window:toggle-maximize').then(setMax)}>
              {max ? <Copy className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            </button>
            <button type="button" aria-label="Close" className="w-11 h-9 grid place-items-center text-t2 hover:bg-danger hover:text-white rounded-md" onClick={() => void call('window:close')}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
