import { lazy, Suspense, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flag, ImagePlus, Shirt, Sparkles, Trash2, Upload, User } from 'lucide-react';
import type { CosmeticItem, CosmeticType } from '@shared/types';
import { call } from '../lib/ipc';
import { asset, cn } from '../lib/util';
import { qk, useSelectedAccount } from '../hooks/queries';
import { attempt, toast } from '../stores/toasts';
import { Button, EmptyState, IconButton, PageHeader, Segmented, Spinner, Tabs } from '../components/ui/core';

const ModelViewer = lazy(() => import('../components/ModelViewer'));

type Tab = 'skins' | 'capes' | 'cosmetics';
const localCosmetics: { id: string; name: string; type: Extract<CosmeticType, 'wings' | 'hat' | 'bandana'>; detail: string }[] = [
  { id: 'dragon', name: 'Dragon Wings', type: 'wings', detail: 'Elytra-style back cosmetic' },
  { id: 'angel', name: 'Angel Wings', type: 'wings', detail: 'Elytra-style back cosmetic' },
  { id: 'butterfly', name: 'Butterfly Wings', type: 'wings', detail: 'Elytra-style back cosmetic' },
  { id: 'top_hat', name: 'Top Hat', type: 'hat', detail: 'Golden headpiece' },
  { id: 'crown', name: 'Crown', type: 'hat', detail: 'Golden headpiece' },
  { id: 'halo', name: 'Halo', type: 'hat', detail: 'Golden headpiece' },
  { id: 'red', name: 'Red Bandana', type: 'bandana', detail: 'Red headwear' },
];

export default function Wardrobe() {
  const qc = useQueryClient();
  const account = useSelectedAccount();
  const [tab, setTab] = useState<Tab>('skins');
  const [anim, setAnim] = useState<'idle' | 'walk' | 'wave'>('idle');
  const [back, setBack] = useState(false);
  const [slim, setSlim] = useState(account?.skinVariant === 'slim');
  const [skin, setSkin] = useState<string | undefined>();
  const [selectedSkinFile, setSelectedSkinFile] = useState<string | undefined>();
  const [cape, setCape] = useState<string | undefined>();
  const skins = useQuery({ queryKey: ['wardrobe', 'skins'], queryFn: () => call('wardrobe:list', 'skins') });
  const capes = useQuery({ queryKey: ['wardrobe', 'capes'], queryFn: () => call('wardrobe:list', 'capes') });
  const social = useQuery({ queryKey: [...qk.social, 'status'], queryFn: () => call('social:status') });
  const catalog = useQuery({ queryKey: [...qk.social, 'catalog'], queryFn: () => call('social:catalog'), enabled: tab === 'cosmetics' });
  const equipped = useQuery({ queryKey: [...qk.social, 'equipped'], queryFn: () => call('social:equipped'), enabled: tab === 'cosmetics' && !!social.data?.signedIn });

  useEffect(() => {
    setSlim(account?.skinVariant === 'slim');
    setSelectedSkinFile(account?.localSkinFile);
  }, [account?.id, account?.skinVariant, account?.localSkinFile]);

  const skinUrl = skin ?? skins.data?.find((item) => item.file === account?.localSkinFile)?.url ?? account?.skinUrl;
  const capeUrl = cape ?? capes.data?.find((item) => item.file === account?.localCapeFile)?.url ?? account?.capeUrl;
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
  const equipLocal = async (type: (typeof localCosmetics)[number]['type'], id: string) => {
    if (!account) {
      toast.error('Select an account before equipping LifeaCore cosmetics');
      return;
    }
    const on = account.localCosmetics?.[type] === id;
    const updated = await attempt(() => call('accounts:set-cosmetic', account.id, type, on ? null : id), 'Could not save cosmetic');
    if (updated) {
      toast.success(on ? 'Cosmetic unequipped' : 'Saved to this account for LifeaCore 1.21.4.');
      void qc.invalidateQueries({ queryKey: qk.accounts });
    }
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
            <div className="flex items-center gap-2">
              {account?.localSkinFile && <Button size="sm" variant="secondary" onClick={() => {
                setSkin(undefined);
                setSelectedSkinFile(undefined);
                void (async () => {
                  const updated = await attempt(() => call('accounts:set-skin', account.id, null, slim ? 'slim' : 'classic'), 'Could not restore account skin');
                  if (updated) {
                    toast.success('Restored the account skin (Steve for offline accounts)');
                    void qc.invalidateQueries({ queryKey: qk.accounts });
                  }
                })();
              }}>Restore account skin</Button>}
              {account?.type === 'msa' && <span className="text-2xs text-t3">Selected Microsoft skins upload to your profile; offline skins stay local.</span>}
            </div>
          </div>
          <p className="text-2xs text-t3 mt-2 w-[420px]">Drag to rotate, scroll to zoom. Local Lifea capes render with the bundled LifeaCore profile (Minecraft 1.21.4).</p>
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
                    const equippedCape = tab === 'capes' && account?.localCapeFile === it.file;
                    const active = tab === 'skins' ? selectedSkinFile === it.file || account?.localSkinFile === it.file : cape === it.url || equippedCape;
                    return (
                      <div key={it.file} className={cn('group relative surface p-2 cursor-pointer transition hover:border-line-strong', active && 'ring-2 ring-accent')} onClick={() => (tab === 'skins' ? setSkin(active ? undefined : it.url) : setCape(active ? undefined : it.url))}>
                        <div className="aspect-square rounded-md bg-bg1 grid place-items-center overflow-hidden">
                          <img src={it.url} alt={it.name} className="w-full pixelated" loading="lazy" onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = asset('icons/lifea-logo.png'); }} />
                        </div>
                        <div className="text-xs mt-1.5 truncate capitalize">{it.name}</div>
                        {tab === 'skins' && <Button size="sm" variant={active ? 'primary' : 'secondary'} className="w-full mt-2" icon={account?.type === 'msa' ? Upload : User} onClick={(e) => {
                          e.stopPropagation();
                          setSkin(it.url);
                          setSelectedSkinFile(it.file);
                          if (!account) {
                            toast.error('Select an account before equipping a skin');
                          } else if (account.type === 'msa') {
                            void (async () => {
                              const local = await attempt(() => call('accounts:set-skin', account.id, it.file, slim ? 'slim' : 'classic'), 'Could not equip local skin');
                              if (!local) return;
                              void qc.invalidateQueries({ queryKey: qk.accounts });
                              const acc = await attempt(() => call('accounts:upload-skin', account.id, slim ? 'slim' : 'classic', it.file), 'Skin upload failed');
                              if (acc) {
                                toast.success('Skin equipped locally and updated on your Minecraft profile');
                                void qc.invalidateQueries({ queryKey: qk.accounts });
                              } else {
                                toast.error('Local skin is equipped; Microsoft upload failed. See the error above.');
                              }
                            })();
                          } else {
                            void (async () => {
                              const acc = await attempt(() => call('accounts:set-skin', account.id, it.file, slim ? 'slim' : 'classic'), 'Skin equip failed');
                              if (acc) {
                                toast.success('Skin equipped for this offline account');
                                void qc.invalidateQueries({ queryKey: qk.accounts });
                              }
                            })();
                          }
                        }}>{active ? 'Using Skin' : 'Use Skin'}</Button>}
                        {tab === 'capes' && <Button size="sm" variant={active ? 'primary' : 'secondary'} className="w-full mt-2" icon={Flag} onClick={(e) => {
                          e.stopPropagation();
                          setCape(equippedCape ? undefined : it.url);
                          if (!account) {
                            toast.error('Add or select an account before equipping a cape');
                            return;
                          }
                          void (async () => {
                            const updated = await attempt(() => call('accounts:set-cape', account.id, equippedCape ? null : it.file), 'Cape equip failed');
                            if (updated) {
                              toast.success(equippedCape ? 'Lifea cape removed' : 'Lifea cape equipped for LifeaCore 1.21.4');
                              void qc.invalidateQueries({ queryKey: qk.accounts });
                            }
                          })();
                        }}>{equippedCape ? 'Unequip' : 'Use Cape'}</Button>}
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
          ) : (
            <div className="mt-4">
              <p className="text-xs text-t3 mb-4">Wings, headwear, and bandanas are saved to this account and rendered locally by the bundled LifeaCore profile for Minecraft 1.21.4. No cosmetics backend is needed.</p>
              {!account && <EmptyState icon={User} title="Select an account" body="Choose an account before saving cosmetics." />}
              <div className="flex flex-col gap-5">
                {(['wings', 'hat', 'bandana'] as const).map((type) => (
                  <section key={type}>
                    <h3 className="label mb-2 capitalize">{type === 'wings' ? 'Wings' : type === 'hat' ? 'Headwear' : 'Bandanas'}</h3>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
                      {localCosmetics.filter((item) => item.type === type).map((item) => {
                        const on = account?.localCosmetics?.[type] === item.id;
                        return <button key={item.id} type="button" disabled={!account} onClick={() => void equipLocal(type, item.id)} className={cn('surface p-3 text-left transition hover:border-line-strong disabled:opacity-50', on && 'ring-2 ring-accent')}>
                          <div className="aspect-[4/3] rounded-md bg-bg1 grid place-items-center"><Sparkles className="w-7 h-7 text-accent" /></div>
                          <div className="text-sm font-medium mt-2">{item.name}</div>
                          <div className="text-2xs text-t3 mt-1">{item.detail}</div>
                          <div className={cn('text-xs font-semibold mt-2', on ? 'text-success' : 'text-t3')}>{on ? 'Equipped' : 'Equip'}</div>
                        </button>;
                      })}
                    </div>
                  </section>
                ))}
              </div>
              {social.data?.signedIn && catalog.data?.length ? <div className="mt-6"><h3 className="label mb-2">Online Lifea cosmetics</h3><div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">{catalog.data.map((c) => <button key={c.id} type="button" onClick={() => void equip(c)} className={cn('surface p-3 text-left', equipped.data?.[c.type] === c.id && 'ring-2 ring-accent')}><div className="text-sm font-medium">{c.name}</div><div className="text-2xs text-t3 mt-1">{equipped.data?.[c.type] === c.id ? 'Equipped online' : 'Equip online'}</div></button>)}</div></div> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
