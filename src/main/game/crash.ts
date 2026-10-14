/** Crash diagnosis and log-level parsing. Pure — unit tested. */
import type { CrashInfo, LogLevel } from '@shared/types';

const PATTERNS: { re: RegExp; info: (m: RegExpMatchArray) => CrashInfo }[] = [
  {
    re: /UnsupportedClassVersionError.*class file version (\d+)/,
    info: (m) => ({
      title: 'Wrong Java version',
      detail: `Something in this profile needs Java ${Number(m[1]) - 44}. LifeaLauncher can download the right one automatically.`,
      fix: { label: 'Use managed Java', action: 'set-java' },
    }),
  },
  {
    re: /requires (?:any version of |version [^ ]+ (?:or later )?of )?(?:'Fabric API'|fabric-api|fabric)\b/i,
    info: () => ({ title: 'Fabric API is missing', detail: 'One of your mods needs Fabric API.', fix: { label: 'Install Fabric API', action: 'install-fabric-api' } }),
  },
  {
    re: /Mod resolution failed|Incompatible mods? found|ModResolutionException|requires (?:any version of |version )?.* of mod '([^']+)'/i,
    info: () => ({ title: 'Mods are incompatible', detail: 'Two mods conflict, or a mod needs another mod or a different Minecraft version. Check the console for the exact list.', fix: { label: 'Open logs', action: 'open-logs' } }),
  },
  {
    re: /Could not reserve enough space for object heap|Invalid maximum heap size|Could not create the Java Virtual Machine/,
    info: () => ({ title: 'Not enough memory for Java', detail: 'The memory setting is higher than your system can give. Lower it in the profile settings.', fix: { label: 'Lower memory', action: 'lower-memory' } }),
  },
  {
    re: /java\.lang\.OutOfMemoryError/,
    info: () => ({ title: 'Minecraft ran out of memory', detail: 'Give this profile more memory, or remove heavy mods/shaders.', fix: { label: 'Raise memory', action: 'raise-memory' } }),
  },
  {
    re: /GLFW error 65542|WGL: The driver does not appear to support OpenGL|Pixel format not accelerated|GL_VERSION.*1\.1/i,
    info: () => ({ title: 'Graphics driver problem', detail: 'Your GPU driver does not expose OpenGL. Install the latest driver from your GPU vendor.', fix: { label: 'How to update drivers', action: 'update-drivers' } }),
  },
  {
    re: /Could not find or load main class/,
    info: () => ({ title: 'Game files are incomplete', detail: 'Some game files are missing. Launch again to re-download them.' }),
  },
  {
    re: /UnsatisfiedLinkError|no lwjgl in java\.library\.path/,
    info: () => ({ title: 'Native libraries failed to load', detail: 'Antivirus software sometimes deletes native libraries. Launch again, or add the Lifea game folder to your antivirus exceptions.' }),
  },
];

export function diagnoseCrash(lines: string[], crashReport?: string): CrashInfo | undefined {
  const text = `${lines.join('\n')}\n${crashReport ?? ''}`;
  for (const p of PATTERNS) {
    const m = text.match(p.re);
    if (m) return p.info(m);
  }
  const desc = crashReport?.match(/Description: (.+)/)?.[1];
  if (desc) return { title: 'Minecraft crashed', detail: desc, fix: { label: 'Open logs', action: 'open-logs' } };
  return undefined;
}

export function parseLevel(line: string): LogLevel {
  // log4j XML layout used by modern versions
  const xml = line.match(/level="(\w+)"/);
  const word = xml?.[1] ?? line.match(/\[(?:[^\]]*\/)?(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|SEVERE)\]/i)?.[1];
  switch (word?.toUpperCase()) {
    case 'TRACE':
    case 'DEBUG':
      return 'DEBUG';
    case 'WARN':
    case 'WARNING':
      return 'WARN';
    case 'ERROR':
    case 'FATAL':
    case 'SEVERE':
      return 'ERROR';
    default:
      return /^\s*(?:Exception|Caused by:|\tat )/.test(line) ? 'ERROR' : 'INFO';
  }
}

/** Strip log4j XML wrappers so the console shows readable text. */
export function cleanLogLine(line: string): string | null {
  if (/^\s*<\/?log4j:(Event|Throwable)/.test(line) && !line.includes('<![CDATA[')) return null;
  const cdata = line.match(/<!\[CDATA\[(.*?)(\]\]>)?$/);
  if (cdata) return cdata[1];
  if (/^\s*\]\]>/.test(line) || /^\s*<\/log4j:/.test(line)) return null;
  return line;
}

export const RUNNING_RE = /Setting user:|Backend library:|LWJGL Version|OpenAL initialized|Sound engine started/;
