import { describe, expect, it } from 'vitest';
import { BASE_LEVELS, pinnedSolution } from '../src/game/levels';
import { Rng } from '../src/game/rng';
import { solve } from '../src/game/solver';
import { checkChain, extendChain, startChain, type Chain } from '../src/social/chain';
import { decodeChain, encodeChain } from '../src/social/codec';
import { extractCode, shareMessage, shareUrl } from '../src/social/links';
import { RULE_ORDER } from '../src/rules';
import { verifyRuleSync } from '../src/rules/verify';

/** Plays N hops with the solver standing in for human players. */
function buildChain(baseIdx: number, hops: number): Chain {
  const base = BASE_LEVELS[baseIdx];
  let chain: Chain | null = null;
  let level = base;
  let solved = pinnedSolution(base.id)!;
  for (let h = 0; h < hops; h++) {
    let picked = null as ReturnType<typeof verifyRuleSync> | null;
    for (let k = 0; k < RULE_ORDER.length && !(picked && picked.status === 'ok'); k++) {
      picked = verifyRuleSync(level, RULE_ORDER[(h + k) % RULE_ORDER.length], { budget: 4000, baseSeed: 100 + h });
    }
    if (!picked || picked.status !== 'ok') throw new Error('no rule offerable');
    const rule = picked.level.rules.at(-1)!;
    chain = chain
      ? extendChain(chain, rule.id, rule.seed, solved, picked.solution)
      : startChain(base.id, rule.id, rule.seed, solved, picked.solution);
    level = picked.level;
    const next = solve(level, { seed: 2, budget: 6000 });
    if (!next.solved) throw new Error('player solver failed');
    solved = next.solution;
  }
  return chain!;
}

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
