/** Offline accounts. UUID matches Java's UUID.nameUUIDFromBytes("OfflinePlayer:" + name), like vanilla servers. */
import { createHash } from 'node:crypto';
import { OFFLINE_NAME_RE } from '@shared/constants';

export function offlineUuid(name: string): string {
  const b = createHash('md5').update(`OfflinePlayer:${name}`, 'utf8').digest();
  b[6] = (b[6] & 0x0f) | 0x30; // version 3
  b[8] = (b[8] & 0x3f) | 0x80; // IETF variant
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function validateOfflineName(name: string): string | null {
  if (!OFFLINE_NAME_RE.test(name)) return 'Use 3–16 letters, numbers or underscores.';
  return null;
}
