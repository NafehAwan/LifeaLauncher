import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, LogOut, Plus, UserRound } from 'lucide-react';
import { call } from '../../lib/ipc';
import { qk, useAccounts, useSelectedAccount } from '../../hooks/queries';
import { useUi } from '../../stores/ui';
import { attempt, toast } from '../../stores/toasts';
import { useSettings } from '../../stores/settings';
import { SkinHead } from '../SkinHead';
import { Menu } from '../ui/overlay';
import { Button, Field, Input } from '../ui/core';
import { Modal } from '../ui/overlay';
import { OFFLINE_NAME_RE } from '@shared/constants';
import { useAppInfo } from '../../hooks/useAppInfo';

export function AccountMenu() {
  const { data: accounts = [] } = useAccounts();
  const selected = useSelectedAccount();
  const qc = useQueryClient();
  const select = async (id: string) => {
    await attempt(() => call('accounts:select', id), 'Could not switch account');
    await useSettings.getState().patch({ selectedAccountId: id });
    void qc.invalidateQueries({ queryKey: qk.accounts });
  };
  return (
    <Menu
      align="left"
      width={260}
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle} aria-label="Account" className="relative rounded-md p-1 hover:bg-bg2 transition" title={selected ? selected.username : 'Add an account'}>
          {selected ? <SkinHead skinUrl={selected.skinUrl} size={34} /> : <div className="w-[34px] h-[34px] rounded-md bg-bg3 grid place-items-center"><UserRound className="w-4 h-4 text-t3" /></div>}
          {selected && <span className={`absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-bg1 ${selected.type === 'msa' ? 'bg-success' : 'bg-t3'}`} />}
        </button>
      )}
      items={[
        ...accounts.map((a) => ({
          label: `${a.username}${a.type === 'offline' ? ' (offline)' : ''}`,
          icon: a.id === selected?.id ? Check : UserRound,
          onSelect: () => void select(a.id),
        })),
        ...(accounts.length ? (['sep'] as const) : []),
        { label: 'Add account', icon: Plus, onSelect: () => useUi.getState().set({ addAccount: true }) },
        ...(selected
          ? [{
              label: `Sign out ${selected.username}`,
              icon: LogOut,
              danger: true,
              onSelect: () =>
                void attempt(async () => {
                  await call('accounts:remove', selected.id);
                  void qc.invalidateQueries({ queryKey: qk.accounts });
                  toast.info(`Signed out ${selected.username}`);
                }, 'Could not sign out'),
            }]
          : []),
      ]}
    />
  );
}

export function AddAccountModal() {
  const open = useUi((s) => s.addAccount);
  const close = () => useUi.getState().set({ addAccount: false });
  const qc = useQueryClient();
  const info = useAppInfo();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState<'msa' | 'offline' | null>(null);
  const invalid = name.length > 0 && !OFFLINE_NAME_RE.test(name);

  const done = (username: string) => {
    void qc.invalidateQueries({ queryKey: qk.accounts });
    toast.success(`Signed in as ${username}`);
    setName('');
    close();
  };

  return (
    <Modal open={open} onClose={close} title="Add an account" subtitle="Microsoft accounts can join online servers. Offline accounts are for singleplayer and LAN.">
      <div className="flex flex-col gap-5">
        <div className="surface p-4">
          <div className="font-semibold text-t1">Microsoft account</div>
          <p className="text-xs text-t3 mt-1">
            {info?.msaConfigured
              ? 'Sign in with the account that owns Minecraft: Java Edition.'
              : 'Microsoft login is not configured in this build (it needs a Mojang-approved Azure app ID).'}
          </p>
          <Button
            className="mt-3"
            variant="primary"
            disabled={!info?.msaConfigured}
            loading={busy === 'msa'}
            onClick={async () => {
              setBusy('msa');
              const acc = await attempt(() => call('accounts:login-microsoft'), 'Microsoft sign-in failed');
              setBusy(null);
              if (acc) done(acc.username);
            }}
          >
            Sign in with Microsoft
          </Button>
        </div>
        <form
          className="surface p-4 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!OFFLINE_NAME_RE.test(name)) return;
            setBusy('offline');
            const acc = await attempt(() => call('accounts:add-offline', name), 'Could not add offline account');
            setBusy(null);
            if (acc) done(acc.username);
          }}
        >
          <div className="font-semibold text-t1">Offline account</div>
          <Field label="Username" error={invalid ? 'Use 3–16 letters, numbers or underscores.' : null}>
            <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 16))} placeholder="Steve" invalid={invalid} autoFocus />
          </Field>
          <div>
            <Button type="submit" disabled={!OFFLINE_NAME_RE.test(name)} loading={busy === 'offline'}>
              Add offline account
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
