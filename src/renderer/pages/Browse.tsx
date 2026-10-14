import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Download, ExternalLink, Heart, Loader2, Package, Search, X } from 'lucide-react';
import type { BrowseQuery, InstanceSummary, ModrinthHit, ProjectType } from '@shared/types';
import { call } from '../lib/ipc';
import { cn, formatCompact, loaderName } from '../lib/util';
import { qk, useSelectedInstance } from '../hooks/queries';
import { attempt, toast } from '../stores/toasts';
import { Button, Chip, EmptyState, ErrorCard, Input, PageHeader, Skeleton } from '../components/ui/core';
import { Modal, Select } from '../components/ui/overlay';

const TYPES: { value: ProjectType; label: string }[] = [
  { value: 'mod', label: 'Mods' },
  { value: 'modpack', label: 'Modpacks' },
  { value: 'resourcepack', label: 'Resource Packs' },
  { value: 'shader', label: 'Shaders' },
];
const CATEGORIES: Record<ProjectType, string[]> = {
  mod: ['optimization', 'utility', 'decoration', 'adventure', 'technology', 'magic', 'worldgen', 'library', 'equipment', 'food', 'mobs', 'storage'],
  modpack: ['optimization', 'adventure', 'technology', 'magic', 'multiplayer', 'challenging', 'lightweight', 'quests', 'kitchen-sink'],
  resourcepack: ['16x', '32x', '64x', '128x', 'realistic', 'simplistic', 'vanilla-like', 'themed', 'combat', 'gui'],
  shader: ['realistic', 'semi-realistic', 'cartoon', 'fantasy', 'vanilla-like', 'potato', 'low', 'medium', 'high'],
};
const SORTS: { value: BrowseQuery['sort']; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'follows', label: 'Follows' },
  { value: 'updated', label: 'Recently updated' },
  { value: 'newest', label: 'Newest' },
];

function compatible(hit: ModrinthHit, inst?: InstanceSummary): { ok: boolean; reason?: string } {
  if (!inst || hit.project_type === 'modpack') return { ok: true };
  if (!hit.versions.includes(inst.version)) return { ok: false, reason: `No version for Minecraft ${inst.version}` };
  if (hit.project_type === 'mod') {
    if (inst.loader === 'vanilla') return { ok: false, reason: 'Vanilla profiles cannot use mods' };
    const loaders = inst.loader === 'quilt' ? ['quilt', 'fabric'] : [inst.loader];
    if (!hit.categories.some((c) => loaders.includes(c))) return { ok: false, reason: `Not available for ${loaderName(inst.loader)}` };
  }
  return { ok: true };
}

function useInstall() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const install = async (hit: Pick<ModrinthHit, 'project_id' | 'title' | 'project_type'>, inst?: InstanceSummary) => {
    setBusy((b) => ({ ...b, [hit.project_id]: true }));
    if (hit.project_type === 'modpack') {
      const created = await attempt(() => call('modrinth:install-modpack', hit.project_id), `Could not install ${hit.title}`);
      if (created) {
        void qc.invalidateQueries({ queryKey: qk.instances });
        toast.success(`${hit.title} installed`, 'A new profile was created.', { label: 'Open', run: () => navigate(`/instance/${created.id}`) });
        setDone((d) => ({ ...d, [hit.project_id]: true }));
      }
    } else if (inst) {
      const r = await attempt(() => call('modrinth:install', inst.id, hit.project_id), `Could not install ${hit.title}`);
      if (r) {
        const extra = r.installed.length > 1 ? ` + ${r.installed.length - 1} dependenc${r.installed.length > 2 ? 'ies' : 'y'}` : '';
        toast.success(`Installed ${hit.title}${extra}`, r.warnings.join('\n') || `into ${inst.name}`);
        setDone((d) => ({ ...d, [hit.project_id]: true }));
        void qc.invalidateQueries({ queryKey: ['content', inst.id] });
      }
    }
    setBusy((b) => ({ ...b, [hit.project_id]: false }));
  };
  return { install, busy, done };
}

const HitCard = memo(function HitCard({ hit, inst, busy, done, onInstall, onOpen }: { hit: ModrinthHit; inst?: InstanceSummary; busy?: boolean; done?: boolean; onInstall: () => void; onOpen: () => void }) {
  const c = compatible(hit, inst);
  return (
    <div className="surface p-4 flex flex-col gap-3 hover:border-line-strong transition">
      <button type="button" onClick={onOpen} className="flex gap-3 text-left">
        {hit.icon_url ? (
          <img src={hit.icon_url} alt="" loading="lazy" decoding="async" width={56} height={56} className="w-14 h-14 rounded-lg bg-bg3 shrink-0 object-cover" />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-bg3 grid place-items-center shrink-0"><Package className="w-6 h-6 text-t3" /></div>
        )}
        <div className="min-w-0">
          <div className="font-semibold truncate">{hit.title}</div>
          <div className="text-2xs text-t3 truncate">by {hit.author}</div>
          <div className="text-xs text-t2 mt-1 line-clamp-2">{hit.description}</div>
        </div>
      </button>
      <div className="flex flex-wrap gap-1">
        {(hit.display_categories ?? hit.categories).slice(0, 3).map((cat) => <Chip key={cat}>{cat}</Chip>)}
      </div>
      <div className="mt-auto flex items-center gap-3 text-2xs text-t3 tnum">
        <span className="inline-flex items-center gap-1"><Download className="w-3 h-3" />{formatCompact(hit.downloads)}</span>
        <span className="inline-flex items-center gap-1"><Heart className="w-3 h-3" />{formatCompact(hit.follows)}</span>
        <div className="flex-1" />
        <Button
          size="sm"
          variant={done ? 'secondary' : 'primary'}
          icon={done ? Check : busy ? undefined : Download}
          loading={busy}
          disabled={!c.ok || done || (!inst && hit.project_type !== 'modpack')}
          title={c.reason}
          onClick={onInstall}
        >
          {done ? 'Installed' : hit.project_type === 'modpack' ? 'Install' : c.ok ? 'Install' : 'Incompatible'}
        </Button>
      </div>
    </div>
  );
});

function ProjectModal({ id, inst, onClose, onInstall, busy }: { id: string | null; inst?: InstanceSummary; onClose: () => void; onInstall: (hit: Pick<ModrinthHit, 'project_id' | 'title' | 'project_type'>) => void; busy: boolean }) {
  const project = useQuery({ queryKey: ['modrinth', 'project', id], queryFn: () => call('modrinth:project', id!), enabled: !!id, staleTime: 300_000 });
  const versions = useQuery({ queryKey: ['modrinth', 'versions', id], queryFn: () => call('modrinth:versions', id!), enabled: !!id, staleTime: 300_000 });
  const p = project.data;
  return (
    <Modal open={!!id} onClose={onClose} title={p?.title ?? 'Loading…'} subtitle={p?.description} width={760}
      footer={p && (
        <>
          {p.source_url && <Button variant="ghost" icon={ExternalLink} onClick={() => void call('app:open-external', p.source_url!)}>Source</Button>}
          <Button variant="ghost" icon={ExternalLink} onClick={() => void call('app:open-external', `https://modrinth.com/${p.project_type}/${p.slug}`)}>Modrinth</Button>
          <Button variant="primary" icon={Download} loading={busy} disabled={p.project_type !== 'modpack' && !inst} onClick={() => onInstall({ project_id: p.id, title: p.title, project_type: p.project_type })}>
            {p.project_type === 'modpack' ? 'Install as new profile' : `Install to ${inst?.name ?? '…'}`}
          </Button>
        </>
      )}
    >
      {project.isLoading ? (
        <div className="space-y-3"><Skeleton className="h-40" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
      ) : project.error ? (
        <ErrorCard error={project.error} />
      ) : p ? (
        <div className="flex flex-col gap-5">
          {p.gallery.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {p.gallery.slice(0, 6).map((g) => <img key={g.url} src={g.url} alt={g.title ?? ''} loading="lazy" className="h-36 rounded-md border border-line object-cover" />)}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {p.loaders.map((l) => <Chip key={l} tone="accent">{l}</Chip>)}
            {p.categories.map((c) => <Chip key={c}>{c}</Chip>)}
          </div>
          <div className="text-sm text-t2 whitespace-pre-wrap selectable max-h-60 overflow-y-auto border-l-2 border-line pl-4">{p.body.replace(/<[^>]+>/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').slice(0, 4000)}</div>
          <div>
            <h3 className="label mb-2">Recent versions</h3>
            <div className="flex flex-col gap-1">
              {(versions.data ?? []).slice(0, 8).map((v) => (
                <div key={v.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-line last:border-0">
                  <span className="font-medium text-t1 w-40 truncate">{v.version_number}</span>
                  <Chip tone={v.version_type === 'release' ? 'success' : 'warning'}>{v.version_type}</Chip>
                  <span className="text-t3 truncate flex-1">{v.loaders.join(', ')} · {v.game_versions.slice(-3).join(', ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

export default function Browse() {
  const [params, setParams] = useSearchParams();
  const { instances, selected } = useSelectedInstance();
  const type = (params.get('type') as ProjectType) || 'mod';
  const [target, setTarget] = useState(params.get('instance') || selected?.id || '');
  const inst = instances.find((i) => i.id === target) ?? selected;
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sort, setSort] = useState<BrowseQuery['sort']>('relevance');
  const [cats, setCats] = useState<string[]>([]);
  const [matchProfile, setMatchProfile] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const { install, busy, done } = useInstall();
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(t);
  }, [query]);
  useEffect(() => setCats([]), [type]);
  useEffect(() => {
    if (!target && selected) setTarget(selected.id);
  }, [selected, target]);

  const base = useMemo<Omit<BrowseQuery, 'offset'>>(
    () => ({
      query: debounced,
      type,
      sort,
      categories: cats,
      gameVersion: matchProfile && inst && type !== 'modpack' ? inst.version : undefined,
      loader: matchProfile && inst && type === 'mod' && inst.loader !== 'vanilla' ? inst.loader : undefined,
    }),
    [debounced, type, sort, cats, matchProfile, inst],
  );
  const results = useInfiniteQuery({
    queryKey: ['modrinth', 'search', base],
    queryFn: ({ pageParam }) => call('modrinth:search', { ...base, offset: pageParam, limit: 24 }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.offset + last.limit < last.total_hits ? last.offset + last.limit : undefined),
    staleTime: 300_000,
  });
  const hits = results.data?.pages.flatMap((p) => p.hits) ?? [];
  const total = results.data?.pages[0]?.total_hits ?? 0;

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && results.hasNextPage && !results.isFetchingNextPage && void results.fetchNextPage(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [results]);

  return (
    <div className="page !max-w-none">
      <PageHeader title="Browse" subtitle="Mods, modpacks, resource packs and shaders from Modrinth" />
      <div className="flex gap-6">
        <aside className="w-56 shrink-0 flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            {TYPES.map((t) => (
              <button key={t.value} type="button" onClick={() => setParams({ type: t.value, ...(target ? { instance: target } : {}) })} className={cn('h-9 px-3 rounded-md text-sm text-left font-medium transition', type === t.value ? 'bg-bg3 text-t1' : 'text-t3 hover:text-t1 hover:bg-bg2')}>
                {t.label}
              </button>
            ))}
          </div>
          {type !== 'modpack' && instances.length > 0 && (
            <div>
              <div className="label mb-2">Install to</div>
              <Select label="Install to profile" value={inst?.id ?? ''} onChange={setTarget} options={instances.map((i) => ({ value: i.id, label: i.name, hint: `${loaderName(i.loader)} ${i.version}` }))} />
              <label className="flex items-center gap-2 mt-2 text-xs text-t2">
                <input type="checkbox" className="accent-[var(--accent)]" checked={matchProfile} onChange={(e) => setMatchProfile(e.target.checked)} />
                Only show compatible
              </label>
            </div>
          )}
          <div>
            <div className="label mb-2">Categories</div>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES[type].map((c) => (
                <button key={c} type="button" aria-pressed={cats.includes(c)} onClick={() => setCats((x) => (x.includes(c) ? x.filter((y) => y !== c) : [...x, c]))} className={cn('h-7 px-2.5 rounded-md text-2xs font-medium border transition capitalize', cats.includes(c) ? 'bg-accent-soft border-accent/40 text-accent-hi' : 'border-line-strong text-t3 hover:text-t1')}>
                  {c.replace(/-/g, ' ')}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex gap-3 mb-4">
            <Input className="flex-1" icon={Search} placeholder={`Search ${TYPES.find((t) => t.value === type)?.label.toLowerCase()}…`} value={query} onChange={(e) => setQuery(e.target.value)} right={query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')} className="text-t3 hover:text-t1"><X className="w-4 h-4" /></button>} />
            <Select label="Sort" className="w-48" value={sort} onChange={setSort} options={SORTS} />
          </div>
          <div className="text-xs text-t3 mb-3 tnum h-4">{results.isSuccess && `${total.toLocaleString()} results`}{base.gameVersion && ` for ${base.loader ? `${loaderName(base.loader)} ` : ''}${base.gameVersion}`}</div>
          {results.error ? (
            <ErrorCard title="Could not reach Modrinth" error={results.error} onRetry={() => void results.refetch()} />
          ) : results.isLoading ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="h-48" />)}</div>
          ) : hits.length === 0 ? (
            <EmptyState icon={Search} title="No results" body="Try a different search or remove some filters." />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
              {hits.map((h) => <HitCard key={h.project_id} hit={h} inst={inst} busy={busy[h.project_id]} done={done[h.project_id]} onInstall={() => void install(h, inst)} onOpen={() => setOpen(h.project_id)} />)}
            </div>
          )}
          <div ref={sentinel} className="h-10 grid place-items-center">{results.isFetchingNextPage && <Loader2 className="w-5 h-5 animate-spin text-t3" />}</div>
        </div>
      </div>
      <ProjectModal id={open} inst={inst} onClose={() => setOpen(null)} busy={!!(open && busy[open])} onInstall={(h) => void install(h, inst)} />
    </div>
  );
}
