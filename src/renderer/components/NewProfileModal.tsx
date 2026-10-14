/** New profile: name, icon, any Minecraft version from Mojang's manifest, and a loader checked for availability live. */
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { LOADERS } from '@shared/constants';
import type { Loader } from '@shared/types';
import { call } from '../lib/ipc';
import { cn } from '../lib/util';
import { qk } from '../hooks/queries';
import { useUi } from '../stores/ui';
import { useSettings } from '../stores/settings';
import { attempt, toast } from '../stores/toasts';
import { Button, ErrorCard, Field, Input, Skeleton, Toggle } from './ui/core';
import { Modal, Select } from './ui/overlay';
import { InstanceIcon, INSTANCE_ICON_IDS } from './InstanceIcon';

export function NewProfileModal() {
  const open = useUi((s) => s.newProfile);
  const close = () => useUi.getState().set({ newProfile: false });
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('grass');
  const [snapshots, setSnapshots] = useState(false);
  const [filter, setFilter] = useState('');
  const [version, setVersion] = useState('');
  const [loader, setLoader] = useState<Loader>('fabric');
  const [loaderVersion, setLoaderVersion] = useState('');
  const [busy, setBusy] = useState(false);

  const versions = useQuery({ queryKey: qk.versions(snapshots), queryFn: () => call('versions:list', snapshots), enabled: open, staleTime: 3600_000 });
  const loaders = useQuery({ queryKey: qk.loaders(version), queryFn: () => call('versions:loaders', version), enabled: open && !!version, staleTime: 3600_000 });

  useEffect(() => {
    if (open && !version && versions.data?.length) setVersion(versions.data[0].id);
  }, [open, version, versions.data]);

  const available = (l: Loader) => (l === 'vanilla' ? true : (loaders.data?.[l]?.length ?? 0) > 0);
  useEffect(() => {
    if (loaders.data && !available(loader)) setLoader(available('fabric') ? 'fabric' : 'vanilla');
    setLoaderVersion('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaders.data]);

  const shown = useMemo(() => {
    const list = versions.data ?? [];
    const f = filter.trim();
    return (f ? list.filter((v) => v.id.includes(f)) : list).slice(0, 120);
  }, [versions.data, filter]);

  const loaderVersions = loader === 'vanilla' ? [] : (loaders.data?.[loader] ?? []);

  const create = async () => {
    setBusy(true);
    const inst = await attempt(
      () => call('instances:create', { name: name.trim() || `${LOADERS.find((l) => l.id === loader)?.name} ${version}`, version, loader, loaderVersion: loaderVersion || undefined, icon }),
      'Could not create profile',
    );
    setBusy(false);
    if (!inst) return;
    await useSettings.getState().patch({ selectedInstanceId: inst.id });
    void qc.invalidateQueries({ queryKey: qk.instances });
    toast.success(`Created ${inst.name}`, undefined, { label: 'Open', run: () => navigate(`/instance/${inst.id}`) });
    setName('');
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="New profile"
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={close}>Cancel</Button>
          <Button variant="primary" onClick={() => void create()} loading={busy} disabled={!version}>Create profile</Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <Field label="Name">
          <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 48))} placeholder={`${LOADERS.find((l) => l.id === loader)?.name ?? ''} ${version}`} />
        </Field>
        <Field label="Icon">
          <div className="flex gap-1.5">
            {INSTANCE_ICON_IDS.map((i) => (
              <button key={i} type="button" aria-label={`Icon ${i}`} aria-pressed={icon === i} onClick={() => setIcon(i)} className={cn('rounded-[12px] transition', icon === i ? 'ring-2 ring-accent' : 'opacity-70 hover:opacity-100')}>
                <InstanceIcon icon={i} size={36} />
              </button>
            ))}
          </div>
        </Field>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-t2">Minecraft version</span>
          <label className="flex items-center gap-2 text-xs text-t3">
            Snapshots <Toggle checked={snapshots} onChange={setSnapshots} label="Show snapshots" />
          </label>
        </div>
        <Input icon={Search} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter versions (e.g. 1.20)" />
        <div className="mt-2 h-40 overflow-y-auto rounded-md border border-line bg-bg1 p-1.5 grid grid-cols-5 gap-1.5 content-start">
          {versions.isLoading && Array.from({ length: 15 }, (_, i) => <Skeleton key={i} className="h-8" />)}
          {versions.error && <div className="col-span-5"><ErrorCard title="Could not load versions" error={versions.error} onRetry={() => void versions.refetch()} /></div>}
          {shown.map((v) => (
            <button key={v.id} type="button" onClick={() => setVersion(v.id)} className={cn('h-8 rounded-md text-xs font-medium tnum transition', version === v.id ? 'bg-accent text-white' : 'bg-bg3 text-t2 hover:text-t1 hover:bg-bg4')}>
              {v.id}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <span className="text-xs font-medium text-t2">Mod loader</span>
        <div className="grid grid-cols-5 gap-2 mt-2">
          {LOADERS.map((l) => {
            const ok = available(l.id);
            return (
              <button
                key={l.id}
                type="button"
                disabled={!ok || loaders.isLoading}
                onClick={() => setLoader(l.id)}
                title={ok ? undefined : `${l.name} has no build for ${version}`}
                className={cn('h-14 rounded-md border text-sm font-semibold transition flex flex-col items-center justify-center', loader === l.id ? 'border-accent bg-accent-soft text-t1' : 'border-line-strong bg-bg2 text-t2 hover:text-t1', !ok && 'opacity-35')}
              >
                {l.name}
                <span className="text-2xs font-normal text-t3">{l.id === 'vanilla' ? 'No mods' : loaders.isLoading ? '…' : ok ? 'Available' : 'Unavailable'}</span>
              </button>
            );
          })}
        </div>
        {loaderVersions.length > 0 && (
          <div className="mt-3 max-w-xs">
            <Select label="Loader version" value={loaderVersion} onChange={setLoaderVersion} options={[{ value: '', label: `Latest recommended (${loaderVersions[0]})` }, ...loaderVersions.slice(0, 40).map((v) => ({ value: v, label: v }))]} />
          </div>
        )}
      </div>
    </Modal>
  );
}
