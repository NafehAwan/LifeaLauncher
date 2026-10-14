import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import v1214 from './fixtures/version-1.21.4.json';
import v189 from './fixtures/version-1.8.9.json';
import fabric from './fixtures/fabric-profile-1.21.4.json';
import type { VersionJson } from '../src/main/game/mojang';
import { rulesAllow, type RuleEnv } from '../src/main/game/rules';
import { buildClasspath, libraryKey, mavenPath, mergeVersions, nativeClassifierArch, parseMaven, planLibraries } from '../src/main/game/resolve';
import { buildLaunchArgs, gcFlags, launchVars, recommendMemoryMb, splitArgs } from '../src/main/game/args';

const env = (os: RuleEnv['os'], arch: RuleEnv['arch'] = 'x86_64', features: Record<string, boolean> = {}): RuleEnv => ({ os, arch, osVersion: '10.0', features });
const LIB = '/libs';

describe('rules', () => {
  it('allows when there are no rules', () => expect(rulesAllow(undefined, env('linux'))).toBe(true));
  it('last matching rule wins', () => {
    const rules = [{ action: 'allow' as const }, { action: 'disallow' as const, os: { name: 'osx' } }];
    expect(rulesAllow(rules, env('osx'))).toBe(false);
    expect(rulesAllow(rules, env('windows'))).toBe(true);
  });
  it('matches arch (x86 means 32-bit only)', () => {
    const rules = [{ action: 'allow' as const, os: { arch: 'x86' } }];
    expect(rulesAllow(rules, env('windows', 'x86'))).toBe(true);
    expect(rulesAllow(rules, env('windows', 'x86_64'))).toBe(false);
  });
  it('matches features, missing feature = false', () => {
    const rules = [{ action: 'allow' as const, features: { has_custom_resolution: true } }];
    expect(rulesAllow(rules, env('linux', 'x86_64', { has_custom_resolution: true }))).toBe(true);
    expect(rulesAllow(rules, env('linux'))).toBe(false);
  });
});

describe('maven', () => {
  it('parses classifier and extension', () => {
    expect(parseMaven('a.b:c:1.0:natives-linux@zip')).toEqual({ group: 'a.b', artifact: 'c', version: '1.0', classifier: 'natives-linux', ext: 'zip' });
    expect(mavenPath('net.fabricmc:fabric-loader:0.16.9')).toBe('net/fabricmc/fabric-loader/0.16.9/fabric-loader-0.16.9.jar');
    expect(mavenPath('org.lwjgl:lwjgl:3.3.3:natives-windows')).toBe('org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar');
  });
  it('dedup key ignores version but keeps classifier', () => {
    expect(libraryKey('org.ow2.asm:asm:9.6')).toBe(libraryKey('org.ow2.asm:asm:9.7.1'));
    expect(libraryKey('org.lwjgl:lwjgl:3.3.3')).not.toBe(libraryKey('org.lwjgl:lwjgl:3.3.3:natives-linux'));
  });
  it('knows the arch of native classifiers', () => {
    expect(nativeClassifierArch('natives-windows')).toBe('x86_64');
    expect(nativeClassifierArch('natives-windows-arm64')).toBe('arm64');
    expect(nativeClassifierArch('natives-windows-x86')).toBe('x86');
    expect(nativeClassifierArch('natives-macos-arm64')).toBe('arm64');
    expect(nativeClassifierArch('javadoc')).toBeNull();
  });
});

describe('library planning', () => {
  const vanilla = v1214 as unknown as VersionJson;
  it('puts the client jar last on the classpath (P0-6)', () => {
    const plan = planLibraries(vanilla, env('linux'), LIB);
    const cp = buildClasspath(plan, '/versions/1.21.4/1.21.4.jar');
    expect(cp[cp.length - 1]).toBe('/versions/1.21.4/1.21.4.jar');
    expect(cp).toContain(join(LIB, 'com/mojang/brigadier/1.3.10/brigadier-1.3.10.jar'));
  });
  it('keeps only the natives for this OS and arch (P0-8)', () => {
    const winX64 = planLibraries(vanilla, env('windows', 'x86_64'), LIB).natives.map((n) => n.path);
    expect(winX64).toEqual([join(LIB, 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar')]);
    const winArm = planLibraries(vanilla, env('windows', 'arm64'), LIB).natives.map((n) => n.path);
    expect(winArm).toEqual([join(LIB, 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows-arm64.jar')]);
    const macArm = planLibraries(vanilla, env('osx', 'arm64'), LIB).natives.map((n) => n.path);
    expect(macArm).toEqual([join(LIB, 'org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-macos-arm64.jar')]);
    const linux = planLibraries(vanilla, env('linux'), LIB);
    expect(linux.natives).toHaveLength(1);
    expect(linux.classpath.some((p) => p.includes('natives-windows'))).toBe(false);
  });
  it('extracts legacy classifier natives and keeps them off the classpath', () => {
    const plan = planLibraries(v189 as unknown as VersionJson, env('windows', 'x86_64'), LIB);
    const natives = plan.natives.map((n) => n.path);
    expect(natives).toContain(join(LIB, 'org/lwjgl/lwjgl/lwjgl-platform/2.9.4-nightly-20150209/lwjgl-platform-2.9.4-nightly-20150209-natives-windows.jar'));
    expect(natives).toContain(join(LIB, 'tv/twitch/twitch-platform/6.5/twitch-platform-6.5-natives-windows-64.jar'));
    expect(plan.classpath.some((p) => p.includes('natives'))).toBe(false);
    expect(plan.downloads.every((d) => d.url.startsWith('https://'))).toBe(true);
  });
  it('respects disallow rules (lwjgl 2 not on macOS)', () => {
    const plan = planLibraries(v189 as unknown as VersionJson, env('osx'), LIB);
    expect(plan.classpath.some((p) => p.includes('lwjgl'))).toBe(false);
  });
});

describe('inheritsFrom merge (P0-10)', () => {
  const merged = mergeVersions(fabric as unknown as VersionJson, v1214 as unknown as VersionJson);
  it('takes the child main class and keeps parent downloads', () => {
    expect(merged.mainClass).toBe('net.fabricmc.loader.impl.launch.knot.KnotClient');
    expect(merged.downloads?.client?.url).toContain('client.jar');
    expect(merged.jar).toBe('1.21.4');
    expect(merged.javaVersion?.majorVersion).toBe(21);
  });
  it('child libraries win and come first', () => {
    const asm = merged.libraries.filter((l) => l.name.startsWith('org.ow2.asm:asm:'));
    expect(asm).toHaveLength(1);
    expect(asm[0].name).toBe('org.ow2.asm:asm:9.7.1');
    expect(merged.libraries[0].name).toBe('org.ow2.asm:asm:9.7.1');
  });
  it('builds Maven URLs for loader libraries', () => {
    const plan = planLibraries(merged, env('linux'), LIB);
    const loader = plan.downloads.find((d) => d.name === 'net.fabricmc:fabric-loader:0.16.9');
    expect(loader?.url).toBe('https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.16.9/fabric-loader-0.16.9.jar');
  });
  it('appends child JVM args after the parent ones', () => {
    expect(merged.arguments?.jvm?.at(-1)).toContain('FabricMcEmu');
  });
});

describe('arguments (P0-9)', () => {
  const vars = launchVars({
    username: 'Steve', uuid: '00000000-0000-3000-8000-000000000000', accessToken: '0', userType: 'legacy', versionName: '1.21.4',
    gameDir: '/g', assetsRoot: '/a', assetsIndex: '19', nativesDir: '/n', librariesDir: '/l', classpath: ['/x.jar', '/y.jar'], classpathSeparator: ':', launcherVersion: '1.1.0',
  });
  it('builds modern args with no unknown variables and the right order', () => {
    const r = buildLaunchArgs({ version: v1214 as unknown as VersionJson, env: env('linux'), vars, memoryMb: 4096, javaMajor: 21, gcPreset: 'g1', totalSystemMb: 16384, userJvmArgs: '-Dfoo="a b"' });
    expect(r.unknownVars).toEqual([]);
    expect(r.jvm[0]).toBe('-Xmx4096M');
    expect(r.jvm).toContain('-Dfoo=a b');
    expect(r.jvm).toContain('-Djava.library.path=/n');
    expect(r.jvm.at(-1)).toBe('/x.jar:/y.jar');
    expect(r.jvm.at(-2)).toBe('-cp');
    expect(r.jvm).not.toContain('-XstartOnFirstThread');
    expect(r.game).toContain('Steve');
    expect(r.game).not.toContain('--demo');
    expect(r.game).not.toContain('--quickPlayMultiplayer');
    expect(r.game).not.toContain('--clientId'); // empty value dropped with its flag
  });
  it('adds -XstartOnFirstThread on macOS', () => {
    const r = buildLaunchArgs({ version: v1214 as unknown as VersionJson, env: env('osx', 'arm64'), vars, memoryMb: 4096, javaMajor: 21, gcPreset: 'g1', totalSystemMb: 16384, userJvmArgs: '' });
    expect(r.jvm).toContain('-XstartOnFirstThread');
  });
  it('quick play multiplayer only when requested', () => {
    const r = buildLaunchArgs({ version: v1214 as unknown as VersionJson, env: env('linux', 'x86_64', { is_quick_play_multiplayer: true }), vars: { ...vars, quickPlayMultiplayer: 'play.example.net' }, memoryMb: 2048, javaMajor: 21, gcPreset: 'g1', totalSystemMb: 8192, userJvmArgs: '' });
    expect(r.game.join(' ')).toContain('--quickPlayMultiplayer play.example.net');
  });
  it('legacy minecraftArguments + default jvm args', () => {
    const r = buildLaunchArgs({ version: v189 as unknown as VersionJson, env: env('windows'), vars, memoryMb: 2048, javaMajor: 8, gcPreset: 'g1', totalSystemMb: 8192, userJvmArgs: '' });
    expect(r.unknownVars).toEqual([]);
    expect(r.jvm).toContain('-Djava.library.path=/n');
    expect(r.game).toContain('{}');
    expect(r.jvm).toContain('-XX:G1HeapRegionSize=32M');
  });
  it('user GC flags replace the tuned preset', () => {
    const r = buildLaunchArgs({ version: v189 as unknown as VersionJson, env: env('linux'), vars, memoryMb: 2048, javaMajor: 8, gcPreset: 'g1', totalSystemMb: 8192, userJvmArgs: '-XX:+UseParallelGC' });
    expect(r.jvm.filter((a) => /Use\w+GC/.test(a))).toEqual(['-XX:+UseParallelGC']);
  });
  it('splits shell-style', () => {
    expect(splitArgs(`-Da=1  -Db="x y" '-Dc=z w' -De=""`)).toEqual(['-Da=1', '-Db=x y', '-Dc=z w', '-De=']);
  });
  it('picks GC by Java version', () => {
    expect(gcFlags(21, 'zgc', 32768)).toEqual(['-XX:+UseZGC', '-XX:+ZGenerational']);
    expect(gcFlags(21, 'zgc', 8192)).toContain('-XX:+UseG1GC');
    expect(gcFlags(8, 'g1', 8192)).toContain('-XX:G1HeapRegionSize=32M');
  });
  it('recommends sane memory', () => {
    expect(recommendMemoryMb(4096)).toBeLessThanOrEqual(2048);
    expect(recommendMemoryMb(16384)).toBeGreaterThanOrEqual(4096);
    expect(recommendMemoryMb(65536)).toBe(8192);
    expect(recommendMemoryMb(65536, 200)).toBe(10240);
  });
});
