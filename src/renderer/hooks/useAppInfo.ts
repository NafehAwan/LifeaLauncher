import { useQuery } from '@tanstack/react-query';
import { call } from '../lib/ipc';

export function useAppInfo() {
  return useQuery({ queryKey: ['app-info'], queryFn: () => call('app:info'), staleTime: Infinity }).data;
}
