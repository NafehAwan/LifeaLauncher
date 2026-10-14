import { lazy, Suspense, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, ImagePlus, Shirt, Sparkles, Trash2, Upload, User } from 'lucide-react';
import type { CosmeticItem, CosmeticType } from '@shared/types';
import { call } from '../lib/ipc';
import { cn } from '../lib/util';
import { qk, useSelectedAccount } from '../hooks/queries';
import { attempt, toast } from '../stores/toasts';
import { Button, Chip, EmptyState, IconButton, PageHeader, Segmented, Spinner, Tabs } from '../components/ui/core';

const ModelViewer = lazy(() => import('../components/ModelViewer'));

type Tab = 'skins' | 'capes' | 'cosmetics';

export default function Wardrobe() {
  const qc = useQueryClient();
  const account = useSelectedAccount();
  const [tab, setTab] = useState<Tab>('skins');
  const [anim, setAnim] = useState<'idle' | 'walk' | 'wave'>('idle');
  const [back, setBack] = useState(false);
  const [slim, setSlim] = useState(account?.skinVariant === 'slim');
  const [skin, setSkin] = useState<string | undefined>();
  const [cape, setCape] = useState<string | undefined>();
  const skins = useQuery({ queryKey: ['wardrobe', 'skins'], queryFn: () => call('wardrobe:list', 'skins') });
  const capes = useQuery({ queryKey: ['wardrobe', 'capes'], queryFn: () => call('wardrobe:list', 'capes') });
  const social = useQuery({ queryKey: [...qk.social, 'status'], queryFn: () => call('social:status') });
  const catalog = useQuery({ queryKey: [...qk.social, 'catalog'], queryFn: () => call('social:catalog'), enabled: tab === 'cosmetics' });
  const equipped = useQuery({ queryKey: [...qk.social, 'equipped'], queryFn: () => call('social:equipped'), enabled: tab === 'cosmetics' && !!social.data?.signedIn });

  const skinUrl = skin ?? account?.skinUrl;
  const capeUrl = cape ?? account?.capeUrl;
  const items = tab === 'skins' ? skins.data ?? [] : capes.data ?? [];

  const importFiles = async (kind: 'skins' | 'capes') => {
    const added = await attempt(() => call('wardrobe:import', kind), 'Import failed');
    if (added?.length) {
      toast.success(`Added ${added.length} ${kind === 'skins' ? 'skin' : 'cape'}${added.length > 1 ? 's' : ''}`);
      void qc.invalidateQueries({ queryKey: ['wardrobe', kind] });
    }
  };

  const equip = async (item: CosmeticItem) => {
    const isOn = equipped.data?.[item.type] === item.id;
    const r = await attempt(() => call('social:equip', item.type, isOn ? null : item.id), 'Could not equip');
    if (r) qc.setQueryData([...qk.social, 'equipped'], r);
  };

  return (
    <div className="page !max-w-none">
      <PageHeader title="Wardrobe" subtitle="Skins, capes and Lifea cosmetics" />
      <div className="flex gap-8">
        <div className="shrink-0">
          <div className="surface w-[420px] h-[420px] grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_40%,rgba(225,29,46,0.18),transparent_60%)]">
            <Suspense fallback={<Spinner />}>
              <ModelViewer skinUrl={skinUrl} capeUrl={capeUrl} slim={slim} animation={anim} back={back} />
            </Suspense>
          </div>
          <div className="flex justify-between mt-3">
            <Segmented size="sm" value={anim} onChange={setAnim} options={[{ value: 'idle', label: 'Idle' }, { value: 'walk', label: 'Walk' }, { value: 'wave', label: 'Wave' }]} />
            <Segmented size="sm" value={back ? 'back' : 'front'} onChange={(v) => setBack(v === 'back')} options={[{ value: 'front', label: 'Front' }, { value: 'back', label: 'Back' }]} />
          </div>
          <div className="flex justify-between items-center mt-3">
            <Segmented size="sm" value={slim ? 'slim' : 'classic'} onChange={(v) => setSlim(v === 'slim')} options={[{ value: 'classic', label: 'Classic arms' }, { value: 'slim', label: 'Slim arms' }]} />
            {account?.type === 'msa' && (
              <Button size="sm" variant="primary" icon={Upload} onClick={async () => {
                const acc = await attempt(() => call('accounts:upload-skin', account.id, slim ? 'slim' : 'classic'), 'Skin upload failed');
                if (acc) {
                  toast.success('Skin updated on your Minecraft profile');
                  void qc.invalidateQueries({ queryKey: qk.accounts });
                }
              }}>Set as my skin</Button>
            )}
          </div>
          <p className="text-2xs text-t3 mt-2 w-[420px]">Drag to rotate, scroll to zoom. {account?.type === 'offline' && 'Offline accounts cannot change their in-game skin.'}</p>
        </div>

        <div className="flex-1 min-w-0">
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ value: 'skins', label: 'Skins', icon: User, count: skins.data?.length }, { value: 'capes', label: 'Capes', icon: Flag, count: capes.data?.length }, { value: 'cosmetics', label: 'Lifea Cosmetics', icon: Sparkles }]} />
          {tab !== 'cosmetics' ? (
            <>
              <div className="flex justify-end my-4">
                <Button icon={ImagePlus} onClick={() => void importFiles(tab)}>Import {tab === 'skins' ? 'skin' : 'cape'} PNG</Button>
              </div>
              {items.length === 0 ? (
                <EmptyState icon={Shirt} title={`No ${tab} in your library`} body={tab === 'skins' ? 'Import 64×64 skin PNGs to preview and switch quickly.' : 'Import 64×32 cape PNGs to preview them.'} action={<Button icon={ImagePlus} onClick={() => void importFiles(tab)}>Import</Button>} />
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
                  {items.map((it) => {
                    const active = tab === 'skins' ? skin === it.url : cape === it.url;
                    return (
                      <div key={it.file} className={cn('group relative surface p-2 cursor-pointer transition hover:border-line-strong', active && 'ring-2 ring-accent')} onClick={() => (tab === 'skins' ? setSkin(active ? undefined : it.url) : setCape(active ? undefined : it.url))}>
                        <div className="aspect-square rounded-md bg-bg1 grid place-items-center overflow-hidden">
                          <img src={it.url} alt={it.name} className="w-full pixelated" loading="lazy" />
                        </div>
                        <div className="text-xs mt-1.5 truncate capitalize">{it.name}</div>
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100">
                          <IconButton icon={Trash2} size="sm" label={`Remove ${it.name}`} onClick={(e) => {
                            e.stopPropagation();
                            void attempt(async () => {
                              await call('wardrobe:remove', tab, it.file);
                              void qc.invalidateQueries({ queryKey: ['wardrobe', tab] });
                            }, 'Could not remove');
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : !social.data?.signedIn ? (
            <EmptyState icon={Sparkles} title="Sign in for cosmetics" body={social.data?.error ?? 'Lifea cosmetics are shown to other Lifea players in game. They need a Microsoft account and a Lifea backend.'} />
          ) : (
            <div className="mt-4 flex flex-col gap-6">
              {(['cape', 'wings', 'hat', 'bandana', 'pet', 'emote'] as CosmeticType[]).map((type) => {
                const list = (catalog.data ?? []).filter((c) => c.type === type);
                if (!list.length) return null;
                return (
                  <div key={type}>
                    <h3 className="label mb-2 capitalize">{type === 'wings' ? 'Wings' : `${type}s`}</h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
                      {list.map((c) => {
                        const on = equipped.data?.[c.type] === c.id;
                        return (
                          <button key={c.id} type="button" onClick={() => void equip(c)} className={cn('surface p-3 text-left transition hover:border-line-strong', on && 'ring-2 ring-accent')}>
                            <div className="aspect-[4/3] rounded-md bg-bg1 grid place-items-center overflow-hidden">
                              {c.preview ? <img src={c.preview} alt="" className="max-h-full pixelated" loading="lazy" /> : <Sparkles className="w-6 h-6 text-t3" />}
                            </div>
                            <div className="text-sm font-medium mt-2 truncate">{c.name}</div>
                            <div className="flex items-center justify-between mt-1">
                              <Chip tone={c.rarity === 'legendary' ? 'warning' : c.rarity === 'epic' ? 'accent' : 'default'}>{c.rarity}</Chip>
                              <span className={cn('text-2xs font-semibold', on ? 'text-success' : 'text-t3')}>{on ? 'Equipped' : 'Equip'}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {catalog.data?.length === 0 && <EmptyState icon={Sparkles} title="No cosmetics yet" body="The backend has no cosmetics in its catalog." />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
