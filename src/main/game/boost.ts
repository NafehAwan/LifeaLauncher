/** Boost: real system detection + a transparent "setup score" (it is not measured FPS — that comes from lifea-core). */
import { cpus, freemem, totalmem } from 'node:os';
import { PERFORMANCE_MODS } from '@shared/constants';
import type { BoostAnalysis, BoostSuggestion } from '@shared/types';
import { getSettings } from '../core/settings';
import { recommendMemoryMb } from './args';
import { fpsHistory } from './bridge';
import { listContent, readInstance } from './instances';

let gpuProvider: () => Promise<string | undefined> = async () => undefined;
export function setGpuProvider(fn: () => Promise<string | undefined>): void {
  gpuProvider = fn;
}

const WEIGHT = { High: 22, Medium: 7, Low: 3 } as const;

export function setupScore(o: { installed: string[]; loader: string; memoryMb: number; recommendedMb: number; gc: string; threads: number }): number {
  if (o.loader === 'vanilla') {
    let s = 45;
    if (Math.abs(o.memoryMb - o.recommendedMb) <= 1024) s += 15;
    if (o.threads >= 8) s += 10;
    return Math.min(70, s);
  }
  let s = 35;
  for (const m of PERFORMANCE_MODS) if (o.installed.includes(m.slug)) s += WEIGHT[m.impact];
  if (o.memoryMb >= 2048 && Math.abs(o.memoryMb - o.recommendedMb) <= 2048) s += 8;
  if (o.gc === 'g1' || o.gc === 'zgc') s += 4;
  if (o.threads >= 8) s += 4;
  return Math.max(0, Math.min(100, Math.round(s)));
}

export async function analyze(instanceId: string): Promise<BoostAnalysis> {
  const inst = await readInstance(instanceId);
  if (!inst) throw new Error('Profile not found.');
  const settings = getSettings();
  const totalMemMb = Math.round(totalmem() / 1048576);
  const mods = await listContent(instanceId, 'mods');
  const recommendedMemoryMb = recommendMemoryMb(totalMemMb, mods.length);
  const memoryMb = inst.settings.memoryMb ?? settings.defaultMemoryMb;
  const ids = new Set(mods.filter((m) => m.enabled).map((m) => m.projectId).filter(Boolean));
  const names = mods.filter((m) => m.enabled).map((m) => m.file.toLowerCase());
  const installed = PERFORMANCE_MODS.filter((p) => names.some((n) => n.startsWith(p.slug.replace(/-/g, '')) || n.startsWith(p.slug)) || [...ids].some((id) => id === p.slug)).map((p) => p.slug);
  const suggestions: BoostSuggestion[] = inst.loader === 'vanilla'
    ? []
    : PERFORMANCE_MODS.filter((p) => p.loaders.includes(inst.loader) && !installed.includes(p.slug)).map((p) => ({ slug: p.slug, title: p.title, description: p.description, impact: p.impact }));
  const fps = await fpsHistory(instanceId);
  const cpu = cpus();
  return {
    score: setupScore({ installed, loader: inst.loader, memoryMb, recommendedMb: recommendedMemoryMb, gc: settings.gcPreset, threads: cpu.length }),
    system: { totalMemMb, freeMemMb: Math.round(freemem() / 1048576), cpuModel: cpu[0]?.model?.trim() ?? 'Unknown CPU', cpuThreads: cpu.length, gpu: await gpuProvider() },
    recommendedMemoryMb,
    instance: { memoryMb, gc: settings.gcPreset, loader: inst.loader },
    installed,
    suggestions,
    fps: fps.first || fps.latest ? { before: fps.first, latest: fps.latest } : undefined,
  };
}
