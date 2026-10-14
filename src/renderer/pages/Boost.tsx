import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Cpu, Gauge, MemoryStick, MonitorSmartphone, Rocket, Sparkles, Zap } from 'lucide-react';
import type { InstallResult } from '@shared/types';
import { call } from '../lib/ipc';
import { cn, loaderName } from '../lib/util';
import { qk, useSelectedInstance } from '../hooks/queries';
import { useSettings } from '../stores/settings';
import { attempt, toast } from '../stores/toasts';
import { Button, Chip, EmptyState, ErrorCard, PageHeader, Skeleton } from '../components/ui/core';
import { Modal, Select } from '../components/ui/overlay';

function ScoreRing({ score }: { score: number }) {
  const [shown, setShown] = useState(0);
  const reduce = useSettings((s) => s.settings.reducedMotion === 'on');
  const animated = useRef(false);
  useEffect(() => {
    if (reduce || animated.current) return setShown(score);
    animated.current = true;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / 900);
      setShown(Math.round(score * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [score, reduce]);
  const r = 70;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? 'var(--success)' : score >= 55 ? 'var(--warning)' : 'var(--accent)';
  return (
    <div className="relative w-[180px] h-[180px]">
      <svg viewBox="0 0 180 180" className="-rotate-90">
        <circle cx="90" cy="90" r={r} stroke="var(--bg-4)" strokeWidth="12" fill="none" />
        <circle cx="90" cy="90" r={r} stroke={tone} strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-pixel text-2xl tnum">{shown}</span>
        <span className="label mt-1">Setup score</span>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Cpu; label: string; value: string; sub?: string }) {
  return (
    <div className="surface p-4 flex gap-3 items-start">
      <div className="w-9 h-9 rounded-md bg-accent-soft grid place-items-center shrink-0"><Icon className="w-4 h-4 text-accent-hi" /></div>
      <div className="min-w-0">
        <div className="label">{label}</div>
        <div className="text-sm font-semibold text-t1 mt-1 truncate" title={value}>{value}</div>
        {sub && <div className="text-2xs text-t3 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default function Boost() {
  const [params] = useSearchParams();
  const { instances, selected } = useSelectedInstance();
  const [id, setId] = useState(params.get('instance') ?? '');
  const inst = instances.find((i) => i.id === id) ?? selected;
  const qc = useQueryClient();
  const analysis = useQuery({ queryKey: qk.boost(inst?.id ?? ''), queryFn: () => call('boost:analyze', inst!.id), enabled: !!inst, staleTime: 30_000 });
  const [plan, setPlan] = useState<InstallResult | null>(null);
  const [planning, setPlanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const a = analysis.data;

  if (!inst) return <div className="page"><EmptyState icon={Gauge} title="No profile selected" body="Create a profile first." /></div>;

  const preview = async () => {
    setPlanning(true);
    const r = await attempt(() => call('modrinth:optimize', inst.id, true), 'Could not check performance mods');
    setPlanning(false);
    if (r) {
      if (!r.installed.length) toast.info('Nothing to install', r.warnings[0] ?? 'This profile already has every compatible performance mod.');
      else setPlan(r);
    }
  };
  const apply = async () => {
    setApplying(true);
    const r = await attempt(() => call('modrinth:optimize', inst.id, false), 'Optimization failed');
    setApplying(false);
    setPlan(null);
    if (r) {
      toast.success(`Installed ${r.installed.length} performance mod${r.installed.length === 1 ? '' : 's'}`, r.warnings.join('\n') || undefined);
      void qc.invalidateQueries({ queryKey: qk.boost(inst.id) });
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Boost"
        subtitle="Get the most FPS out of your hardware"
        actions={<Select label="Profile" className="w-64" value={inst.id} onChange={setId} options={instances.map((i) => ({ value: i.id, label: i.name, hint: `${loaderName(i.loader)} ${i.version}` }))} />}
      />
      {analysis.error ? (
        <ErrorCard error={analysis.error} onRetry={() => void analysis.refetch()} />
      ) : !a ? (
        <div className="grid grid-cols-[auto_1fr] gap-6"><Skeleton className="w-[180px] h-[180px] rounded-full" /><Skeleton className="h-[180px]" /></div>
      ) : (
        <>
          <div className="surface p-6 flex gap-8 items-center">
            <ScoreRing score={a.score} />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold">{a.score >= 80 ? 'This profile is well tuned' : a.score >= 55 ? 'Good, with room to improve' : 'This profile can run much faster'}</h2>
              <p className="text-sm text-t2 mt-1 max-w-xl">
                The setup score reflects installed performance mods, memory and garbage-collector settings. Real FPS from your last session appears below once you have played with Lifea Core.
              </p>
              <div className="flex flex-wrap gap-2 mt-4">
                <Button variant="primary" icon={Rocket} loading={planning} disabled={inst.loader === 'vanilla' || !a.suggestions.length} onClick={() => void preview()}>
                  Optimize this profile
                </Button>
                {inst.loader === 'vanilla' && <Chip tone="warning">Switch to Fabric in profile settings to install performance mods</Chip>}
              </div>
            </div>
            {a.fps?.latest && (
              <div className="surface-raised p-4 w-52 shrink-0">
                <div className="label">Last session</div>
                <div className="font-pixel text-xl mt-1 tnum">{Math.round(a.fps.latest.avg)} <span className="text-xs text-t3 font-ui">FPS avg</span></div>
                <div className="text-xs text-t2 tnum">1% low {Math.round(a.fps.latest.low1)}</div>
                {a.fps.before && a.fps.before !== a.fps.latest && a.fps.before.avg > 0 && (
                  <div className={cn('text-xs mt-2 tnum', a.fps.latest.avg >= a.fps.before.avg ? 'text-success' : 'text-danger')}>
                    {a.fps.latest.avg >= a.fps.before.avg ? '+' : ''}{Math.round(((a.fps.latest.avg - a.fps.before.avg) / a.fps.before.avg) * 100)}% vs first session
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-4 mt-5">
            <Stat icon={MemoryStick} label="System memory" value={`${(a.system.totalMemMb / 1024).toFixed(0)} GB`} sub={`${(a.system.freeMemMb / 1024).toFixed(1)} GB free`} />
            <Stat icon={Cpu} label="Processor" value={a.system.cpuModel} sub={`${a.system.cpuThreads} threads`} />
            <Stat icon={MonitorSmartphone} label="Graphics" value={a.system.gpu ?? 'Unknown GPU'} />
            <Stat icon={Zap} label="Profile memory" value={`${(a.instance.memoryMb / 1024).toFixed(1)} GB`} sub={`Recommended ${(a.recommendedMemoryMb / 1024).toFixed(1)} GB · ${a.instance.gc.toUpperCase()}`} />
          </div>

          <h2 className="label mt-8 mb-3">Suggestions</h2>
          {a.suggestions.length === 0 ? (
            <div className="surface p-5 flex items-center gap-3 text-sm text-t2"><Sparkles className="w-5 h-5 text-success" /> {inst.loader === 'vanilla' ? 'Vanilla profiles cannot use performance mods.' : 'Every compatible performance mod is installed.'}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {a.suggestions.map((s) => (
                <div key={s.slug} className="surface p-4 flex gap-3 items-start">
                  <Chip tone={s.impact === 'High' ? 'accent' : s.impact === 'Medium' ? 'warning' : 'default'}>{s.impact}</Chip>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{s.title}</div>
                    <div className="text-xs text-t3 mt-0.5">{s.description}</div>
                  </div>
                  <Button size="sm" onClick={async () => {
                    const r = await attempt(() => call('modrinth:install', inst.id, s.slug), `Could not install ${s.title}`);
                    if (r) {
                      toast.success(`Installed ${s.title}`);
                      void qc.invalidateQueries({ queryKey: qk.boost(inst.id) });
                    }
                  }}>Install</Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <Modal open={!!plan} onClose={() => setPlan(null)} title="Optimize this profile" subtitle={`These versions match ${loaderName(inst.loader)} ${inst.version}.`}
        footer={<><Button variant="ghost" onClick={() => setPlan(null)}>Cancel</Button><Button variant="primary" loading={applying} onClick={() => void apply()}>Install {plan?.installed.length} mods</Button></>}>
        <div className="flex flex-col gap-1.5">
          {plan?.installed.map((m) => <div key={m.name} className="flex justify-between text-sm"><span>{m.name}</span><span className="text-2xs text-t3 truncate max-w-[60%]">{m.file}</span></div>)}
          {plan?.skipped.map((s) => <div key={s} className="text-xs text-t3">Skipped: {s}</div>)}
        </div>
      </Modal>
    </div>
  );
}
