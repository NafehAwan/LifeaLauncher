import { memo, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpCircle, Camera, ChevronLeft, FilePlus, FolderOpen, Gauge, Globe, Package, Play, RefreshCw, ScrollText, Search, Settings2, Trash2 } from 'lucide-react';
import type { ContentFile, ContentKind, InstanceSummary, UpdateInfo } from '@shared/types';
import { LOADERS } from '@shared/constants';
import { call, pathForFile } from '../lib/ipc';
import { cn, formatBytes, loaderName, relativeTime } from '../lib/util';
import { qk, useInstances } from '../hooks/queries';
import { useLaunch } from '../stores/launch';
import { attempt, toast } from '../stores/toasts';
import { InstanceIcon, INSTANCE_ICON_IDS } from '../components/InstanceIcon';
import { PlayButton } from '../components/PlayButton';
import { CrashBanner } from '../components/CrashBanner';
import { Button, Chip, EmptyState, ErrorCard, Field, IconButton, Input, Segmented, Skeleton, Slider, Tabs, Toggle } from '../components/ui/core';
import { ConfirmModal, Modal, Select } from '../components/ui/overlay';

type Tab = 'content' | 'worlds' | 'screenshots' | 'logs' | 'settings';

const ContentRow = memo(function ContentRow({ f, checked, onCheck, onToggle }: { f: ContentFile; checked: boolean; onCheck: (v: boolean) => void; onToggle: (v: boolean) => void }) {
  return (
    <div className={cn('flex items-center gap-3 px-3 h-14 rounded-md border border-transparent hover:bg-bg2 hover:border-line transition', !f.enabled && 'opacity-55')}>
      <input type="checkbox" aria-label={`Select ${f.name}`} checked={checked} onChange={(e) => onCheck(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
      {f.iconUrl ? <img src={f.iconUrl} alt="" loading="lazy" decoding="async" width={32} height={32} className="w-8 h-8 rounded-md bg-bg3" /> : <div className="w-8 h-8 rounded-md bg-bg3 grid place-items-center"><Package className="w-4 h-4 text-t3" /></div>}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{f.name}</div>
        <div className="text-2xs text-t3 truncate">{f.version ? `${f.version} · ` : ''}{f.file} · {formatBytes(f.size)}</div>
      </div>
      <Chip tone={f.source === 'modrinth' ? 'accent' : 'default'}>{f.source === 'lifea' ? 'Lifea' : f.source === 'modrinth' ? 'Modrinth' : f.source === 'modpack' ? 'Modpack' : 'Manual'}</Chip>
      <Toggle checked={f.enabled} onChange={onToggle} label={`${f.enabled ? 'Disable' : 'Enable'} ${f.name}`} />
    </div>
  );
});

function ContentTab({ inst }: { inst: InstanceSummary }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [kind, setKind] = useState<ContentKind>('mods');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'name' | 'updated'>('name');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [drag, setDrag] = useState(false);
  const [updates, setUpdates] = useState<UpdateInfo[] | null>(null);
  const [checking, setChecking] = useState(false);
  const content = useQuery({ queryKey: qk.content(inst.id, kind), queryFn: () => call('instances:content', inst.id, kind), staleTime: 10_000 });
  useEffect(() => setSel(new Set()), [kind]);

  const list = useMemo(() => {
    const items = (content.data ?? []).filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()) || f.file.toLowerCase().includes(q.toLowerCase()));
    return sort === 'name' ? items : [...items].sort((a, b) => b.modified - a.modified);
  }, [content.data, q, sort]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['content', inst.id] });
  const toggle = async (files: string[], enabled: boolean) => {
    for (const f of files) await attempt(() => call('instances:toggle-content', inst.id, kind, f, enabled), 'Could not change file');
    void refresh();
  };
  const del = async (files: string[]) => {
    await attempt(() => call('instances:delete-content', inst.id, kind, files), 'Could not delete');
    setSel(new Set());
    void refresh();
  };
  const addPaths = async (paths?: string[]) => {
    const added = await attempt(() => call('instances:add-files', inst.id, kind, paths), 'Could not add files');
    if (added?.length) toast.success(`Added ${added.length} file${added.length > 1 ? 's' : ''}`);
    void refresh();
  };
  const browseType = kind === 'mods' ? 'mod' : kind === 'resourcepacks' ? 'resourcepack' : 'shader';
  const label = kind === 'mods' ? 'mods' : kind === 'resourcepacks' ? 'resource packs' : 'shader packs';

  return (
    <div
      className={cn('relative rounded-lg transition', drag && 'ring-2 ring-accent ring-offset-4 ring-offset-bg0')}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const paths = [...e.dataTransfer.files].map(pathForFile).filter(Boolean);
        if (paths.length) void addPaths(paths);
      }}
    >
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented<ContentKind> value={kind} onChange={setKind} options={[{ value: 'mods', label: 'Mods' }, { value: 'resourcepacks', label: 'Resource Packs' }, { value: 'shaderpacks', label: 'Shaders' }]} />
        <Input className="w-48" icon={Search} placeholder={`Search ${label}`} value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label="Sort" className="w-36" value={sort} onChange={setSort} options={[{ value: 'name', label: 'Name' }, { value: 'updated', label: 'Recently added' }]} />
        <div className="flex-1" />
        <IconButton icon={FolderOpen} label="Open folder" onClick={() => void attempt(() => call('instances:open-folder', inst.id, kind), 'Could not open folder')} />
        <IconButton icon={RefreshCw} label="Check for updates" disabled={checking} onClick={async () => {
          setChecking(true);
          const u = await attempt(() => call('modrinth:check-updates', inst.id), 'Update check failed');
          setChecking(false);
          if (u) {
            setUpdates(u);
            if (!u.length) toast.success('Everything is up to date');
          }
        }} />
        <IconButton icon={FilePlus} label="Add files" onClick={() => void addPaths()} />
        <Button variant="primary" icon={Search} onClick={() => navigate(`/browse?type=${browseType}&instance=${inst.id}`)}>Find {label}</Button>
      </div>

      {sel.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 surface-raised px-3 h-11 flex items-center gap-2 animate-pop">
          <span className="text-sm font-medium flex-1">{sel.size} selected</span>
          <Button size="sm" onClick={() => void toggle([...sel], true)}>Enable</Button>
          <Button size="sm" onClick={() => void toggle([...sel], false)}>Disable</Button>
          <Button size="sm" variant="danger" icon={Trash2} onClick={() => void del([...sel])}>Delete</Button>
          <Button size="sm" variant="ghost" onClick={() => setSel(new Set())}>Clear</Button>
        </div>
      )}

      {content.error ? (
        <ErrorCard error={content.error} onRetry={() => void content.refetch()} />
      ) : content.isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Package}
          title={q ? 'Nothing matches' : `No ${label} yet`}
          body={inst.loader === 'vanilla' && kind === 'mods' ? 'This is a vanilla profile. Switch it to Fabric in Settings to use mods.' : `Find ${label} on Modrinth, or drop files here.`}
          action={!q && <Button variant="primary" icon={Search} onClick={() => navigate(`/browse?type=${browseType}&instance=${inst.id}`)}>Find {label}</Button>}
        />
      ) : (
        <div className="flex flex-col gap-1">
          <label className="flex items-center gap-3 px-3 h-8 text-2xs text-t3">
            <input type="checkbox" aria-label="Select all" className="w-4 h-4 accent-[var(--accent)]" checked={sel.size === list.length && list.length > 0} onChange={(e) => setSel(e.target.checked ? new Set(list.map((f) => f.file)) : new Set())} />
            {list.length} {label} · {list.filter((f) => f.enabled).length} enabled
          </label>
          {list.map((f) => (
            <ContentRow
              key={f.file}
              f={f}
              checked={sel.has(f.file)}
              onCheck={(v) => setSel((s) => { const n = new Set(s); if (v) n.add(f.file); else n.delete(f.file); return n; })}
              onToggle={(v) => void toggle([f.file], v)}
            />
          ))}
        </div>
      )}

      <Modal
        open={!!updates?.length}
        onClose={() => setUpdates(null)}
        title={`${updates?.length ?? 0} update${updates?.length === 1 ? '' : 's'} available`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setUpdates(null)}>Later</Button>
            <Button variant="primary" icon={ArrowUpCircle} onClick={async () => {
              const u = updates!;
              setUpdates(null);
              const r = await attempt(() => call('modrinth:apply-updates', inst.id, u), 'Update failed');
              if (r) toast.success(`Updated ${r.installed.length} file${r.installed.length === 1 ? '' : 's'}`);
              void refresh();
            }}>Update all</Button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          {updates?.map((u) => (
            <div key={u.file} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{u.name}</span>
              <span className="text-2xs text-t3 tnum shrink-0">{u.from} → <span className="text-success">{u.to}</span></span>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}

function WorldsTab({ inst }: { inst: InstanceSummary }) {
  const worlds = useQuery({ queryKey: ['worlds', inst.id], queryFn: () => call('instances:worlds', inst.id) });
  if (worlds.isLoading) return <Skeleton className="h-32" />;
  if (!worlds.data?.length) return <EmptyState icon={Globe} title="No worlds yet" body="Worlds you create in this profile show up here." action={<Button onClick={() => void call('instances:open-folder', inst.id, 'saves')} icon={FolderOpen}>Open saves folder</Button>} />;
  return (
    <div className="flex flex-col gap-2">
      {worlds.data.map((w) => (
        <div key={w.folder} className="surface px-4 h-14 flex items-center gap-3">
          <Globe className="w-4 h-4 text-t3" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{w.name}</div>
            <div className="text-2xs text-t3">Last played {relativeTime(w.lastPlayed)}</div>
          </div>
          <Button size="sm" variant="primary" icon={Play} onClick={() => void attempt(() => call('launch:start', inst.id, { world: w.folder }), 'Could not launch')}>Play</Button>
        </div>
      ))}
    </div>
  );
}

function ScreenshotsTab({ inst }: { inst: InstanceSummary }) {
  const shots = useQuery({ queryKey: ['screenshots', inst.id], queryFn: () => call('instances:screenshots', inst.id) });
  if (shots.isLoading) return <Skeleton className="h-40" />;
  if (!shots.data?.length) return <EmptyState icon={Camera} title="No screenshots yet" body="Press F2 in game to take one." />;
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
      {shots.data.map((s) => (
        <img key={s.file} src={s.url} alt={s.file} loading="lazy" decoding="async" className="rounded-md border border-line aspect-video object-cover bg-bg2" />
      ))}
    </div>
  );
}

function SettingsTab({ inst }: { inst: InstanceSummary }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const boost = useQuery({ queryKey: qk.boost(inst.id), queryFn: () => call('boost:analyze', inst.id), staleTime: 60_000 });
  const [name, setName] = useState(inst.name);
  const [memory, setMemory] = useState(inst.settings.memoryMb ?? 4096);
  const [jvm, setJvm] = useState(inst.settings.jvmArgs ?? '');
  const [java, setJava] = useState(inst.settings.javaPath ?? '');
  const [pre, setPre] = useState(inst.settings.preLaunchCommand ?? '');
  const [w, setW] = useState(inst.settings.resolution?.width ?? 1280);
  const [h, setH] = useState(inst.settings.resolution?.height ?? 720);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const total = boost.data?.system.totalMemMb ?? 16384;

  const save = async (patch: Parameters<typeof call<'instances:update'>>[2]) => {
    const r = await attempt(() => call('instances:update', inst.id, patch), 'Could not save');
    if (r) {
      void qc.invalidateQueries({ queryKey: qk.instances });
      toast.success('Saved');
    }
  };

  return (
    <div className="grid grid-cols-2 gap-5 max-w-4xl">
      <div className="surface p-5 flex flex-col gap-4">
        <h3 className="font-semibold">General</h3>
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 48))} onBlur={() => name.trim() && name !== inst.name && void save({ name: name.trim() })} />
        </Field>
        <Field label="Icon">
          <div className="flex flex-wrap gap-1.5">
            {INSTANCE_ICON_IDS.map((i) => (
              <button key={i} type="button" aria-label={`Icon ${i}`} aria-pressed={inst.icon === i} onClick={() => void save({ icon: i })} className={cn('rounded-[12px]', inst.icon === i ? 'ring-2 ring-accent' : 'opacity-70 hover:opacity-100')}>
                <InstanceIcon icon={i} size={36} />
              </button>
            ))}
          </div>
        </Field>
        <Field label="Mod loader" hint={inst.loader === 'vanilla' ? 'Switch to Fabric to use mods and the Lifea performance pack.' : 'Changing loader keeps your files but some mods may stop working.'}>
          <Select label="Mod loader" value={inst.loader} onChange={(l) => void save({ loader: l })} options={LOADERS.map((l) => ({ value: l.id, label: l.name }))} />
        </Field>
      </div>

      <div className="surface p-5 flex flex-col gap-4">
        <h3 className="font-semibold">Java & memory</h3>
        <Slider
          label="Memory"
          min={1024}
          max={Math.max(2048, Math.floor(total / 1024) * 1024 - 1024)}
          step={512}
          value={memory}
          onChange={setMemory}
          onCommit={(v) => void save({ settings: { memoryMb: v } })}
          format={(v) => `${(v / 1024).toFixed(1)} GB`}
          marker={boost.data ? { value: boost.data.recommendedMemoryMb, label: `Recommended: ${(boost.data.recommendedMemoryMb / 1024).toFixed(1)} GB for your ${Math.round(total / 1024)} GB system` } : undefined}
        />
        <Field label="Java executable" hint="Leave empty to let Lifea download the right Java automatically.">
          <div className="flex gap-2">
            <Input className="flex-1" value={java} placeholder="Managed (recommended)" onChange={(e) => setJava(e.target.value)} onBlur={() => java !== (inst.settings.javaPath ?? '') && void save({ settings: { javaPath: java } })} />
            <Button onClick={async () => {
              const p = await call('java:pick');
              if (!p) return;
              const probed = await call('java:probe', p);
              if (!probed) return toast.error('That is not a working Java executable');
              setJava(p);
              void save({ settings: { javaPath: p } });
              toast.info(`Java ${probed.major} (${probed.version})`);
            }}>Browse</Button>
          </div>
        </Field>
        <Field label="JVM arguments" hint="Quoted values are kept together. GC flags here replace Lifea's tuned defaults.">
          <Input value={jvm} placeholder="-Dexample=true" onChange={(e) => setJvm(e.target.value)} onBlur={() => jvm !== (inst.settings.jvmArgs ?? '') && void save({ settings: { jvmArgs: jvm } })} className="font-mono" />
        </Field>
      </div>

      <div className="surface p-5 flex flex-col gap-4">
        <h3 className="font-semibold">Game window</h3>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Width"><Input type="number" value={w} min={320} max={7680} onChange={(e) => setW(Number(e.target.value))} onBlur={() => void save({ settings: { resolution: { width: w, height: h } } })} /></Field>
          <Field label="Height"><Input type="number" value={h} min={240} max={4320} onChange={(e) => setH(Number(e.target.value))} onBlur={() => void save({ settings: { resolution: { width: w, height: h } } })} /></Field>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Start in fullscreen</span>
          <Toggle checked={!!inst.settings.fullscreen} onChange={(v) => void save({ settings: { fullscreen: v } })} label="Fullscreen" />
        </div>
      </div>

      <div className="surface p-5 flex flex-col gap-4">
        <h3 className="font-semibold">Advanced</h3>
        <Field label="Pre-launch command" hint="Runs in the profile folder before Minecraft starts.">
          <Input value={pre} onChange={(e) => setPre(e.target.value)} onBlur={() => pre !== (inst.settings.preLaunchCommand ?? '') && void save({ settings: { preLaunchCommand: pre } })} className="font-mono" />
        </Field>
        <div className="flex gap-2">
          <Button icon={Gauge} onClick={() => navigate(`/boost?instance=${inst.id}`)}>Open in Boost</Button>
          <Button variant="danger" icon={Trash2} onClick={() => setConfirmDelete(true)}>Delete profile</Button>
        </div>
      </div>
      <ConfirmModal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title={`Delete “${inst.name}”?`}
        body="This removes the profile folder, including its worlds, mods and screenshots. This cannot be undone."
        confirmLabel="Delete profile"
        onConfirm={() =>
          void attempt(async () => {
            await call('instances:remove', inst.id);
            void qc.invalidateQueries({ queryKey: qk.instances });
            navigate('/library');
          }, 'Could not delete')
        }
      />
    </div>
  );
}

export default function Profile() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'content';
  const { data, isLoading } = useInstances();
  const inst = data?.find((i) => i.id === id);
  const state = useLaunch((s) => s.states[id]);

  if (isLoading) return <div className="page"><Skeleton className="h-40" /></div>;
  if (!inst)
    return (
      <div className="page">
        <Link to="/library" className="inline-flex items-center gap-1 text-sm text-t3 hover:text-t1"><ChevronLeft className="w-4 h-4" /> Library</Link>
        <EmptyState icon={Package} title="Profile not found" body="It may have been deleted." />
      </div>
    );

  return (
    <div>
      <div className="relative px-8 pt-6 pb-6 border-b border-line bg-gradient-to-br from-accent-lo/25 via-bg1 to-bg0">
        <Link to="/library" className="inline-flex items-center gap-1 text-sm text-t3 hover:text-t1 mb-4"><ChevronLeft className="w-4 h-4" /> Library</Link>
        <div className="flex items-end gap-5">
          <InstanceIcon icon={inst.icon} size={80} />
          <div className="flex-1 min-w-0">
            <h1 className="font-pixel text-xl truncate">{inst.name}</h1>
            <div className="flex gap-2 mt-3">
              <Chip>{inst.version}</Chip>
              <Chip tone={inst.loader === 'vanilla' ? 'default' : 'accent'}>{loaderName(inst.loader)}{inst.loaderVersion ? ` ${inst.loaderVersion}` : ''}</Chip>
              <Chip>{inst.modCount} mods</Chip>
              <Chip>{inst.lastPlayed ? `Played ${relativeTime(inst.lastPlayed)}` : 'Never played'}</Chip>
            </div>
          </div>
          <PlayButton instance={inst} compact />
        </div>
        {state && <div className="mt-4"><CrashBanner state={state} /></div>}
      </div>
      <div className="px-8 pt-2">
        <Tabs<Tab>
          value={tab}
          onChange={(t) => setParams({ tab: t }, { replace: true })}
          tabs={[
            { value: 'content', label: 'Content', icon: Package },
            { value: 'worlds', label: 'Worlds', icon: Globe },
            { value: 'screenshots', label: 'Screenshots', icon: Camera },
            { value: 'logs', label: 'Logs', icon: ScrollText },
            { value: 'settings', label: 'Settings', icon: Settings2 },
          ]}
        />
        <div className="py-6">
          {tab === 'content' && <ContentTab inst={inst} />}
          {tab === 'worlds' && <WorldsTab inst={inst} />}
          {tab === 'screenshots' && <ScreenshotsTab inst={inst} />}
          {tab === 'logs' && (
            <div className="flex gap-2">
              <Button icon={ScrollText} onClick={() => void call('instances:open-folder', inst.id, 'logs')}>Open logs folder</Button>
              <Button icon={FolderOpen} onClick={() => void call('instances:open-folder', inst.id, 'crash-reports')}>Open crash reports</Button>
              <Link to="/console" className="h-10 px-4 rounded-md bg-bg3 border border-line-strong text-sm font-semibold inline-flex items-center">Live console</Link>
            </div>
          )}
          {tab === 'settings' && <SettingsTab inst={inst} key={inst.id} />}
        </div>
      </div>
    </div>
  );
}
