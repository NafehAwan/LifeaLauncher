import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ChevronLeft, ChevronRight, Copy, FolderOpen, Trash2, X } from 'lucide-react';
import type { Screenshot } from '@shared/types';
import { call } from '../lib/ipc';
import { relativeTime } from '../lib/util';
import { useInstances } from '../hooks/queries';
import { attempt, toast } from '../stores/toasts';
import { EmptyState, IconButton, PageHeader, Skeleton } from '../components/ui/core';
import { Select } from '../components/ui/overlay';

export default function Screenshots() {
  const qc = useQueryClient();
  const { data: instances = [] } = useInstances();
  const [filter, setFilter] = useState('');
  const shots = useQuery({ queryKey: ['screenshots', filter || 'all'], queryFn: () => call('instances:screenshots', filter || undefined) });
  const [open, setOpen] = useState<number | null>(null);
  const list = shots.data ?? [];
  const cur: Screenshot | undefined = open !== null ? list[open] : undefined;
  const name = (id: string) => instances.find((i) => i.id === id)?.name ?? id;

  return (
    <div className="page !max-w-none">
      <PageHeader title="Screenshots" subtitle={`${list.length} screenshot${list.length === 1 ? '' : 's'}`} actions={<Select label="Profile" className="w-56" value={filter} onChange={setFilter} options={[{ value: '', label: 'All profiles' }, ...instances.map((i) => ({ value: i.id, label: i.name }))]} />} />
      {shots.isLoading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-video" />)}</div>
      ) : list.length === 0 ? (
        <EmptyState icon={Camera} title="No screenshots yet" body="Press F2 in game. Screenshots from every profile collect here." />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {list.map((s, i) => (
            <button key={`${s.instanceId}/${s.file}`} type="button" onClick={() => setOpen(i)} className="group relative rounded-lg overflow-hidden border border-line hover:border-line-strong transition aspect-video bg-bg2">
              <img src={s.url} alt={s.file} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-left opacity-0 group-hover:opacity-100 transition">
                <div className="text-xs font-medium truncate">{name(s.instanceId)}</div>
                <div className="text-2xs text-t2">{relativeTime(s.taken)}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      {cur && (
        <div className="fixed inset-0 z-[60] bg-black/90 flex flex-col animate-fade" role="dialog" aria-label="Screenshot viewer">
          <div className="h-14 flex items-center gap-2 px-4">
            <div className="flex-1 text-sm"><span className="font-semibold">{name(cur.instanceId)}</span> <span className="text-t3">· {new Date(cur.taken).toLocaleString()}</span></div>
            <IconButton icon={Copy} label="Copy file name" onClick={() => { void call('app:copy', cur.file); toast.info('Copied file name'); }} />
            <IconButton icon={FolderOpen} label="Open folder" onClick={() => void call('instances:open-folder', cur.instanceId, 'screenshots')} />
            <IconButton icon={Trash2} label="Delete" onClick={() => void attempt(async () => {
              await call('instances:delete-screenshot', cur.instanceId, cur.file);
              setOpen(null);
              void qc.invalidateQueries({ queryKey: ['screenshots'] });
            }, 'Could not delete')} />
            <IconButton icon={X} label="Close" onClick={() => setOpen(null)} />
          </div>
          <div className="flex-1 flex items-center justify-center gap-4 px-4 pb-6 min-h-0">
            <IconButton icon={ChevronLeft} label="Previous" disabled={open === 0} onClick={() => setOpen((o) => (o! > 0 ? o! - 1 : o))} />
            <img src={cur.url} alt={cur.file} className="max-h-full max-w-[85vw] rounded-lg" />
            <IconButton icon={ChevronRight} label="Next" disabled={open === list.length - 1} onClick={() => setOpen((o) => (o! < list.length - 1 ? o! + 1 : o))} />
          </div>
        </div>
      )}
    </div>
  );
}
