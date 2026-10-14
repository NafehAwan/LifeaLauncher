import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Globe2, Newspaper, Plus, UserPlus } from 'lucide-react';
import { call } from '../lib/ipc';
import { cn, loaderName, relativeTime } from '../lib/util';
import { useSelectedAccount, useSelectedInstance, useServers } from '../hooks/queries';
import { useSettings } from '../stores/settings';
import { anyRunning, useLaunch } from '../stores/launch';
import { useUi } from '../stores/ui';
import { attempt } from '../stores/toasts';
import { Background, type CharacterAnim } from '../components/shell/Background';
import { PlayButton } from '../components/PlayButton';
import { CrashBanner } from '../components/CrashBanner';
import { InstanceIcon } from '../components/InstanceIcon';
import { ServerCard } from '../components/ServerCard';
import { Button, Chip, Skeleton } from '../components/ui/core';

function CharacterPill({ value, onChange }: { value: CharacterAnim; onChange: (a: CharacterAnim) => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    let t = setTimeout(() => setVisible(false), 3000);
    const show = () => {
      setVisible(true);
      clearTimeout(t);
      t = setTimeout(() => setVisible(false), 3000);
    };
    window.addEventListener('mousemove', show, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousemove', show);
    };
  }, []);
  return (
    <div className={cn('absolute bottom-6 right-6 z-10 glass border border-line rounded-full p-1 flex gap-1 transition-opacity duration-3', visible ? 'opacity-100' : 'opacity-0')} aria-label="Character animation">
      {(['idle', 'wave', 'walk', 'dance'] as CharacterAnim[]).map((a) => (
        <button key={a} type="button" onClick={() => onChange(a)} className={cn('h-7 px-3 rounded-full text-xs capitalize font-medium transition', value === a ? 'bg-accent text-white' : 'text-t2 hover:text-t1')}>
          {a}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const settings = useSettings((s) => s.settings);
  const { instances, selected, isLoading } = useSelectedInstance();
  const account = useSelectedAccount();
  const state = useLaunch((s) => (selected ? s.states[selected.id] : undefined));
  const gameRunning = useLaunch((s) => anyRunning(s.states));
  const { data: servers = [] } = useServers();
  const featured = useQuery({ queryKey: ['social', 'featured'], queryFn: () => call('social:featured'), staleTime: 600_000 });
  const news = useQuery({ queryKey: ['social', 'news'], queryFn: () => call('social:news'), staleTime: 600_000 });
  const worlds = useQuery({ queryKey: ['worlds', selected?.id], queryFn: () => call('instances:worlds', selected!.id), enabled: !!selected, staleTime: 60_000 });
  const [anim, setAnim] = useState<CharacterAnim>('idle');

  return (
    <section className="relative h-full min-h-[600px] overflow-hidden">
      <Background theme={settings.theme} animate={settings.animatedBackground} particles={settings.particles} speed={100} character={anim} paused={gameRunning} />
      <div className="absolute inset-0 bg-gradient-to-r from-bg0/90 via-bg0/55 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-bg0/80 to-transparent pointer-events-none" />

      <div className="relative h-full flex gap-8 p-8">
        <div className="flex-1 min-w-0 flex flex-col justify-end pb-6">
          {!account && (
            <div className="mb-6 max-w-md glass border border-line rounded-lg p-4 flex items-center gap-3 animate-pop">
              <UserPlus className="w-5 h-5 text-accent-hi shrink-0" />
              <div className="flex-1 text-sm text-t2">Add a Microsoft or offline account to start playing.</div>
              <Button size="sm" variant="primary" onClick={() => useUi.getState().set({ addAccount: true })}>Add account</Button>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-80" />
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-16 w-[364px]" />
            </div>
          ) : selected ? (
            <>
              <div className="flex items-center gap-4">
                <InstanceIcon icon={selected.icon} size={56} />
                <div className="min-w-0">
                  <h1 className="font-pixel text-2xl text-t1 truncate drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">{selected.name}</h1>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Chip>{selected.version}</Chip>
                <Chip tone={selected.loader === 'vanilla' ? 'default' : 'accent'}>{loaderName(selected.loader)}{selected.loaderVersion ? ` ${selected.loaderVersion}` : ''}</Chip>
                {selected.modCount > 0 && <Chip>{selected.modCount} mods</Chip>}
                <Chip>{selected.lastPlayed ? `Played ${relativeTime(selected.lastPlayed)}` : 'Never played'}</Chip>
              </div>
              <div className="mt-6">
                <PlayButton instance={selected} instances={instances} />
              </div>
              {state && <div className="mt-4 max-w-xl"><CrashBanner state={state} /></div>}
              <button type="button" className="mt-4 self-start text-sm text-t2 hover:text-t1" onClick={() => navigate(`/instance/${selected.id}`)}>
                Manage profile →
              </button>
            </>
          ) : (
            <div className="max-w-md">
              <h1 className="font-pixel text-2xl">Welcome to Lifea</h1>
              <p className="text-t2 mt-2">Create a profile to get started.</p>
              <Button className="mt-4" variant="primary" icon={Plus} onClick={() => useUi.getState().set({ newProfile: true })}>New profile</Button>
            </div>
          )}
        </div>

        <aside className="w-[340px] shrink-0 flex flex-col gap-5 overflow-y-auto pt-10 pb-16 pr-1">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="label">Servers</h2>
              <button type="button" className="text-xs text-accent-hi hover:underline" onClick={() => navigate('/servers')}>
                {servers.length ? 'Manage' : '+ Add server'}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {servers.slice(0, 4).map((s) => <ServerCard key={s.id} name={s.name} address={s.address} instanceId={selected?.id} />)}
              {(featured.data ?? []).filter((f) => !servers.some((s) => s.address === f.address)).slice(0, Math.max(0, 4 - servers.length)).map((f) => (
                <ServerCard key={f.id} name={f.name} address={f.address} instanceId={selected?.id} subtitle={f.description} />
              ))}
              {servers.length === 0 && !featured.data?.length && (
                <button type="button" onClick={() => navigate('/servers')} className="glass border border-dashed border-line-strong rounded-lg p-4 text-sm text-t3 hover:text-t1 flex items-center gap-2">
                  <Globe2 className="w-4 h-4" /> Add your favourite servers to join them in one click.
                </button>
              )}
            </div>
          </div>

          {selected && (worlds.data?.length ?? 0) > 0 && (
            <div>
              <h2 className="label mb-2">Jump back in</h2>
              <div className="flex flex-col gap-1.5">
                {worlds.data!.slice(0, 3).map((w) => (
                  <button
                    key={w.folder}
                    type="button"
                    onClick={() => void attempt(() => call('launch:start', selected.id, { world: w.folder }), 'Could not launch')}
                    className="glass border border-line rounded-lg px-3 py-2.5 text-left hover:border-line-strong transition flex items-center justify-between gap-2"
                  >
                    <span className="text-sm font-medium truncate">{w.name}</span>
                    <span className="text-2xs text-t3 shrink-0">{relativeTime(w.lastPlayed)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {(news.data?.length ?? 0) > 0 && (
            <div>
              <h2 className="label mb-2 flex items-center gap-1.5"><Newspaper className="w-3 h-3" /> News</h2>
              <div className="flex flex-col gap-2">
                {news.data!.slice(0, 3).map((n) => (
                  <button key={n.id} type="button" disabled={!n.url} onClick={() => n.url && void call('app:open-external', n.url)} className="glass border border-line rounded-lg p-3 text-left hover:border-line-strong transition">
                    <div className="text-sm font-semibold">{n.title}</div>
                    <div className="text-xs text-t3 mt-1 line-clamp-2">{n.body}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
      {settings.animatedBackground && <CharacterPill value={anim} onChange={setAnim} />}
    </section>
  );
}
