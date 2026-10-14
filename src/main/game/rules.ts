/** Mojang rule evaluation (os name / arch / version + features). Pure — unit tested. */
import { release } from 'node:os';
import type { Rule } from './mojang';

export type OsName = 'windows' | 'osx' | 'linux';
export type Arch = 'x86' | 'x86_64' | 'arm64' | 'arm32';

export interface RuleEnv {
  os: OsName;
  arch: Arch;
  osVersion: string;
  features: Record<string, boolean>;
}

export function detectOs(platform: string = process.platform): OsName {
  return platform === 'win32' ? 'windows' : platform === 'darwin' ? 'osx' : 'linux';
}

export function detectArch(arch: string = process.arch): Arch {
  if (arch === 'ia32') return 'x86';
  if (arch === 'arm64') return 'arm64';
  if (arch === 'arm') return 'arm32';
  return 'x86_64';
}

export function currentEnv(features: Record<string, boolean> = {}): RuleEnv {
  return { os: detectOs(), arch: detectArch(), osVersion: release(), features };
}

export function ruleMatches(rule: Rule, env: RuleEnv): boolean {
  if (rule.os) {
    if (rule.os.name && rule.os.name !== env.os) return false;
    // Mojang uses "x86" for 32-bit Intel only.
    if (rule.os.arch && rule.os.arch !== env.arch) return false;
    if (rule.os.version) {
      try {
        if (!new RegExp(rule.os.version).test(env.osVersion)) return false;
      } catch {
        return false;
      }
    }
  }
  if (rule.features) {
    for (const [key, want] of Object.entries(rule.features)) {
      if ((env.features[key] ?? false) !== want) return false;
    }
  }
  return true;
}

/** No rules → allowed. Otherwise start disallowed and let the last matching rule decide. */
export function rulesAllow(rules: Rule[] | undefined, env: RuleEnv): boolean {
  if (!rules || rules.length === 0) return true;
  let allowed = false;
  for (const rule of rules) if (ruleMatches(rule, env)) allowed = rule.action === 'allow';
  return allowed;
}
