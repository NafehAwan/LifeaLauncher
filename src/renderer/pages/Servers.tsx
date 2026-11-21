import { PARTNERED_SERVERS } from '@shared/constants';
import { useSelectedInstance } from '../hooks/queries';
import { ServerCard } from '../components/ServerCard';
import { PageHeader } from '../components/ui/core';

export default function Servers() {
  const { selected } = useSelectedInstance();
  return (
    <div className="page">
      <PageHeader title="Partnered servers" subtitle={selected ? `Join buttons launch ${selected.name}` : 'Official Lifea partner servers'} />
      <div className="mb-4 max-w-3xl">
        <div className="label mb-2">LIFEA PARTNERS</div>
        {PARTNERED_SERVERS.map((server) => (
          <div key={server.id} className="rounded-xl border border-accent/25 bg-bg2/90 p-1 shadow-[0_8px_28px_rgba(0,0,0,0.18)]">
            <ServerCard name={server.name} address={server.address} instanceId={selected?.id} subtitle={server.subtitle} partnered />
          </div>
        ))}
      </div>
    </div>
  );
}
