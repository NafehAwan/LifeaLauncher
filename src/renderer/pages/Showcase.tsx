/** Dev-only component gallery (excluded from production builds). Every control in every state, for visual review. */
import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { Button, Chip, EmptyState, ErrorCard, IconButton, Input, PageHeader, ProgressBar, Segmented, Skeleton, Slider, Tabs, Toggle } from '../components/ui/core';
import { INSTANCE_ICON_IDS, InstanceIcon } from '../components/InstanceIcon';
import { toast } from '../stores/toasts';

export default function Showcase() {
  const [t, setT] = useState(true);
  const [s, setS] = useState(40);
  const [seg, setSeg] = useState<'a' | 'b' | 'c'>('a');
  return (
    <div className="page flex flex-col gap-8">
      <PageHeader title="Showcase" subtitle="Dev-only component gallery" />
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" icon={Plus}>Primary</Button>
        <Button>Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger" icon={Trash2}>Danger</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
        <IconButton icon={Search} label="Icon" />
      </div>
      <div className="flex flex-wrap gap-2"><Chip>Default</Chip><Chip tone="accent">Accent</Chip><Chip tone="success">Success</Chip><Chip tone="warning">Warning</Chip><Chip tone="danger">Danger</Chip></div>
      <div className="grid grid-cols-2 gap-6 max-w-3xl">
        <Input icon={Search} placeholder="Input" />
        <Input invalid placeholder="Invalid" />
        <div className="flex items-center gap-3"><Toggle checked={t} onChange={setT} label="Toggle" /> Toggle</div>
        <Slider label="Slider" min={0} max={100} value={s} onChange={setS} marker={{ value: 60, label: 'Recommended' }} />
        <Segmented value={seg} onChange={setSeg} options={[{ value: 'a', label: 'One' }, { value: 'b', label: 'Two' }, { value: 'c', label: 'Three' }]} />
        <ProgressBar value={s / 100} sheen />
      </div>
      <Tabs value={seg} onChange={setSeg} tabs={[{ value: 'a', label: 'Tab A' }, { value: 'b', label: 'Tab B', count: 3 }, { value: 'c', label: 'Tab C' }]} />
      <div className="flex gap-2">{INSTANCE_ICON_IDS.map((i) => <InstanceIcon key={i} icon={i} />)}</div>
      <div className="grid grid-cols-3 gap-3"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      <EmptyState icon={Search} title="Empty state" body="One sentence and a primary action." action={<Button variant="primary">Action</Button>} />
      <ErrorCard error={new Error('Example failure message')} onRetry={() => undefined} />
      <div className="flex gap-2">
        <Button onClick={() => toast.success('Saved', 'Detail text')}>Toast success</Button>
        <Button onClick={() => toast.error('Failed', 'Something went wrong')}>Toast error</Button>
      </div>
    </div>
  );
}
