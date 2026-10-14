/** Compact launch progress for pages other than Home/profile (Home shows it inside PLAY — one progress UI at a time). */
import { useMatch, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { call } from '../lib/ipc';
import { isBusy, useLaunch } from '../stores/launch';
import { useInstances } from '../hooks/queries';
import { ProgressBar } from './ui/core';

export function LaunchToast() {
  const busy = useLaunch((s) => Object.values(s.states).find(isBusy));
  const onHome = useMatch({ path: '/', end: true });
  const onInstance = useMatch('/instance/:id');
  const { data: instances } = useInstances();
  const navigate = useNavigate();
  if (!busy || onHome || onInstance?.params.id === busy.instanceId) return null;
  const name = instances?.find((i) => i.id === busy.instanceId)?.name ?? 'Minecraft';
  return (
    <div className="fixed bottom-5 left-[92px] z-50 w-[320px] surface-raised p-3.5 animate-toast" role="status">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="text-sm font-semibold text-t1 truncate text-left" onClick={() => navigate(`/instance/${busy.instanceId}`)}>
          {name}
        </button>
        <div className="flex items-center gap-1">
          <span className="font-pixel text-xs tnum">{Math.round(busy.progress * 100)}%</span>
          <button type="button" aria-label="Cancel launch" onClick={() => void call('launch:cancel', busy.instanceId)} className="w-6 h-6 grid place-items-center rounded text-t3 hover:text-danger">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="text-2xs text-t3 mt-0.5 mb-2 truncate">{busy.phase}</div>
      <ProgressBar value={busy.progress} sheen />
    </div>
  );
}
