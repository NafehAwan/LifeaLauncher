/** Minimal uncompressed NBT codec — enough for servers.dat. Pure — round-trip tested. */

export type NbtValue =
  | { type: 'byte'; value: number }
  | { type: 'short'; value: number }
  | { type: 'int'; value: number }
  | { type: 'long'; value: bigint }
  | { type: 'float'; value: number }
  | { type: 'double'; value: number }
  | { type: 'byteArray'; value: number[] }
  | { type: 'string'; value: string }
  | { type: 'list'; elementType: NbtTypeName; value: NbtValue[] }
  | { type: 'compound'; value: Record<string, NbtValue> }
  | { type: 'intArray'; value: number[] }
  | { type: 'longArray'; value: bigint[] };

export type NbtTypeName = NbtValue['type'] | 'end';
const IDS: NbtTypeName[] = ['end', 'byte', 'short', 'int', 'long', 'float', 'double', 'byteArray', 'string', 'list', 'compound', 'intArray', 'longArray'];

class Reader {
  o = 0;
  constructor(private b: Buffer) {}
  u8() { return this.b.readUInt8(this.o++); }
  i8() { return this.b.readInt8(this.o++); }
  i16() { const v = this.b.readInt16BE(this.o); this.o += 2; return v; }
  u16() { const v = this.b.readUInt16BE(this.o); this.o += 2; return v; }
  i32() { const v = this.b.readInt32BE(this.o); this.o += 4; return v; }
  i64() { const v = this.b.readBigInt64BE(this.o); this.o += 8; return v; }
  f32() { const v = this.b.readFloatBE(this.o); this.o += 4; return v; }
  f64() { const v = this.b.readDoubleBE(this.o); this.o += 8; return v; }
  str() { const n = this.u16(); const s = this.b.toString('utf8', this.o, this.o + n); this.o += n; return s; }
  payload(t: NbtTypeName): NbtValue {
    switch (t) {
      case 'byte': return { type: t, value: this.i8() };
      case 'short': return { type: t, value: this.i16() };
      case 'int': return { type: t, value: this.i32() };
      case 'long': return { type: t, value: this.i64() };
      case 'float': return { type: t, value: this.f32() };
      case 'double': return { type: t, value: this.f64() };
      case 'byteArray': { const n = this.i32(); return { type: t, value: Array.from({ length: n }, () => this.i8()) }; }
      case 'string': return { type: t, value: this.str() };
      case 'list': { const et = IDS[this.u8()]; const n = this.i32(); return { type: t, elementType: et, value: Array.from({ length: n }, () => this.payload(et)) }; }
      case 'compound': {
        const value: Record<string, NbtValue> = {};
        for (;;) {
          const id = IDS[this.u8()];
          if (id === 'end') break;
          const name = this.str();
          value[name] = this.payload(id);
        }
        return { type: t, value };
      }
      case 'intArray': { const n = this.i32(); return { type: t, value: Array.from({ length: n }, () => this.i32()) }; }
      case 'longArray': { const n = this.i32(); return { type: t, value: Array.from({ length: n }, () => this.i64()) }; }
      default: throw new Error(`Bad NBT tag ${t}`);
    }
  }
}

export function readNbt(buf: Buffer): { name: string; value: NbtValue } {
  const r = new Reader(buf);
  const t = IDS[r.u8()];
  if (t !== 'compound') throw new Error('NBT root must be a compound');
  const name = r.str();
  return { name, value: r.payload(t) };
}

function writePayload(v: NbtValue, out: Buffer[]): void {
  const n = (size: number, fn: (b: Buffer) => void) => { const b = Buffer.alloc(size); fn(b); out.push(b); };
  const str = (s: string) => { const b = Buffer.from(s, 'utf8'); n(2, (x) => x.writeUInt16BE(b.length)); out.push(b); };
  switch (v.type) {
    case 'byte': return n(1, (b) => b.writeInt8(v.value));
    case 'short': return n(2, (b) => b.writeInt16BE(v.value));
    case 'int': return n(4, (b) => b.writeInt32BE(v.value));
    case 'long': return n(8, (b) => b.writeBigInt64BE(v.value));
    case 'float': return n(4, (b) => b.writeFloatBE(v.value));
    case 'double': return n(8, (b) => b.writeDoubleBE(v.value));
    case 'byteArray': n(4, (b) => b.writeInt32BE(v.value.length)); return v.value.forEach((x) => n(1, (b) => b.writeInt8(x)));
    case 'string': return str(v.value);
    case 'list':
      n(1, (b) => b.writeUInt8(IDS.indexOf(v.value.length ? v.elementType : 'end')));
      n(4, (b) => b.writeInt32BE(v.value.length));
      return v.value.forEach((x) => writePayload(x, out));
    case 'compound':
      for (const [k, x] of Object.entries(v.value)) {
        n(1, (b) => b.writeUInt8(IDS.indexOf(x.type)));
        str(k);
        writePayload(x, out);
      }
      return n(1, (b) => b.writeUInt8(0));
    case 'intArray': n(4, (b) => b.writeInt32BE(v.value.length)); return v.value.forEach((x) => n(4, (b) => b.writeInt32BE(x)));
    case 'longArray': n(4, (b) => b.writeInt32BE(v.value.length)); return v.value.forEach((x) => n(8, (b) => b.writeBigInt64BE(x)));
  }
}

export function writeNbt(name: string, value: Extract<NbtValue, { type: 'compound' }>): Buffer {
  const out: Buffer[] = [];
  const header = Buffer.from(name, 'utf8');
  const h = Buffer.alloc(3);
  h.writeUInt8(10, 0);
  h.writeUInt16BE(header.length, 1);
  out.push(h, header);
  writePayload(value, out);
  return Buffer.concat(out);
}
