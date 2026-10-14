/** React Query bindings for main-process data, invalidated by main → renderer events. */
import { useEffect } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { call, on } from '../lib/ipc';
import { useSettings } from '../stores/settings';

export const qk = {
  instances: ['instances'] as const,
  content: (id: string, kind: string) => ['content', id, kind] as const,
  accounts: ['accounts'] as const,
  servers: ['servers'] as const,
  versions: (snap: boolean) => ['versions', snap] as const,
  loaders: (mc: string) => ['loaders', mc] as const,
  boost: (id: string) => ['boost', id] as const,
  social: ['social'] as const,
};

/** Wire main-process change events to cache invalidation. Call once at the root. */
export function useLiveInvalidation(qc: QueryClient): void {
  useEffect(() => {
    const offs = [
      on('instances:changed', (p) => {
        void qc.invalidateQueries({ queryKey: qk.instances });
        if (p.id) void qc.invalidateQueries({ queryKey: ['content', p.id] });
        void qc.invalidateQueries({ queryKey: ['boost'] });
      }),
      // Account selection lives in settings; refresh account-dependent UI whenever settings change.
      on('settings:changed', () => void qc.invalidateQueries({ queryKey: qk.accounts })),
      on('social:event', (ev) => {
        if (ev.type === 'friends-changed' || ev.type === 'presence' || ev.type === 'status') void qc.invalidateQueries({ queryKey: qk.social });
        if (ev.type === 'message') void qc.invalidateQueries({ queryKey: ['social', 'messages'] });
      }),
    ];
    return () => offs.forEach((o) => o());
  }, [qc]);
}

export function useInstances() {
  return useQuery({ queryKey: qk.instances, queryFn: () => call('instances:list'), staleTime: 30_000 });
}

export function useSelectedInstance() {
  const { data, ...rest } = useInstances();
  const selectedId = useSettings((s) => s.settings.selectedInstanceId);
  const selected = data?.find((i) => i.id === selectedId) ?? data?.[0];
  return { instances: data ?? [], selected, ...rest };
}

export function useAccounts() {
  return useQuery({ queryKey: qk.accounts, queryFn: () => call('accounts:list'), staleTime: 60_000 });
}

export function useSelectedAccount() {
  const { data } = useAccounts();
  const id = useSettings((s) => s.settings.selectedAccountId);
  return data?.find((a) => a.id === id) ?? data?.[0];
}

export function useServers() {
  return useQuery({ queryKey: qk.servers, queryFn: () => call('servers:list'), staleTime: 60_000 });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (key: readonly unknown[]) => qc.invalidateQueries({ queryKey: key });
}
