import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Server as ServerIcon, Trash2 } from 'lucide-react';
import type { Server } from '@shared/types';
import { PARTNERED_SERVERS } from '@shared/constants';
import { call } from '../lib/ipc';
import { qk, useSelectedInstance, useServers } from '../hooks/queries';
import { attempt, toast } from '../stores/toasts';
import { ServerCard } from '../components/ServerCard';
import { Button, EmptyState, Field, IconButton, Input, PageHeader, Skeleton } from '../components/ui/core';
import { Modal } from '../components/ui/overlay';

function ServerModal({ server, onClose }: { server: Partial<Server>; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(server.name ?? '');
  const [address, setAddress] = useState(server.address ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const s = await attempt(() => call('servers:save', { id: server.id, name, address }), 'Could not save server');
    setBusy(false);
    if (!s) return;
    void qc.invalidateQueries({ queryKey: qk.servers });
    toast.success(`Saved ${s.name}`);
    onClose();
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={server.id ? 'Edit server' : 'Add server'}
      subtitle="Saved servers also appear in every profile's in-game server list."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={!address.trim()} onClick={() => void save()}>Save</Button>
        </>
      }
    >
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); if (address.trim()) void save(); }}>
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My server" autoFocus /></Field>
        <Field label="Address" hint="Host or host:port. SRV records are resolved automatically.">
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="play.example.net" />
        </Field>
      </form>
    </Modal>
  );
}

export default function Servers() {
  const qc = useQueryClient();
  const { data: servers = [], isLoading } = useServers();
  const { selected } = useSelectedInstance();
  const [editing, setEditing] = useState<Partial<Server> | null>(null);
  const move = async (i: number, d: number) => {
    const ids = servers.map((s) => s.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await attempt(() => call('servers:reorder', ids), 'Could not reorder');
    void qc.invalidateQueries({ queryKey: qk.servers });
  };
  const remove = (s: Server) =>
    void attempt(async () => {
      await call('servers:remove', s.id);
      void qc.invalidateQueries({ queryKey: qk.servers });
    }, 'Could not remove server');

  return (
    <div className="page">
      <PageHeader
        title="Servers"
        subtitle={selected ? `Join buttons launch ${selected.name}` : 'Saved servers and Lifea partners'}
        actions={<Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add server</Button>}
      />

      <section className="mb-8 max-w-3xl">
        <h2 className="label mb-2">Lifea partners</h2>
        <div className="flex flex-col gap-2">
          {PARTNERED_SERVERS.map((server) => (
            <div key={server.id} className="rounded-xl border border-accent/25 bg-bg2/90 p-1">
              <ServerCard name={server.name} address={server.address} instanceId={selected?.id} subtitle={server.subtitle} partnered />
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-3xl">
        <h2 className="label mb-2">Your servers</h2>
        {isLoading ? (
          <Skeleton className="h-20" />
        ) : servers.length === 0 ? (
          <EmptyState icon={ServerIcon} title="No saved servers" body="Add servers to see who is online and join in one click." action={<Button variant="primary" icon={Plus} onClick={() => setEditing({})}>Add server</Button>} />
        ) : (
          <div className="flex flex-col gap-2">
            {servers.map((s, i) => (
              <div key={s.id} className="group flex items-center gap-2">
                <div className="flex flex-col opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
                  <IconButton icon={ArrowUp} size="sm" label={`Move ${s.name} up`} disabled={i === 0} onClick={() => void move(i, -1)} />
                  <IconButton icon={ArrowDown} size="sm" label={`Move ${s.name} down`} disabled={i === servers.length - 1} onClick={() => void move(i, 1)} />
                </div>
                <div className="flex-1 min-w-0"><ServerCard name={s.name} address={s.address} instanceId={selected?.id} /></div>
                <div className="flex opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition">
                  <IconButton icon={Pencil} label={`Edit ${s.name}`} onClick={() => setEditing(s)} />
                  <IconButton icon={Trash2} label={`Remove ${s.name}`} onClick={() => remove(s)} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {editing && <ServerModal server={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
