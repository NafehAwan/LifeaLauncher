/** Plain-English crash explanation with a one-click fix where possible. */
import { useNavigate } from 'react-router-dom';
import { AlertOctagon, X } from 'lucide-react';
import type { LaunchState } from '@shared/types';
import { call } from '../lib/ipc';
import { attempt, toast } from '../stores/toasts';
import { useLaunch } from '../stores/launch';
import { Button } from './ui/core';

export function CrashBanner({ state, compact }: { state: LaunchState; compact?: boolean }) {
  const navigate = useNavigate();
  if (state.status !== 'crashed' || !state.crash) return null;
  const { crash } = state;
  const dismiss = () => useLaunch.setState((s) => ({ states: { ...s.states, [state.instanceId]: { ...state, status: 'exited', crash: undefined } } }));
  const fix = async () => {
    switch (crash.fix?.action) {
      case 'install-fabric-api': {
        const r = await attempt(() => call('modrinth:install', state.instanceId, 'fabric-api'), 'Could not install Fabric API');
        if (r) toast.success('Fabric API installed', 'Launch again.');
        break;
      }
      case 'set-java':
        await attempt(() => call('instances:update', state.instanceId, { settings: { javaPath: '' } }), 'Could not reset Java');
        toast.success('Using managed Java', 'Launch again — the right Java version will be downloaded.');
        break;
      case 'lower-memory':
      case 'raise-memory':
        navigate(`/instance/${state.instanceId}?tab=settings`);
        break;
      case 'update-drivers':
        void call('app:open-external', 'https://www.minecraft.net/en-us/article/how-update-your-graphics-drivers');
        break;
      default:
        navigate('/console');
    }
    dismiss();
  };
  return (
    <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 flex gap-3 animate-pop" role="alert">
      <AlertOctagon className="w-5 h-5 text-danger shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-t1">{crash.title}</div>
        <div className="text-sm text-t2 mt-0.5">{crash.detail}</div>
        {!compact && (
          <div className="flex gap-2 mt-3">
            {crash.fix && <Button size="sm" variant="primary" onClick={() => void fix()}>{crash.fix.label}</Button>}
            <Button size="sm" variant="ghost" onClick={() => navigate('/console')}>View log</Button>
          </div>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="w-7 h-7 grid place-items-center rounded text-t3 hover:text-t1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
