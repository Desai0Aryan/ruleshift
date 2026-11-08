import { describe, expect, it } from 'vitest';
import { Rng } from '../src/game/rng';
import { checkChain, type Chain } from '../src/social/chain';
import { synthesizeChain } from '../src/social/synth';
import { decodeChain, encodeChain } from '../src/social/codec';
import { extractCode, shareMessage, shareUrl } from '../src/social/links';

const buildChain = (baseIdx: number, hops: number) => synthesizeChain(baseIdx, hops);

describe('chains', () => {
  const chain = buildChain(0, 5);
  it('a 5-hop chain verifies end to end', () => {
    const c = checkChain(chain);
    expect(c.ok).toBe(true);
    if (c.ok) expect(c.levels.length).toBe(6);
  });
  it('encode -> decode round-trips exactly and still verifies', () => {
    const code = encodeChain(chain);
    expect(code.startsWith('RS1.')).toBe(true);
    const d = decodeChain(code);
    expect(d.ok).toBe(true);
    if (d.ok) {
      expect(d.chain).toEqual(chain);
      expect(checkChain(d.chain).ok).toBe(true);
    }
  });
  it('codes stay short enough to paste into any chat app', () => {
    expect(encodeChain(chain).length).toBeLessThan(2500);
  });
  it('detects tampering (flipped character)', () => {
    const code = encodeChain(chain);
    const i = 10;
    const flipped = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(decodeChain(flipped).ok).toBe(false);
  });
  it('rejects a cheat: valid-looking chain whose proof does not solve the puzzle', () => {
    const forged: Chain = { ...chain, proof: [] };
    const d = decodeChain(encodeChain(forged));
    expect(d.ok).toBe(true); // well-formed...
    if (d.ok) expect(checkChain(d.chain).ok).toBe(false); // ...but semantically invalid
  });
  it('rejects unknown base level and wrong engine version', () => {
    expect(checkChain({ ...chain, base: 'NOPE' }).ok).toBe(false);
    expect(checkChain({ ...chain, engine: 999 }).ok).toBe(false);
  });
  it('decoder never throws on hostile input (fuzz)', () => {
    const rng = new Rng(1);
    const alpha = 'ABCxyz019-_.{}[]"\\ ';
    for (let n = 0; n < 3000; n++) {
      let s = rng.chance(0.5) ? 'RS1.' : '';
      const len = rng.int(80);
      for (let i = 0; i < len; i++) s += alpha[rng.int(alpha.length)];
      expect(() => decodeChain(s)).not.toThrow();
    }
    expect(decodeChain('').ok).toBe(false);
    expect(decodeChain('RS1..').ok).toBe(false);
  });
  it('extracts a code from a pasted share message or link', () => {
    const msg = shareMessage(chain);
    const code = encodeChain(chain);
    expect(extractCode(msg)).toBe(code);
    expect(extractCode(shareUrl(code))).toBe(code);
    expect(extractCode('hello there')).toBeNull();
  });
});

import { SEED_CHAINS } from '../src/social/seeds';
describe('designer seed chains (cold-start content)', () => {
  it('ships at least 8, all decode and verify end to end', () => {
    expect(SEED_CHAINS.length).toBeGreaterThanOrEqual(8);
    for (const s of SEED_CHAINS) {
      const d = decodeChain(s.code);
      expect(d.ok, s.title).toBe(true);
      if (d.ok) { expect(checkChain(d.chain).ok, s.title).toBe(true); expect(d.chain.links.length).toBe(s.depth); }
    }
  });
});
