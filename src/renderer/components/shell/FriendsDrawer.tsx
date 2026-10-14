/** Collapsible friends panel (Lunar-style social sidebar), available on every page. */
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Users } from 'lucide-react';
import type { Friend, SocialStatus } from '@shared/types';
import { call } from '../../lib/ipc';
import { qk } from '../../hooks/queries';
import { useSettings } from '../../stores/settings';
import { cn } from '../../lib/util';
import { SkinHead } from '../SkinHead';
import { IconButton } from '../ui/core';

export function presenceText(f: Friend): string {
  if (f.presence.state === 'playing') return f.presence.server ? `Playing on ${f.presence.server}` : `Playing${f.presence.version ? ` ${f.presence.version}` : ''}`;
  if (f.presence.state === 'launcher') return 'In launcher';
  return 'Offline';
}

export function PresenceDot({ state }: { state: Friend['presence']['state'] }) {
  return <span className={cn('w-2.5 h-2.5 rounded-full ring-2 ring-bg1 shrink-0', state === 'playing' ? 'bg-success' : state === 'launcher' ? 'bg-info' : 'bg-t3/60')} />;
}

export function useSocial() {
  const status = useQuery<SocialStatus>({ queryKey: [...qk.social, 'status'], queryFn: () => call('social:status'), staleTime: 10_000 });
  const friends = useQuery<Friend[]>({
    queryKey: [...qk.social, 'friends'],
    queryFn: () => call('social:friends'),
    enabled: !!status.data?.signedIn,
    staleTime: 30_000,
  });
  return { status: status.data, friends: friends.data ?? [], loading: friends.isLoading, error: friends.error };
}

/** Title-bar button that opens/closes the friends panel and shows the online count. */
export function FriendsToggle() {
  const open = useSettings((s) => s.settings.friendsDrawerOpen);
  const patch = useSettings((s) => s.patch);
  const { status, friends } = useSocial();
  const online = friends.filter((f) => f.presence.state !== 'offline').length;
  return (
    <button type="button" aria-label={open ? 'Close friends' : 'Open friends'} aria-pressed={open} onClick={() => void patch({ friendsDrawerOpen: !open })} className={cn('no-drag h-7 px-2 rounded-md text-xs flex items-center gap-1.5 transition', open ? 'bg-bg3 text-t1' : 'text-t2 hover:text-t1 hover:bg-bg3')}>
      <Users className="w-3.5 h-3.5" />
      {status?.signedIn && <span className="tnum">{online}</span>}
    </button>
  );
}

export function FriendsDrawer() {
  const open = useSettings((s) => s.settings.friendsDrawerOpen);
  const patch = useSettings((s) => s.patch);
  const navigate = useNavigate();
  const { status, friends } = useSocial();
  const online = friends.filter((f) => f.presence.state !== 'offline');

  if (!open) return null;
  return (
    <aside aria-label="Friends" className="w-[280px] shrink-0 bg-bg1 border-l border-line flex flex-col animate-fade">
      <div className="h-12 flex items-center justify-between px-4 border-b border-line">
        <div className="font-semibold text-sm">Friends {status?.signedIn && <span className="text-t3 tnum">· {online.length} online</span>}</div>
        <IconButton icon={ChevronRight} label="Close friends" size="sm" onClick={() => void patch({ friendsDrawerOpen: false })} />
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {!status?.signedIn ? (
          <div className="p-4 text-sm text-t3">
            {status?.error ?? 'Sign in with a Microsoft account to see friends.'}
            <button type="button" className="link block mt-2 text-sm" onClick={() => navigate('/friends')}>
              Open Friends
            </button>
          </div>
        ) : friends.length === 0 ? (
          <div className="p-4 text-sm text-t3">No friends yet. Add someone from the Friends page.</div>
        ) : (
          [...friends]
            .sort((a, b) => Number(b.presence.state !== 'offline') - Number(a.presence.state !== 'offline') || a.username.localeCompare(b.username))
            .map((f) => (
              <button key={f.uuid} type="button" onClick={() => navigate(`/friends?u=${f.uuid}`)} className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-bg2 text-left">
                <div className="relative">
                  <SkinHead skinUrl={`https://mc-heads.net/skin/${f.uuid}`} size={30} />
                  <span className="absolute -bottom-0.5 -right-0.5"><PresenceDot state={f.presence.state} /></span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{f.username}</div>
                  <div className="text-2xs text-t3 truncate">{presenceText(f)}</div>
                </div>
              </button>
            ))
        )}
      </div>
    </aside>
  );
}
