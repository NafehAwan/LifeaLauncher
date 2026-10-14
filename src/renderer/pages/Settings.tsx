import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Check, Download, FolderOpen, Info, Monitor, Palette, Plus, RefreshCw, Server, Trash2, UserRound, Wrench } from 'lucide-react';
import { ACCENT_PRESETS, THEMES } from '@shared/constants';
import type { Settings as SettingsT, UpdaterState } from '@shared/types';
import { call, on } from '../lib/ipc';
import { asset, cn, contrast } from '../lib/util';
import { qk, useAccounts } from '../hooks/queries';
import { useAppInfo } from '../hooks/useAppInfo';
import { useSettings } from '../stores/settings';
import { useUi } from '../stores/ui';
import { attempt, toast } from '../stores/toasts';
import { SkinHead } from '../components/SkinHead';
import { Button, Chip, Input, PageHeader, Segmented, Slider, Toggle } from '../components/ui/core';

type Tab = 'general' | 'appearance' | 'java' | 'accounts' | 'downloads' | 'advanced' | 'about';
const TABS: { value: Tab; label: string; icon: typeof Palette }[] = [
  { value: 'general', label: 'General', icon: Monitor },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'java', label: 'Java & memory', icon: Wrench },
  { value: 'accounts', label: 'Accounts', icon: UserRound },
  { value: 'downloads', label: 'Downloads', icon: Download },
  { value: 'advanced', label: 'Advanced', icon: Server },
  { value: 'about', label: 'About', icon: Info },
];

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 border-b border-line last:border-0">
      <div className="min-w-0">
        <div className="text-sm font-medium text-t1">{title}</div>
        {hint && <div className="text-xs text-t3 mt-0.5">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface px-5 py-1 mb-5">
      <h2 className="label pt-4 pb-1">{title}</h2>
      {children}
    </section>
  );
}

function SavedTick() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = on('settings:changed', () => {
      setShow(true);
      clearTimeout(t);
      t = setTimeout(() => setShow(false), 1200);
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, []);
  return <span className={cn('text-xs text-success inline-flex items-center gap-1 transition-opacity', show ? 'opacity-100' : 'opacity-0')}><Check className="w-3.5 h-3.5" /> Saved</span>;
}

export default function Settings() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'general';
  const { settings, patch } = useSettings();
  const set = <K extends keyof SettingsT>(k: K) => (v: SettingsT[K]) => void attempt(() => patch({ [k]: v } as Partial<SettingsT>), 'Could not save setting');
  const info = useAppInfo();
  const qc = useQueryClient();
  const { data: accounts = [] } = useAccounts();
  const runtimes = useQuery({ queryKey: ['java'], queryFn: () => call('java:list'), enabled: tab === 'java' });
  const [mem, setMem] = useState(settings.defaultMemoryMb);
  const [zoom, setZoom] = useState(settings.zoom);
  const [parallel, setParallel] = useState(settings.parallelDownloads);
  const [maxLines, setMaxLines] = useState(settings.maxLogLines);
  const [custom, setCustom] = useState('#e11d2e');
  const [backend, setBackend] = useState(settings.backendUrl);
  const [gameDir, setGameDir] = useState(settings.gameDir);
  const [updater, setUpdater] = useState<UpdaterState>({ status: 'idle' });
  useEffect(() => {
    void call('updater:state').then(setUpdater);
    return on('updater:state', setUpdater);
  }, []);

  const customOk = /^#[0-9a-f]{6}$/i.test(custom) && contrast(custom, '#0b0607') >= 3;

  return (
    <div className="page">
      <PageHeader title="Settings" actions={<SavedTick />} />
      <div className="flex gap-8">
        <nav className="w-48 shrink-0 flex flex-col gap-1" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.value} type="button" onClick={() => setParams({ tab: t.value }, { replace: true })} className={cn('h-9 px-3 rounded-md text-sm text-left font-medium inline-flex items-center gap-2.5 transition', tab === t.value ? 'bg-bg3 text-t1' : 'text-t3 hover:text-t1 hover:bg-bg2')}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </nav>
        <div className="flex-1 min-w-0 max-w-[760px]">
          {tab === 'general' && (
            <Group title="Launcher">
              <Row title="When the game starts" hint="Hiding the launcher frees CPU and GPU for Minecraft. It comes back when the game closes.">
                <Segmented size="sm" value={settings.launchBehavior} onChange={set('launchBehavior')} options={[{ value: 'hide', label: 'Hide' }, { value: 'minimize', label: 'Minimize' }, { value: 'keep', label: 'Keep open' }]} />
              </Row>
              <Row title="Friends panel" hint="Show the friends sidebar on every page.">
                <Toggle checked={settings.friendsDrawerOpen} onChange={set('friendsDrawerOpen')} label="Friends panel" />
              </Row>
              <Row title="Automatic updates" hint="Download launcher updates in the background and install on restart.">
                <Toggle checked={settings.autoUpdate} onChange={set('autoUpdate')} label="Automatic updates" />
              </Row>
            </Group>
          )}

          {tab === 'appearance' && (
            <>
              <Group title="Theme">
                <div className="grid grid-cols-2 gap-3 py-4">
                  {THEMES.map((t) => (
                    <button key={t.id} type="button" aria-pressed={settings.theme === t.id} data-theme-id={t.id} onClick={() => set('theme')(t.id)} className={cn('relative rounded-lg overflow-hidden border text-left transition h-28', settings.theme === t.id ? 'border-accent ring-2 ring-accent/50' : 'border-line-strong hover:border-t3')}>
                      {t.layers.filter((l) => l !== 'clouds').map((l) => (
                        <img key={l} src={asset(`scenes/${t.id}/${l}.webp`)} alt="" className="absolute inset-0 w-full h-full object-cover object-[50%_75%] pixelated" loading="lazy" />
                      ))}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                      <div className="absolute bottom-0 p-3">
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-2xs text-t2">{t.description}</div>
                      </div>
                      {settings.theme === t.id && <Check className="absolute top-2 right-2 w-5 h-5 text-white bg-accent rounded-full p-0.5" />}
                    </button>
                  ))}
                </div>
              </Group>
              <Group title="Accent colour">
                <div className="flex items-center gap-3 py-4 flex-wrap">
                  {ACCENT_PRESETS.map((a) => (
                    <button key={a.color} type="button" title={a.name} aria-label={a.name} aria-pressed={settings.accent === a.color} onClick={() => set('accent')(a.color)} className={cn('w-9 h-9 rounded-full transition', settings.accent === a.color && 'ring-2 ring-white ring-offset-2 ring-offset-bg2')} style={{ background: a.color }} />
                  ))}
                  <div className="flex items-center gap-2 ml-2">
                    <input type="color" aria-label="Custom accent" value={custom} onChange={(e) => setCustom(e.target.value)} className="w-9 h-9 rounded-full bg-transparent cursor-pointer" />
                    <Button size="sm" icon={Plus} disabled={!customOk} title={customOk ? undefined : 'Too dark to read on the background'} onClick={() => set('accent')(custom)}>Use custom</Button>
                  </div>
                </div>
              </Group>
              <Group title="Motion & layout">
                <Row title="Animated background" hint="Parallax scene on Home. Pauses automatically while you play.">
                  <Toggle checked={settings.animatedBackground} onChange={set('animatedBackground')} label="Animated background" />
                </Row>
                <Row title="Embers" hint="Floating particles in the scene.">
                  <Toggle checked={settings.particles} onChange={set('particles')} label="Embers" />
                </Row>
                <Row title="Reduce motion" hint="Turns off parallax, morphing and glows.">
                  <Segmented size="sm" value={settings.reducedMotion} onChange={set('reducedMotion')} options={[{ value: 'system', label: 'System' }, { value: 'on', label: 'On' }, { value: 'off', label: 'Off' }]} />
                </Row>
                <div className="py-4">
                  <Slider label="Interface zoom" min={0.75} max={1.5} step={0.05} value={zoom} onChange={setZoom} onCommit={(v) => set('zoom')(v)} format={(v) => `${Math.round(v * 100)}%`} />
                </div>
              </Group>
            </>
          )}

          {tab === 'java' && (
            <>
              <Group title="Memory">
                <div className="py-4">
                  <Slider label="Default memory for new profiles" min={1024} max={16384} step={512} value={mem} onChange={setMem} onCommit={(v) => set('defaultMemoryMb')(v)} format={(v) => `${(v / 1024).toFixed(1)} GB`} />
                </div>
                <Row title="Garbage collector" hint="G1 is tuned for smooth frame times. Generational ZGC needs Java 21 and 12 GB+ RAM.">
                  <Segmented size="sm" value={settings.gcPreset} onChange={set('gcPreset')} options={[{ value: 'g1', label: 'G1 (tuned)' }, { value: 'zgc', label: 'ZGC' }]} />
                </Row>
              </Group>
              <Group title="Java runtimes">
                <p className="text-xs text-t3 pt-3">Lifea downloads the exact Java each Minecraft version needs (8, 17 or 21). You never have to install Java yourself.</p>
                <div className="py-3 flex flex-col gap-2">
                  {(runtimes.data ?? []).length === 0 && <div className="text-sm text-t3">None downloaded yet — they appear after your first launch.</div>}
                  {runtimes.data?.map((r) => (
                    <div key={r.path} className="flex items-center gap-3 text-sm">
                      <Chip tone="accent">Java {r.major}</Chip>
                      <span className="text-t2 tnum">{r.version}</span>
                      <span className="text-2xs text-t3 truncate flex-1 font-mono selectable">{r.path}</span>
                    </div>
                  ))}
                </div>
              </Group>
            </>
          )}

          {tab === 'accounts' && (
            <Group title="Accounts">
              <div className="py-3 flex flex-col gap-2">
                {accounts.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-md bg-bg1 border border-line">
                    <SkinHead skinUrl={a.skinUrl} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{a.username}</div>
                      <div className="text-2xs text-t3">{a.type === 'msa' ? 'Microsoft account' : 'Offline account (singleplayer & LAN)'}</div>
                    </div>
                    {settings.selectedAccountId === a.id ? <Chip tone="success">Active</Chip> : <Button size="sm" onClick={() => void attempt(async () => { await call('accounts:select', a.id); await patch({ selectedAccountId: a.id }); }, 'Could not switch')}>Use</Button>}
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove ${a.username}`} onClick={() => void attempt(async () => { await call('accounts:remove', a.id); void qc.invalidateQueries({ queryKey: qk.accounts }); }, 'Could not remove')} />
                  </div>
                ))}
                <div><Button icon={Plus} variant="primary" onClick={() => useUi.getState().set({ addAccount: true })}>Add account</Button></div>
                {!info?.msaConfigured && <p className="text-xs text-t3">Microsoft login needs a Mojang-approved Azure app ID set at build time (LIFEA_MSA_CLIENT_ID). Offline accounts work without it.</p>}
              </div>
            </Group>
          )}

          {tab === 'downloads' && (
            <Group title="Downloads">
              <div className="py-4">
                <Slider label="Parallel downloads" min={4} max={64} value={parallel} onChange={setParallel} onCommit={(v) => set('parallelDownloads')(v)} />
                <p className="text-xs text-t3 mt-2">Higher is faster on good connections. Lower it if downloads fail on slow or shared networks.</p>
              </div>
            </Group>
          )}

          {tab === 'advanced' && (
            <>
              <Group title="Storage">
                <Row title="Game folder" hint="Where profiles, libraries, assets and Java runtimes live. Leave empty for ~/.lifea. Restart after changing.">
                  <div className="flex gap-2 w-80">
                    <Input className="flex-1" value={gameDir} placeholder="~/.lifea" onChange={(e) => setGameDir(e.target.value)} />
                    <Button onClick={() => set('gameDir')(gameDir.trim())}>Save</Button>
                  </div>
                </Row>
                <Row title="Launcher logs" hint="Attach these when reporting a bug.">
                  <Button icon={FolderOpen} onClick={() => void call('app:open-logs')}>Open logs</Button>
                </Row>
                <div className="py-4">
                  <Slider label="Console history" min={1000} max={100000} step={1000} value={maxLines} onChange={setMaxLines} onCommit={(v) => set('maxLogLines')(v)} format={(v) => `${v.toLocaleString()} lines`} />
                </div>
              </Group>
              <Group title="Lifea services">
                <Row title="Backend URL" hint="Friends, cosmetics and news. Leave empty to turn these off.">
                  <div className="flex gap-2 w-80">
                    <Input className="flex-1" value={backend} placeholder="https://api.example.com" onChange={(e) => setBackend(e.target.value)} />
                    <Button onClick={async () => {
                      if (backend && !/^https?:\/\//.test(backend)) return toast.error('Enter a full http(s) URL');
                      set('backendUrl')(backend.trim());
                      const s = await call('social:connect');
                      toast[s.signedIn ? 'success' : 'info'](s.signedIn ? 'Connected to Lifea services' : 'Saved', s.error);
                      void qc.invalidateQueries({ queryKey: qk.social });
                    }}>Save</Button>
                  </div>
                </Row>
              </Group>
            </>
          )}

          {tab === 'about' && (
            <Group title="About">
              <div className="py-4 flex items-center gap-4">
                <img src={asset('icons/logo.svg')} alt="" className="w-14 h-14 pixelated" />
                <div>
                  <div className="font-pixel text-lg">LifeaLauncher</div>
                  <div className="text-xs text-t3 tnum">Version {info?.version} · Electron {info?.electron} · {info?.platform}/{info?.arch}</div>
                </div>
              </div>
              <Row title="Updates" hint={updater.status === 'disabled' ? 'Updates are disabled in development builds.' : updater.status === 'none' ? 'You are on the latest version.' : updater.status === 'error' ? updater.error : updater.status === 'ready' ? `Version ${updater.version} is ready.` : updater.status}>
                {updater.status === 'ready' ? <Button variant="primary" onClick={() => void call('updater:install')}>Restart to update</Button> : <Button icon={RefreshCw} loading={updater.status === 'checking'} disabled={updater.status === 'disabled'} onClick={() => void call('updater:check').then(setUpdater)}>Check for updates</Button>}
              </Row>
              <div className="py-4 text-xs text-t3 leading-relaxed">
                Not affiliated with Mojang or Microsoft. Minecraft is a trademark of Mojang AB. Mods and modpacks are provided by Modrinth and their authors. Monocraft font by Idrees Hassan (OFL).
                <div className="mt-2 flex gap-3">
                  <button type="button" className="link" onClick={() => void call('app:open-external', 'https://github.com/nafehawan/lifealauncher')}>Source code</button>
                  <button type="button" className="link" onClick={() => void call('app:open-external', 'https://modrinth.com')}>Modrinth</button>
                </div>
              </div>
            </Group>
          )}
        </div>
      </div>
    </div>
  );
}
