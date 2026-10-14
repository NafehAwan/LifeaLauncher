/** Server List Ping (1.7+) with SRV lookup and IPv6 support. */
import { promises as dns } from 'node:dns';
import { Socket } from 'node:net';
import type { ServerStatus } from '@shared/types';
import { parseAddress, parseMotd } from './motd';

export function writeVarInt(value: number): Buffer {
  const bytes: number[] = [];
  let v = value >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    bytes.push(b);
  } while (v !== 0);
  return Buffer.from(bytes);
}

export function readVarInt(buf: Buffer, offset: number): { value: number; size: number } | null {
  let result = 0;
  for (let i = 0; i < 5; i++) {
    if (offset + i >= buf.length) return null;
    const b = buf[offset + i];
    result |= (b & 0x7f) << (7 * i);
    if ((b & 0x80) === 0) return { value: result, size: i + 1 };
  }
  throw new Error('VarInt too long');
}

async function resolveTarget(address: string): Promise<{ host: string; port: number; handshakeHost: string }> {
  const { host, port } = parseAddress(address);
  if (port) return { host, port, handshakeHost: host };
  try {
    const srv = await dns.resolveSrv(`_minecraft._tcp.${host}`);
    if (srv.length) {
      const best = srv.sort((a, b) => a.priority - b.priority || b.weight - a.weight)[0];
      return { host: best.name, port: best.port, handshakeHost: host };
    }
  } catch {
    /* no SRV record */
  }
  return { host, port: 25565, handshakeHost: host };
}

export async function pingServer(address: string, timeoutMs = 5000): Promise<ServerStatus> {
  let target: { host: string; port: number; handshakeHost: string };
  try {
    target = await resolveTarget(address);
  } catch (e) {
    return { online: false, error: (e as Error).message };
  }
  return new Promise((resolve) => {
    const sock = new Socket();
    let buf = Buffer.alloc(0);
    let sentAt = 0;
    let statusJson: Record<string, unknown> | null = null;
    let done = false;
    const finish = (s: ServerStatus) => {
      if (done) return;
      done = true;
      sock.destroy();
      resolve({ ...s, host: target.host, port: target.port });
    };
    const packet = (id: number, payload: Buffer) => {
      const body = Buffer.concat([writeVarInt(id), payload]);
      return Buffer.concat([writeVarInt(body.length), body]);
    };
    sock.setTimeout(timeoutMs, () => finish({ online: false, error: 'Timed out' }));
    sock.on('error', (e) => finish({ online: false, error: e.message }));
    sock.connect(target.port, target.host, () => {
      const host = Buffer.from(target.handshakeHost, 'utf8');
      const port = Buffer.alloc(2);
      port.writeUInt16BE(target.port);
      sock.write(packet(0x00, Buffer.concat([writeVarInt(767), writeVarInt(host.length), host, port, writeVarInt(1)])));
      sock.write(packet(0x00, Buffer.alloc(0)));
    });
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      for (;;) {
        const len = readVarInt(buf, 0);
        if (!len || buf.length < len.size + len.value) return;
        const body = buf.subarray(len.size, len.size + len.value);
        buf = buf.subarray(len.size + len.value);
        const id = readVarInt(body, 0);
        if (!id) return;
        if (id.value === 0x00 && !statusJson) {
          const strLen = readVarInt(body, id.size);
          if (!strLen) return;
          try {
            statusJson = JSON.parse(body.subarray(id.size + strLen.size, id.size + strLen.size + strLen.value).toString('utf8'));
          } catch {
            return finish({ online: false, error: 'Bad status response' });
          }
          sentAt = Date.now();
          const payload = Buffer.alloc(8);
          payload.writeBigInt64BE(BigInt(sentAt));
          sock.write(packet(0x01, payload));
        } else if (id.value === 0x01 && statusJson) {
          const s = statusJson as { players?: { online?: number; max?: number }; version?: { name?: string }; description?: unknown; favicon?: string };
          finish({
            online: true,
            pingMs: Date.now() - sentAt,
            players: { online: s.players?.online ?? 0, max: s.players?.max ?? 0 },
            version: s.version?.name,
            motd: parseMotd(s.description),
            favicon: typeof s.favicon === 'string' && s.favicon.startsWith('data:image/png;base64,') ? s.favicon : undefined,
          });
        }
      }
    });
  });
}
