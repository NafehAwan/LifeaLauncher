import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Download, FolderOpen, LayoutGrid, MoreHorizontal, Package, Play, Plus, Search, Trash2 } from 'lucide-react';
import type { InstanceSummary } from '@shared/types';
import { call } from '../lib/ipc';
import { cn, formatPlaytime, loaderName, relativeTime } from '../lib/util';
import { qk, useInstances } from '../hooks/queries';
import { isActive, useLaunch } from '../stores/launch';
import { useSettings } from '../stores/settings';
import { useUi } from '../stores/ui';
import { attempt, toast } from '../stores/toasts';
import { InstanceIcon } from '../components/InstanceIcon';
import { Button, Chip, EmptyState, ErrorCard, IconButton, Input, PageHeader, Skeleton } from '../components/ui/core';
import { ConfirmModal, Menu } from '../components/ui/overlay';

const ProfileCard = memo(function ProfileCard({ inst, selected, onDelete }: { inst: InstanceSummary; selected: boolean; onDelete: (i: InstanceSummary) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const active = useLaunch((s) => isActive(s.states[inst.id]));
  const running = useLaunch((s) => s.states[inst.id]?.status === 'running');
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/instance/${inst.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/instance/${inst.id}`)}
      className={cn('group surface p-4 flex gap-4 h-[120px] transition duration-2 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-2 cursor-pointer', selected && 'border-accent/50')}
    >
      <InstanceIcon icon={inst.icon} size={56} />
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-t1 truncate">{inst.name}</div>
            <div className="text-xs text-t3 mt-0.5">
              {running ? <span className="text-success">Playing now</span> : inst.lastPlayed ? `Played ${relativeTime(inst.lastPlayed)}` : 'Never played'}
              {inst.playtimeMs > 0 && ` · ${formatPlaytime(inst.playtimeMs)}`}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
            <Menu
              trigger={({ toggle }) => <IconButton icon={MoreHorizontal} label="Profile actions" size="sm" onClick={toggle} />}
              items={[
                { label: 'Open folder', icon: FolderOpen, onSelect: () => void attempt(() => call('instances:open-folder', inst.id), 'Could not open folder') },
                {
                  label: 'Duplicate',
                  icon: Copy,
                  onSelect: () =>
                    void attempt(async () => {
                      const copy = await call('instances:duplicate', inst.id);
                      void qc.invalidateQueries({ queryKey: qk.instances });
                      toast.success(`Created ${copy.name}`);
                    }, 'Could not duplicate'),
                },
                {
                  label: 'Export .mrpack',
                  icon: Download,
                  onSelect: () =>
                    void attempt(async () => {
                      const path = await call('instances:export-mrpack', inst.id);
                      if (path) toast.success('Modpack exported', path);
                    }, 'Export failed'),
                },
                'sep',
                { label: 'Delete', icon: Trash2, danger: true, disabled: active, onSelect: () => onDelete(inst) },
              ]}
            />
          </div>
        </div>
        <div className="mt-auto flex items-center gap-1.5">
          <Chip>{inst.version}</Chip>
          <Chip tone={inst.loader === 'vanilla' ? 'default' : 'accent'}>{loaderName(inst.loader)}</Chip>
          {inst.modCount > 0 && <Chip>{inst.modCount} mods</Chip>}
          <div className="flex-1" />
          <button
            type="button"
            aria-label={`Play ${inst.name}`}
            disabled={active}
            onClick={(e) => {
              e.stopPropagation();
              void attempt(() => call('launch:start', inst.id), 'Could not start Minecraft');
            }}
            className="w-9 h-9 rounded-md bg-accent text-white grid place-items-center opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-accent-hi transition disabled:opacity-40"
          >
            <Play className="w-4 h-4" fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default function Library() {
  const { data, isLoading, error, refetch } = useInstances();
  const selectedId = useSettings((s) => s.settings.selectedInstanceId);
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [toDelete, setToDelete] = useState<InstanceSummary | null>(null);
  const list = (data ?? []).filter((i) => !q || `${i.name} ${i.version} ${i.loader}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="page">
      <PageHeader
        title="Library"
        subtitle={data ? `${data.length} profile${data.length === 1 ? '' : 's'}` : undefined}
        actions={
          <>
            <Button
              icon={Package}
              loading={importing}
              onClick={async () => {
                setImporting(true);
                const inst = await attempt(() => call('instances:import-mrpack'), 'Import failed');
                setImporting(false);
                if (inst) {
                  void qc.invalidateQueries({ queryKey: qk.instances });
                  toast.success(`Imported ${inst.name}`);
                }
              }}
            >
              Import .mrpack
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => useUi.getState().set({ newProfile: true })}>New profile</Button>
          </>
        }
      />
      <div className="mb-5 max-w-sm">
        <Input icon={Search} placeholder="Search profiles" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error ? (
        <ErrorCard title="Could not load profiles" error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[120px]" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={q ? 'No profiles match' : 'No profiles yet'}
          body={q ? 'Try a different search.' : 'Create a profile for any Minecraft version, or import a Modrinth modpack.'}
          action={!q && <Button variant="primary" icon={Plus} onClick={() => useUi.getState().set({ newProfile: true })}>New profile</Button>}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
          {list.map((i) => <ProfileCard key={i.id} inst={i} selected={i.id === selectedId} onDelete={setToDelete} />)}
        </div>
      )}
      <ConfirmModal
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        danger
        title={`Delete “${toDelete?.name}”?`}
        body="This removes the profile folder, including its worlds, mods and screenshots. This cannot be undone."
        confirmLabel="Delete profile"
        onConfirm={() =>
          toDelete &&
          void attempt(async () => {
            await call('instances:remove', toDelete.id);
            void qc.invalidateQueries({ queryKey: qk.instances });
            toast.info(`Deleted ${toDelete.name}`);
          }, 'Could not delete')
        }
      />
    </div>
  );
}
