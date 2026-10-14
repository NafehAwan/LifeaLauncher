/** MOTD parsing: chat components and legacy § codes → styled segments. Pure — unit tested. */
import type { MotdSegment } from '@shared/types';

const COLORS: Record<string, string> = {
  black: '#000000', dark_blue: '#0000AA', dark_green: '#00AA00', dark_aqua: '#00AAAA', dark_red: '#AA0000',
  dark_purple: '#AA00AA', gold: '#FFAA00', gray: '#AAAAAA', dark_gray: '#555555', blue: '#5555FF', green: '#55FF55',
  aqua: '#55FFFF', red: '#FF5555', light_purple: '#FF55FF', yellow: '#FFFF55', white: '#FFFFFF',
};
const CODE_COLORS = 'black dark_blue dark_green dark_aqua dark_red dark_purple gold gray dark_gray blue green aqua red light_purple yellow white'.split(' ');

export function parseLegacy(text: string, base: Omit<MotdSegment, 'text'> = {}): MotdSegment[] {
  const out: MotdSegment[] = [];
  let style: Omit<MotdSegment, 'text'> = { ...base };
  let buf = '';
  const flush = () => {
    if (buf) out.push({ text: buf, ...style });
    buf = '';
  };
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '§' && i + 1 < text.length) {
      const code = text[++i].toLowerCase();
      flush();
      const idx = '0123456789abcdef'.indexOf(code);
      if (idx >= 0) style = { color: COLORS[CODE_COLORS[idx]] };
      else if (code === 'l') style = { ...style, bold: true };
      else if (code === 'o') style = { ...style, italic: true };
      else if (code === 'n') style = { ...style, underlined: true };
      else if (code === 'm') style = { ...style, strikethrough: true };
      else if (code === 'k') style = { ...style, obfuscated: true };
      else if (code === 'r') style = { ...base };
    } else buf += text[i];
  }
  flush();
  return out;
}

interface Component {
  text?: string;
  translate?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
  extra?: (Component | string)[];
}

export function parseMotd(desc: unknown, inherited: Omit<MotdSegment, 'text'> = {}): MotdSegment[] {
  if (desc == null) return [];
  if (typeof desc === 'string') return parseLegacy(desc, inherited);
  if (Array.isArray(desc)) return desc.flatMap((d) => parseMotd(d, inherited));
  const c = desc as Component;
  const style: Omit<MotdSegment, 'text'> = {
    ...inherited,
    ...(c.color ? { color: c.color.startsWith('#') ? c.color : COLORS[c.color] } : {}),
    ...(c.bold !== undefined ? { bold: c.bold } : {}),
    ...(c.italic !== undefined ? { italic: c.italic } : {}),
    ...(c.underlined !== undefined ? { underlined: c.underlined } : {}),
    ...(c.strikethrough !== undefined ? { strikethrough: c.strikethrough } : {}),
    ...(c.obfuscated !== undefined ? { obfuscated: c.obfuscated } : {}),
  };
  const own = parseLegacy(c.text ?? c.translate ?? '', style);
  return [...own, ...(c.extra ?? []).flatMap((e) => parseMotd(e, style))];
}

/** Split "host", "host:port", "[v6]", "[v6]:port". */
export function parseAddress(address: string): { host: string; port?: number } {
  const a = address.trim();
  const v6 = a.match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (v6) return { host: v6[1], port: v6[2] ? Number(v6[2]) : undefined };
  const colons = a.split(':').length - 1;
  if (colons === 1) {
    const [host, port] = a.split(':');
    return { host, port: Number(port) || undefined };
  }
  return { host: a };
}
