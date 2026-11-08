/** Dependency-free GIF89a encoder: global palette, transparent-diff frames, merged identical frames, looping. */
export interface GifFrame { x: number; y: number; w: number; h: number; indices: Uint8Array; delayCs: number; transparent: boolean }

class Bytes {
  buf = new Uint8Array(1 << 16);
  n = 0;
  push(b: number) { if (this.n >= this.buf.length) { const nb = new Uint8Array(this.buf.length * 2); nb.set(this.buf); this.buf = nb; } this.buf[this.n++] = b; }
  u16(v: number) { this.push(v & 255); this.push(v >> 8); }
  str(s: string) { for (let i = 0; i < s.length; i++) this.push(s.charCodeAt(i)); }
  out() { return this.buf.slice(0, this.n); }
}

function lzw(indices: Uint8Array, minCode: number): Uint8Array {
  const clear = 1 << minCode, eoi = clear + 1;
  const out = new Bytes();
  let bits = 0, nbits = 0;
  const emit = (code: number, size: number) => {
    bits |= code << nbits; nbits += size;
    while (nbits >= 8) { out.push(bits & 255); bits >>>= 8; nbits -= 8; }
  };
  let size = minCode + 1;
  let dict = new Map<number, number>();
  let next = eoi + 1;
  emit(clear, size);
  let cur = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = (cur << 8) | k;
    const hit = dict.get(key);
    if (hit !== undefined) { cur = hit; continue; }
    emit(cur, size);
    if (next < 4096) {
      dict.set(key, next++);
      if (next - 1 === (1 << size) && size < 12) size++;
    } else {
      emit(clear, size);
      dict = new Map(); next = eoi + 1; size = minCode + 1;
    }
    cur = k;
  }
  emit(cur, size);
  emit(eoi, size);
  if (nbits > 0) out.push(bits & 255);
  return out.out();
}

export function encodeGif(width: number, height: number, palette: Uint8Array, frames: GifFrame[], loop = 0): Uint8Array {
  const o = new Bytes();
  o.str('GIF89a'); o.u16(width); o.u16(height);
  o.push(0xf7); o.push(0); o.push(0); // global table, 256 colours
  for (let i = 0; i < 256 * 3; i++) o.push(palette[i] ?? 0);
  o.push(0x21); o.push(0xff); o.push(11); o.str('NETSCAPE2.0'); o.push(3); o.push(1); o.u16(loop); o.push(0);
  for (const f of frames) {
    o.push(0x21); o.push(0xf9); o.push(4);
    o.push(f.transparent ? 0x05 : 0x04); // disposal 1 (leave in place) + transparency flag
    o.u16(f.delayCs); o.push(255); o.push(0);
    o.push(0x2c); o.u16(f.x); o.u16(f.y); o.u16(f.w); o.u16(f.h); o.push(0);
    o.push(8);
    const data = lzw(f.indices, 8);
    for (let i = 0; i < data.length; i += 255) {
      const len = Math.min(255, data.length - i);
      o.push(len);
      for (let j = 0; j < len; j++) o.push(data[i + j]);
    }
    o.push(0);
  }
  o.push(0x3b);
  return o.out();
}

export const TRANSPARENT_INDEX = 255;

/** Median-cut palette of up to `n` colours from packed RGB samples. */
export function medianCut(samples: Uint8Array, n: number): Uint8Array {
  type Box = { px: number[][] };
  const pts: number[][] = [];
  for (let i = 0; i + 2 < samples.length; i += 3) pts.push([samples[i], samples[i + 1], samples[i + 2]]);
  const boxes: Box[] = [{ px: pts }];
  const range = (b: Box) => {
    const mn = [255, 255, 255], mx = [0, 0, 0];
    for (const p of b.px) for (let c = 0; c < 3; c++) { if (p[c] < mn[c]) mn[c] = p[c]; if (p[c] > mx[c]) mx[c] = p[c]; }
    const r = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    const ch = r[0] >= r[1] && r[0] >= r[2] ? 0 : r[1] >= r[2] ? 1 : 2;
    return { ch, span: r[ch] * Math.sqrt(b.px.length) };
  };
  while (boxes.length < n) {
    let bi = -1, best = 0, bch = 0;
    boxes.forEach((b, i) => { if (b.px.length < 2) return; const r = range(b); if (r.span > best) { best = r.span; bi = i; bch = r.ch; } });
    if (bi < 0) break;
    const b = boxes[bi];
    b.px.sort((p, q) => p[bch] - q[bch]);
    const mid = b.px.length >> 1;
    boxes.splice(bi, 1, { px: b.px.slice(0, mid) }, { px: b.px.slice(mid) });
  }
  const pal = new Uint8Array(256 * 3);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0;
    for (const p of b.px) { r += p[0]; g += p[1]; bl += p[2]; }
    const k = Math.max(1, b.px.length);
    pal[i * 3] = r / k; pal[i * 3 + 1] = g / k; pal[i * 3 + 2] = bl / k;
  });
  return pal;
}

/** Nearest-palette lookup with a 15-bit cache. Index 255 is reserved for transparency and never returned. */
export class Quantizer {
  private cache = new Int16Array(1 << 21).fill(-1);
  private count: number;
  constructor(private pal: Uint8Array, count = 255) { this.count = count; }
  index(r: number, g: number, b: number): number {
    const key = ((r >> 1) << 14) | ((g >> 1) << 7) | (b >> 1);
    let v = this.cache[key];
    if (v >= 0) return v;
    const rr = (r & 0xfe) | 1, gg = (g & 0xfe) | 1, bb = (b & 0xfe) | 1;
    let best = 0, bd = Infinity;
    for (let i = 0; i < this.count; i++) {
      const d = (this.pal[i * 3] - rr) ** 2 + (this.pal[i * 3 + 1] - gg) ** 2 + (this.pal[i * 3 + 2] - bb) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    this.cache[key] = best;
    return best;
  }
}
