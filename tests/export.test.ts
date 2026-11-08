import { describe, expect, it } from 'vitest';
import { encodeGif, medianCut, Quantizer, TRANSPARENT_INDEX } from '../src/export/gif';
import { renderReplayGif } from '../src/export/replayGif';
import { Rng } from '../src/game/rng';
import { synthesizeChain } from '../src/social/synth';

/** Independent GIF LZW decoder written from the spec (so the encoder is not graded by itself). */
function decodeGif(bytes: Uint8Array) {
  let p = 6;
  const w = bytes[p] | (bytes[p + 1] << 8), h = bytes[p + 2] | (bytes[p + 3] << 8);
  const flags = bytes[p + 4]; p += 7;
  if (flags & 0x80) p += 3 * (1 << ((flags & 7) + 1));
  const frames: Array<{ x: number; y: number; w: number; h: number; px: Uint8Array; delay: number; trans: boolean }> = [];
  let delay = 0, trans = false;
  while (bytes[p] !== 0x3b) {
    if (bytes[p] === 0x21) {
      const label = bytes[p + 1]; p += 2;
      if (label === 0xf9) { trans = (bytes[p + 1] & 1) === 1; delay = bytes[p + 2] | (bytes[p + 3] << 8); }
      while (bytes[p] !== 0) p += bytes[p] + 1;
      p++;
    } else if (bytes[p] === 0x2c) {
      const fx = bytes[p + 1] | (bytes[p + 2] << 8), fy = bytes[p + 3] | (bytes[p + 4] << 8);
      const fw = bytes[p + 5] | (bytes[p + 6] << 8), fh = bytes[p + 7] | (bytes[p + 8] << 8);
      p += 10;
      const minCode = bytes[p++];
      const data: number[] = [];
      while (bytes[p] !== 0) { for (let i = 0; i < bytes[p]; i++) data.push(bytes[p + 1 + i]); p += bytes[p] + 1; }
      p++;
      const clear = 1 << minCode, eoi = clear + 1;
      const out: number[] = [];
      let size = minCode + 1, bitBuf = 0, bits = 0, di = 0;
      let table: number[][] = [];
      const reset = () => { table = []; for (let i = 0; i < clear; i++) table.push([i]); table.push([], []); size = minCode + 1; };
      reset();
      let prev: number[] | null = null;
      for (;;) {
        while (bits < size && di < data.length) { bitBuf |= data[di++] << bits; bits += 8; }
        if (bits < size) break;
        const code = bitBuf & ((1 << size) - 1);
        bitBuf >>>= size; bits -= size;
        if (code === clear) { reset(); prev = null; continue; }
        if (code === eoi) break;
        let entry: number[];
        if (code < table.length) entry = table[code];
        else entry = [...prev!, prev![0]];
        out.push(...entry);
        if (prev) table.push([...prev, entry[0]]);
        prev = entry;
        if (table.length === 1 << size && size < 12) size++;
      }
      frames.push({ x: fx, y: fy, w: fw, h: fh, px: Uint8Array.from(out), delay, trans });
    } else throw new Error('bad block ' + bytes[p]);
  }
  return { w, h, frames };
}

describe('GIF encoder', () => {
  it('round-trips noisy frames exactly (exercises code-size growth and dictionary reset)', () => {
    const rng = new Rng(9);
    const W = 90, H = 80;
    const noisy = new Uint8Array(W * H).map(() => rng.int(200));
    const flat = new Uint8Array(W * H).fill(7);
    const stripes = new Uint8Array(W * H).map((_, i) => ((i % W) >> 3) & 3);
    const pal = new Uint8Array(768).map((_, i) => i % 251);
    const gif = encodeGif(W, H, pal, [
      { x: 0, y: 0, w: W, h: H, indices: noisy, delayCs: 5, transparent: false },
      { x: 0, y: 0, w: W, h: H, indices: flat, delayCs: 7, transparent: false },
      { x: 0, y: 0, w: W, h: H, indices: stripes, delayCs: 9, transparent: true },
    ]);
    const d = decodeGif(gif);
    expect(d.w).toBe(W); expect(d.h).toBe(H); expect(d.frames.length).toBe(3);
    expect(Array.from(d.frames[0].px)).toEqual(Array.from(noisy));
    expect(Array.from(d.frames[1].px)).toEqual(Array.from(flat));
    expect(Array.from(d.frames[2].px)).toEqual(Array.from(stripes));
    expect(d.frames.map((f) => f.delay)).toEqual([5, 7, 9]);
    expect(String.fromCharCode(...gif.slice(0, 6))).toBe('GIF89a');
    expect(gif[gif.length - 1]).toBe(0x3b);
  });
  it('quantizer never returns the reserved transparent index', () => {
    const rng = new Rng(2);
    const samples = new Uint8Array(3000).map(() => rng.int(256));
    const q = new Quantizer(medianCut(samples, 255));
    for (let i = 0; i < 2000; i++) expect(q.index(rng.int(256), rng.int(256), rng.int(256))).not.toBe(TRANSPARENT_INDEX);
  });
});

describe('replay GIF', () => {
  it('renders a whole chain to a valid, looping, reasonably small GIF', async () => {
    const chain = synthesizeChain(2, 2);
    const g = await renderReplayGif(chain, { width: 144 });
    expect(g).not.toBeNull();
    const d = decodeGif(g!.bytes);
    expect(d.w).toBe(144);
    expect(d.frames.length).toBe(g!.frames);
    expect(d.frames.length).toBeGreaterThan(30);
    expect(g!.bytes.length).toBeLessThan(1_500_000);
    expect(g!.seconds).toBeGreaterThan(5);
    // every frame stays inside the canvas
    for (const f of d.frames) { expect(f.x + f.w).toBeLessThanOrEqual(144); expect(f.y + f.h).toBeLessThanOrEqual(d.h); expect(f.px.length).toBe(f.w * f.h); }
  });
  it('is deterministic: same chain => identical bytes', async () => {
    const chain = synthesizeChain(0, 1);
    const a = await renderReplayGif(chain, { width: 108 });
    const b = await renderReplayGif(chain, { width: 108 });
    expect(Buffer.from(a!.bytes).equals(Buffer.from(b!.bytes))).toBe(true);
  });
  it('refuses a forged chain', async () => {
    const chain = synthesizeChain(0, 1);
    expect(await renderReplayGif({ ...chain, proof: [] })).toBeNull();
  });
});
