import { describe, expect, it } from 'vitest';
import { buildCustomLevel, checkCustom, customId, type CustomDef, emptyCustom, validateCustom } from '../src/game/custom';
import { solve } from '../src/game/solver';
import { runSolution } from '../src/game/sim';
import { handleRequest } from '../src/server/handler';
import { MemoryStore } from '../src/server/memoryStore';
import { createNodeBody } from '../src/server/payload';
import { checkChain, startChain } from '../src/social/chain';
import { decodeChain, encodeChain } from '../src/social/codec';
import { challengeFromChain, challengeFromCustom, passItOn } from '../src/social/flow';
import { verifyRuleSync } from '../src/rules/verify';
import type { Solution } from '../src/game/types';

/** A ramp + a bumper in the ball's way: needs a plank to reach the goal. */
const sample = (): CustomDef => ({
  v: 1, b: [40, 40], t: [20, 296, 10],
  w: [[0, 180, 120, 200], [180, 240, 60, 260]],
  d: [[100, 140, 10]], p: [24, 24, 20],
});

function solveIt(def: CustomDef): Solution {
  const lvl = buildCustomLevel(def);
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = solve(lvl, { seed, budget: 6000 });
    if (r.solved) return r.solution;
  }
  throw new Error('test setup: unsolvable sample');
}

describe('custom level validation', () => {
  it('accepts a sane level and builds a deterministic id', () => {
    expect(validateCustom(sample())).toBeNull();
    expect(customId(sample())).toBe(customId(sample()));
    expect(customId(sample())).not.toBe(customId({ ...sample(), p: [24, 24, 28] }));
    const l = buildCustomLevel(sample());
    expect(l.balls[0]).toMatchObject({ x: 20, y: 20 });
    expect(l.segments).toHaveLength(2);
    expect(l.inventory).toHaveLength(3);
  });
  it('rejects hostile / broken input', () => {
    const bad: unknown[] = [null, 5, 'x', {}, { v: 2 }, { ...sample(), b: [1.5, 3] }, { ...sample(), b: [-5, 40] }, { ...sample(), t: [150, 270, 99] },
      { ...sample(), w: Array.from({ length: 15 }, () => [0, 0, 100, 100]) }, { ...sample(), w: [[0, 0, 1, 0]] },
      { ...sample(), d: Array.from({ length: 9 }, (_, i) => [20 + i * 15, 300, 6]) }, { ...sample(), d: [[100, 140, 7]] },
      { ...sample(), p: [] }, { ...sample(), p: [24, 24, 24, 24, 24] }, { ...sample(), p: [17] },
      { ...sample(), w: [[1e9, 0, 5, 5]] }, { ...sample(), w: 'x' }, { ...sample(), extra: 'x'.repeat(3000) }];
    for (const b of bad) expect(validateCustom(b), JSON.stringify(b)?.slice(0, 60)).not.toBeNull();
  });
  it('rejects a ball that starts inside a wall, on a bumper, or on the goal', () => {
    expect(validateCustom({ ...sample(), w: [[20, 40, 60, 40]] })).toMatch(/wall/);
    expect(validateCustom({ ...sample(), d: [[44, 44, 10]] })).toMatch(/bumper/);
    expect(validateCustom({ ...sample(), t: [44, 52, 13] })).toMatch(/goal/);
  });
  it('rejects a level the empty board already wins', () => {
    const trivial: CustomDef = { v: 1, b: [90, 40], t: [90, 270, 16], w: [], d: [], p: [24] };
    const r = checkCustom(trivial);
    expect(r.ok).toBe(false);
    expect(emptyCustom().p.length).toBeGreaterThan(0);
  });
});

describe('custom chains end to end', () => {
  const def = sample();
  const level = buildCustomLevel(def);
  const solved = solveIt(def);
  const v = verifyRuleSync(level, 'bumper', { baseSeed: 2, budget: 4000 });
  const mk = () => {
    if (v.status !== 'ok') throw new Error('setup: twist');
    return startChain(level.id, 'bumper', v.level.rules[0].seed, solved, v.solution, def);
  };

  it('sample is playable (not trivial) and solvable', () => {
    expect(checkCustom(def).ok).toBe(true);
    expect(runSolution(level, solved).won).toBe(true);
  });
  it('a chain from a custom puzzle verifies, round-trips as a code, and extends', () => {
    const chain = mk();
    expect(checkChain(chain).ok).toBe(true);
    const d = decodeChain(encodeChain(chain));
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.chain.custom).toEqual(def);
    const ch = challengeFromChain(d.chain);
    expect(ch.ok).toBe(true);
    if (ch.ok) expect(ch.challenge.custom).toEqual(def);
  });
  it('tampering with the embedded puzzle is detected', () => {
    const chain = mk();
    expect(checkChain({ ...chain, custom: { ...def, d: [[100, 150, 10]] } }).ok).toBe(false); // id mismatch
    expect(checkChain({ ...chain, base: 'cxxxx' }).ok).toBe(false);
    expect(checkChain({ ...chain, custom: undefined }).ok).toBe(false); // unknown base id
    const code = encodeChain(chain);
    const mid = Math.floor(code.length / 2);
    expect(decodeChain(code.slice(0, mid) + (code[mid] === 'A' ? 'B' : 'A') + code.slice(mid + 1)).ok).toBe(false);
  });
  it('challengeFromCustom -> passItOn keeps the puzzle inside the chain', () => {
    const c = challengeFromCustom(def);
    expect(c.ok).toBe(true);
    if (!c.ok || v.status !== 'ok') return;
    const chain = passItOn(c.challenge, solved, v.level.rules[0], v.solution);
    expect(chain.custom).toEqual(def);
    expect(checkChain(chain).ok).toBe(true);
  });
  it('server stores the puzzle at the root, serves it to children, and refuses forged ones', async () => {
    const store = new MemoryStore();
    const chain = mk();
    const a = await handleRequest(store, 'alice', createNodeBody(chain, null));
    expect(a.ok).toBe(true);
    const id = (a as { id: string }).id;
    const got = await handleRequest(store, 'bob', { op: 'getNode', id });
    expect(got.ok).toBe(true);
    if (!got.ok || !('chain' in got)) return;
    expect(got.chain.custom).toEqual(def);
    expect(checkChain(got.chain, { requireProof: false }).ok).toBe(true);

    // Forged: broken geometry, mismatched id, custom on a child node, unsolvable proof
    const forged = (patch: Record<string, unknown>) => handleRequest(store, 'mallory', { ...createNodeBody(chain, null), ...patch });
    expect((await forged({ custom: { ...def, b: [3, 3] } })).ok).toBe(false);
    expect((await forged({ custom: { ...def, d: [[100, 150, 10]] } })).ok).toBe(false);
    expect((await forged({ proof: [] })).ok).toBe(false);
    expect((await handleRequest(store, 'mallory', { ...createNodeBody(chain, id), custom: def })).ok).toBe(false);
    // missing custom on a root whose base is a custom id
    const { custom: _drop, ...noCustom } = createNodeBody(chain, null) as Record<string, unknown>;
    expect((await handleRequest(store, 'mallory', noCustom)).ok).toBe(false);
    expect(store.nodes.size).toBe(1);
  });
});
