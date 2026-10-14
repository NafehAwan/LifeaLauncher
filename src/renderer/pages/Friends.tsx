import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Check, MessageSquare, Send, Trash2, UserPlus, Users, X } from 'lucide-react';
import { call } from '../lib/ipc';
import { cn, relativeTime } from '../lib/util';
import { qk } from '../hooks/queries';
import { attempt, toast } from '../stores/toasts';
import { PresenceDot, presenceText, useSocial } from '../components/shell/FriendsDrawer';
import { SkinHead } from '../components/SkinHead';
import { Button, EmptyState, IconButton, Input, PageHeader, Skeleton } from '../components/ui/core';

function Chat({ uuid, name }: { uuid: string; name: string }) {
  const qc = useQueryClient();
  const msgs = useQuery({ queryKey: ['social', 'messages', uuid], queryFn: () => call('social:messages', uuid), refetchInterval: false });
  const [body, setBody] = useState('');
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [msgs.data]);
  return (
    <div className="surface flex flex-col h-[520px]">
      <div className="h-12 px-4 border-b border-line flex items-center gap-2 font-semibold"><MessageSquare className="w-4 h-4 text-t3" /> {name}</div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
        {msgs.isLoading && <Skeleton className="h-10 w-1/2" />}
        {msgs.data?.length === 0 && <div className="text-sm text-t3 m-auto">Say hi 👋</div>}
        {msgs.data?.map((m) => (
          <div key={m.id} className={cn('max-w-[75%] rounded-lg px-3 py-2 text-sm selectable', m.from === uuid ? 'bg-bg3 self-start' : 'bg-accent/80 text-white self-end')}>
            {m.body}
            <div className="text-[10px] opacity-60 mt-0.5">{relativeTime(m.sentAt)}</div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="p-3 border-t border-line flex gap-2" onSubmit={async (e) => {
        e.preventDefault();
        if (!body.trim()) return;
        const text = body.trim();
        setBody('');
        await attempt(() => call('social:send-message', uuid, text), 'Message not sent');
        void qc.invalidateQueries({ queryKey: ['social', 'messages', uuid] });
      }}>
        <Input className="flex-1" value={body} onChange={(e) => setBody(e.target.value.slice(0, 1000))} placeholder={`Message ${name}`} />
        <Button type="submit" variant="primary" icon={Send} disabled={!body.trim()}>Send</Button>
      </form>
    </div>
  );
}

export default function Friends() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const { status, friends, loading } = useSocial();
  const requests = useQuery({ queryKey: [...qk.social, 'requests'], queryFn: () => call('social:requests'), enabled: !!status?.signedIn });
  const [name, setName] = useState('');
  const active = params.get('u');
  const activeFriend = friends.find((f) => f.uuid === active);
  const refresh = () => qc.invalidateQueries({ queryKey: qk.social });

  if (!status?.signedIn) {
    return (
      <div className="page">
        <PageHeader title="Friends" />
        <EmptyState
          icon={Users}
          title="Friends need a Lifea account"
          body={status?.error ?? 'Sign in with Microsoft to add friends, see what they are playing, chat and join them.'}
          action={<Button variant="primary" onClick={() => void call('social:connect').then(refresh)}>Try again</Button>}
        />
      </div>
    );
  }

  const incoming = (requests.data ?? []).filter((r) => r.incoming);
  const outgoing = (requests.data ?? []).filter((r) => !r.incoming);
  return (
    <div className="page !max-w-[1100px]">
      <PageHeader title="Friends" subtitle={`${friends.filter((f) => f.presence.state !== 'offline').length} online · signed in as ${status.self?.username}`} />
      <div className="grid grid-cols-[340px_1fr] gap-6">
        <div className="flex flex-col gap-4">
          <form className="flex gap-2" onSubmit={async (e) => {
            e.preventDefault();
            if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) return toast.error('Enter a valid Minecraft username');
            const ok = await attempt(() => call('social:send-request', name), 'Could not send request');
            if (ok !== undefined) {
              toast.success(`Friend request sent to ${name}`);
              setName('');
              void refresh();
            }
          }}>
            <Input className="flex-1" value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} placeholder="Add by username" />
            <Button type="submit" icon={UserPlus} variant="primary">Add</Button>
          </form>
          {incoming.length > 0 && (
            <div className="surface p-3">
              <div className="label mb-2">Requests</div>
              {incoming.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-1.5">
                  <SkinHead skinUrl={`https://mc-heads.net/skin/${r.from.uuid}`} size={26} />
                  <span className="flex-1 text-sm truncate">{r.from.username}</span>
                  <IconButton icon={Check} label="Accept" size="sm" onClick={() => void attempt(() => call('social:respond', r.id, true), 'Failed').then(refresh)} />
                  <IconButton icon={X} label="Decline" size="sm" onClick={() => void attempt(() => call('social:respond', r.id, false), 'Failed').then(refresh)} />
                </div>
              ))}
            </div>
          )}
          <div className="surface p-2">
            {loading ? <Skeleton className="h-20" /> : friends.length === 0 ? <div className="p-4 text-sm text-t3">No friends yet.</div> : friends.map((f) => (
              <div key={f.uuid} className={cn('group flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-bg3', active === f.uuid && 'bg-bg3')} onClick={() => setParams({ u: f.uuid })}>
                <div className="relative">
                  <SkinHead skinUrl={`https://mc-heads.net/skin/${f.uuid}`} size={32} />
                  <span className="absolute -bottom-0.5 -right-0.5"><PresenceDot state={f.presence.state} /></span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{f.username}</div>
                  <div className="text-2xs text-t3 truncate">{presenceText(f)}</div>
                </div>
                <div className="opacity-0 group-hover:opacity-100">
                  <IconButton icon={Trash2} size="sm" label={`Remove ${f.username}`} onClick={(e) => {
                    e.stopPropagation();
                    void attempt(() => call('social:remove-friend', f.uuid), 'Failed').then(refresh);
                  }} />
                </div>
              </div>
            ))}
          </div>
          {outgoing.length > 0 && <div className="text-2xs text-t3">Pending: {outgoing.map((r) => r.to.username).join(', ')}</div>}
        </div>
        {activeFriend ? <Chat uuid={activeFriend.uuid} name={activeFriend.username} /> : <div className="surface grid place-items-center h-[520px] text-sm text-t3">Pick a friend to chat</div>}
      </div>
    </div>
  );
}
