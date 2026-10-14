import { describe, expect, it } from 'vitest';
import type { ModrinthVersion } from '../src/shared/types';
import { migrateSettings } from '../src/shared/schemas';
import { cleanLogLine, diagnoseCrash, parseLevel } from '../src/main/game/crash';
import { acceptableLoaders, facetsFor, parseCdnUrl, pickVersion } from '../src/main/game/modrinth-select';
import { parseAddress, parseLegacy, parseMotd } from '../src/main/servers/motd';
import { readNbt, writeNbt } from '../src/main/servers/nbt';
import { readVarInt, writeVarInt } from '../src/main/servers/ping';
import { offlineUuid, validateOfflineName } from '../src/main/accounts/offline';
import { dashUuid, profileToSession } from '../src/main/accounts/msa';
import { parseJavaVersion } from '../src/main/game/java';
import { neoforgePrefix } from '../src/main/game/loaders/forge';
import { loaderFromDeps } from '../src/main/game/mrpack';
import { pngSize, validateTexture } from '../src/main/game/wardrobe';
import { setupScore } from '../src/main/game/boost';
import { Ring } from '../src/renderer/stores/logs';

describe('settings migration', () => {
  it('upgrades agent-5 v1 settings (hyphen theme, dataDir, maxHeap)', () => {
    const { settings, changed } = migrateSettings({ schemaVersion: 1, theme: 'blood-dunes', accent: '#8b0000', dataDir: '/data', maxHeap: 6, interfaceScale: 125, animatedDesert: false });
    expect(changed).toBe(true);
    expect(settings.theme).toBe('blood_dunes');
    expect(settings.gameDir).toBe('/data');
    expect(settings.defaultMemoryMb).toBe(6144);
    expect(settings.zoom).toBe(1.25);
    expect(settings.animatedBackground).toBe(false);
    expect(settings.schemaVersion).toBe(2);
  });
  it('drops invalid values one by one instead of resetting everything', () => {
    const { settings } = migrateSettings({ schemaVersion: 2, theme: 'nope', accent: 'red', zoom: 9, launchBehavior: 'minimize' });
    expect(settings.theme).toBe('blood_dunes');
    expect(settings.accent).toBe('#e11d2e');
    expect(settings.zoom).toBe(1);
    expect(settings.launchBehavior).toBe('minimize');
  });
  it('handles garbage', () => {
    expect(migrateSettings('garbage').settings.schemaVersion).toBe(2);
    expect(migrateSettings(null).changed).toBe(true);
  });
});

describe('crash diagnosis', () => {
  it('detects wrong Java version', () => {
    const c = diagnoseCrash(['java.lang.UnsupportedClassVersionError: net/minecraft/client/main/Main has been compiled by a more recent version of the Java Runtime (class file version 65.0)']);
    expect(c?.title).toBe('Wrong Java version');
    expect(c?.detail).toContain('Java 21');
    expect(c?.fix?.action).toBe('set-java');
  });
  it('detects missing Fabric API', () => {
    expect(diagnoseCrash(["Mod 'Sodium Extra' (sodium-extra) 0.6 requires any version of fabric-api, which is missing!"])?.fix?.action).toBe('install-fabric-api');
  });
  it('detects memory problems', () => {
    expect(diagnoseCrash(['Error occurred during initialization of VM', 'Could not reserve enough space for object heap'])?.fix?.action).toBe('lower-memory');
    expect(diagnoseCrash(['java.lang.OutOfMemoryError: Java heap space'])?.fix?.action).toBe('raise-memory');
  });
  it('falls back to the crash report description', () => {
    expect(diagnoseCrash([], '---- Minecraft Crash Report ----\nDescription: Rendering overlay\n')?.detail).toBe('Rendering overlay');
  });
  it('parses levels', () => {
    expect(parseLevel('[12:00:00] [Render thread/WARN]: hmm')).toBe('WARN');
    expect(parseLevel('[12:00:00] [main/ERROR]: bad')).toBe('ERROR');
    expect(parseLevel('<log4j:Event logger="x" timestamp="1" level="DEBUG" thread="main">')).toBe('DEBUG');
    expect(parseLevel('\tat net.minecraft.Foo.bar(Foo.java:1)')).toBe('ERROR');
    expect(parseLevel('plain text')).toBe('INFO');
  });
  it('cleans log4j XML', () => {
    expect(cleanLogLine('<log4j:Event logger="a" level="INFO">')).toBeNull();
    expect(cleanLogLine('  <log4j:Message><![CDATA[Hello]]></log4j:Message>')).toBe('Hello');
    expect(cleanLogLine('normal')).toBe('normal');
  });
});

describe('modrinth selection (P1-2)', () => {
  const v = (id: string, game: string[], loaders: string[], type: ModrinthVersion['version_type'], date: string): ModrinthVersion => ({
    id, project_id: 'p', name: id, version_number: id, version_type: type, game_versions: game, loaders, files: [], dependencies: [], date_published: date, downloads: 0,
  });
  const versions = [
    v('neo-new', ['1.21.4'], ['neoforge'], 'release', '2025-03-01'),
    v('fab-beta', ['1.21.4'], ['fabric'], 'beta', '2025-02-01'),
    v('fab-rel', ['1.21.4'], ['fabric'], 'release', '2025-01-01'),
    v('fab-121', ['1.21.1'], ['fabric'], 'release', '2025-04-01'),
  ];
  it('filters by game version and loader and prefers releases', () => {
    expect(pickVersion(versions, '1.21.4', ['fabric'])?.id).toBe('fab-rel');
    expect(pickVersion(versions, '1.21.4', ['neoforge'])?.id).toBe('neo-new');
    expect(pickVersion(versions, '1.20.1', ['fabric'])).toBeNull();
  });
  it('maps loaders per project type', () => {
    expect(acceptableLoaders('resourcepack', 'fabric')).toEqual(['minecraft']);
    expect(acceptableLoaders('mod', 'quilt')).toEqual(['quilt', 'fabric']);
    expect(acceptableLoaders('shader', 'fabric')).toContain('iris');
  });
  it('builds facets', () => {
    expect(facetsFor({ type: 'mod', loader: 'fabric', gameVersion: '1.21.4', categories: ['optimization'] })).toEqual([['project_type:mod'], ['versions:1.21.4'], ['categories:fabric'], ['categories:optimization']]);
  });
  it('parses CDN urls', () => {
    expect(parseCdnUrl('https://cdn.modrinth.com/data/AANobbMI/versions/u1OEbNKx/sodium.jar')).toEqual({ projectId: 'AANobbMI', versionId: 'u1OEbNKx' });
    expect(parseCdnUrl('https://example.com/x.jar')).toBeNull();
  });
});

describe('servers', () => {
  it('parses addresses incl. IPv6', () => {
    expect(parseAddress('play.example.net')).toEqual({ host: 'play.example.net' });
    expect(parseAddress('play.example.net:25570')).toEqual({ host: 'play.example.net', port: 25570 });
    expect(parseAddress('[2001:db8::1]:25565')).toEqual({ host: '2001:db8::1', port: 25565 });
    expect(parseAddress('2001:db8::1')).toEqual({ host: '2001:db8::1' });
  });
  it('parses MOTD components and legacy codes', () => {
    const segs = parseMotd({ text: '', extra: [{ text: 'Hyp', color: 'gold', bold: true }, '§cRed §lBold'] });
    expect(segs[0]).toMatchObject({ text: 'Hyp', color: '#FFAA00', bold: true });
    expect(segs.find((s) => s.text === 'Red ')?.color).toBe('#FF5555');
    expect(segs.find((s) => s.text === 'Bold')).toMatchObject({ bold: true, color: '#FF5555' });
    expect(parseLegacy('§kx§rplain').at(-1)).toEqual({ text: 'plain' });
  });
  it('varint round trip', () => {
    for (const n of [0, 1, 127, 128, 255, 25565, 2097151, 767]) {
      const b = writeVarInt(n);
      expect(readVarInt(b, 0)).toEqual({ value: n, size: b.length });
    }
    expect(writeVarInt(-1)).toEqual(Buffer.from([0xff, 0xff, 0xff, 0xff, 0x0f]));
  });
  it('servers.dat NBT round trip', () => {
    const buf = writeNbt('', { type: 'compound', value: { servers: { type: 'list', elementType: 'compound', value: [{ type: 'compound', value: { name: { type: 'string', value: 'Hypixel' }, ip: { type: 'string', value: 'mc.hypixel.net' }, acceptTextures: { type: 'byte', value: 1 } } }] } } });
    const back = readNbt(buf);
    const list = back.value.type === 'compound' ? back.value.value.servers : null;
    expect(list?.type).toBe('list');
    const first = list?.type === 'list' ? list.value[0] : null;
    expect(first?.type === 'compound' && first.value.ip.type === 'string' && first.value.ip.value).toBe('mc.hypixel.net');
    expect(writeNbt('', back.value as never)).toEqual(buf);
  });
});

describe('accounts', () => {
  it('offline UUID matches UUID.nameUUIDFromBytes (version 3)', () => {
    const u = offlineUuid('Notch');
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-3[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(u).toBe('b50ad385-829d-3141-a216-7e7d7539ba7f');
  });
  it('validates offline names', () => {
    expect(validateOfflineName('Steve_1')).toBeNull();
    expect(validateOfflineName('ab')).not.toBeNull();
    expect(validateOfflineName('has space')).not.toBeNull();
  });
  it('maps Minecraft profiles to sessions', () => {
    expect(dashUuid('069a79f444e94726a5befca90e38aaf5')).toBe('069a79f4-44e9-4726-a5be-fca90e38aaf5');
    const s = profileToSession({ accessToken: 't', expiresAt: 1 }, { id: '069a79f444e94726a5befca90e38aaf5', name: 'Notch', skins: [{ url: 'u', variant: 'SLIM', state: 'ACTIVE' }] });
    expect(s).toMatchObject({ username: 'Notch', skinUrl: 'u', skinVariant: 'slim' });
  });
});

describe('misc', () => {
  it('parses java -version output', () => {
    expect(parseJavaVersion('openjdk version "21.0.5" 2024-10-15')).toEqual({ version: '21.0.5', major: 21 });
    expect(parseJavaVersion('java version "1.8.0_412"')).toEqual({ version: '1.8.0_412', major: 8 });
    expect(parseJavaVersion('nope')).toBeNull();
  });
  it('maps Minecraft to NeoForge version prefixes', () => {
    expect(neoforgePrefix('1.21.1')).toBe('21.1.');
    expect(neoforgePrefix('1.21')).toBe('21.0.');
    expect(neoforgePrefix('24w14a')).toBeNull();
  });
  it('reads mrpack loader dependencies', () => {
    expect(loaderFromDeps({ minecraft: '1.21.1', 'fabric-loader': '0.16.5' })).toEqual({ loader: 'fabric', loaderVersion: '0.16.5' });
    expect(loaderFromDeps({ minecraft: '1.21.1', neoforge: '21.1.77' })).toEqual({ loader: 'neoforge', loaderVersion: '21.1.77' });
    expect(loaderFromDeps({ minecraft: '1.20.1' })).toEqual({ loader: 'vanilla' });
  });
  it('validates skin and cape PNG sizes', () => {
    const png = (w: number, h: number) => {
      const b = Buffer.alloc(24);
      b.writeUInt32BE(0x89504e47, 0);
      b.write('IHDR', 12, 'ascii');
      b.writeUInt32BE(w, 16);
      b.writeUInt32BE(h, 20);
      return b;
    };
    expect(pngSize(png(64, 64))).toEqual({ width: 64, height: 64 });
    expect(validateTexture('skins', png(64, 64))).toBeNull();
    expect(validateTexture('skins', png(100, 50))).not.toBeNull();
    expect(validateTexture('capes', png(64, 32))).toBeNull();
    expect(validateTexture('skins', Buffer.from('not a png at all, really not'))).toBe('Not a PNG image.');
  });
  it('setup score rewards performance mods', () => {
    const base = { loader: 'fabric', memoryMb: 4096, recommendedMb: 4096, gc: 'g1', threads: 8 };
    expect(setupScore({ ...base, installed: ['sodium', 'lithium'] })).toBeGreaterThan(setupScore({ ...base, installed: [] }));
    expect(setupScore({ ...base, loader: 'vanilla', installed: [] })).toBeLessThanOrEqual(70);
  });
  it('ring buffer keeps the newest lines without copying', () => {
    const r = new Ring<number>(3);
    for (let i = 1; i <= 5; i++) r.push(i);
    expect(r.toArray()).toEqual([3, 4, 5]);
    expect(r.at(0)).toBe(3);
    r.resize(2);
    expect(r.toArray()).toEqual([4, 5]);
  });
});
