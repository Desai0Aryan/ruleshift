import { describe, expect, it } from 'vitest';
import { LIMITS, handleRequest, type ApiResponse } from '../src/server/handler';
import { MemoryStore } from '../src/server/memoryStore';
import { createNodeBody } from '../src/server/payload';
import { checkChain, type Chain } from '../src/social/chain';
import { synthesizeChain } from '../src/social/synth';
import { Rng } from '../src/game/rng';

const chain3 = synthesizeChain(2, 3);
/** prefix chain with the first k links; proof only valid for the full chain */
const asNodes = async (store: MemoryStore, user: string, chain: Chain) => {
  // publish links 1..n one by one, each needs a proof for ITS resulting level: rebuild via synth prefixes
  const ids: string[] = [];
  for (let k = 1; k <= chain.links.length; k++) {
    const pre = synthesizeChain(2, k);
    const r = await handleRequest(store, user, createNodeBody(pre, ids[k - 2] ?? null));
    if (!r.ok) throw new Error(r.error);
    ids.push((r as { id: string }).id);
  }
  return ids;
};
const ok = (r: ApiResponse) => { expect(r.ok).toBe(true); return r as Extract<ApiResponse, { ok: true }>; };

describe('server: publishing', () => {
  it('accepts a genuine chain, node by node, and tracks depth', async () => {
    const s = new MemoryStore();
    const ids = await asNodes(s, 'alice', chain3);
    expect(ids.length).toBe(3);
    expect([...s.nodes.values()].map((n) => n.depth)).toEqual([1, 2, 3]);
  });

  it('getNode rebuilds exactly the client chain, and hides the proof', async () => {
    const s = new MemoryStore();
    const ids = await asNodes(s, 'alice', chain3);
    const r = ok(await handleRequest(s, 'bob', { op: 'getNode', id: ids[2] })) as { chain: Chain; depth: number; proofHidden: boolean };
    expect(r.depth).toBe(3);
    expect(r.proofHidden).toBe(true);
    expect(r.chain.proof).toEqual([]);
    expect(r.chain.links).toEqual(chain3.links);
    expect(checkChain(r.chain, { requireProof: false }).ok).toBe(true);
    expect(checkChain(r.chain).ok).toBe(false); // no proof => cannot be verified client-side the old way
    expect(s.events.filter((e) => e.kind === 'open').length).toBe(1);
  });

  it('only the hint endpoint reveals the answer, and it really solves the puzzle', async () => {
    const s = new MemoryStore();
    const ids = await asNodes(s, 'alice', chain3);
    const h = ok(await handleRequest(s, 'bob', { op: 'getHint', id: ids[2] })) as { proof: unknown };
    expect(h.proof).toEqual(chain3.proof);
  });

  it('branches: two friends continue the same puzzle', async () => {
    const s = new MemoryStore();
    const ids = await asNodes(s, 'alice', synthesizeChain(2, 1));
    const a = synthesizeChain(2, 2);
    ok(await handleRequest(s, 'bob', createNodeBody(a, ids[0])));
    ok(await handleRequest(s, 'carol', createNodeBody(a, ids[0])));
    expect([...s.nodes.values()].filter((n) => n.parentId === ids[0]).length).toBe(2);
  });
});

describe('server: never trusts the client', () => {
  const body = () => createNodeBody(synthesizeChain(2, 1), null);
  it('rejects a proof that does not solve the new puzzle', async () => {
    const r = await handleRequest(new MemoryStore(), 'mallory', { ...body(), proof: [] });
    expect(r.ok).toBe(false);
    expect((r as { code: string }).code).toBe('invalid_puzzle');
  });
  it('rejects a bogus "solved" solution for the previous puzzle', async () => {
    const r = await handleRequest(new MemoryStore(), 'mallory', { ...body(), solved: [] });
    expect((r as { code: string }).code).toBe('invalid_puzzle');
  });
  it('rejects a twist that is not applicable / wrong seed combination via verification', async () => {
    const b = body();
    const r = await handleRequest(new MemoryStore(), 'mallory', { ...b, seed: (b.seed + 1) >>> 0 });
    // a different seed builds a different puzzle, so the old proof must not (or only by luck) validate
    if (r.ok) expect(checkChain({ v: 1, engine: b.engine, base: b.base, links: [{ rule: b.rule, seed: (b.seed + 1) >>> 0, solved: b.solved }], proof: b.proof }).ok).toBe(true);
    else expect((r as { code: string }).code).toBe('invalid_puzzle');
  });
  it('rejects unknown parent, wrong base, wrong engine, unknown rule, junk', async () => {
    const s = new MemoryStore();
    const b = body();
    expect(((await handleRequest(s, 'm', { ...b, parentId: 'doesnotexist' })) as { code: string }).code).toBe('not_found');
    expect(((await handleRequest(s, 'm', { ...b, engine: 999 })) as { code: string }).code).toBe('engine_mismatch');
    expect(((await handleRequest(s, 'm', { ...b, rule: 'explode' })) as { code: string }).code).toBe('bad_request');
    expect(((await handleRequest(s, 'm', { op: 'nope' })) as { code: string }).code).toBe('bad_request');
    expect(((await handleRequest(s, 'm', null as never)) as { code: string }).code).toBe('bad_request');
    const ids = await asNodes(s, 'a', synthesizeChain(2, 1));
    expect(((await handleRequest(s, 'm', { ...createNodeBody(synthesizeChain(3, 2), ids[0]) })) as { code: string }).code).toBe('bad_request');
  });
  it('rate-limits a spammer', async () => {
    const s = new MemoryStore();
    const b = body();
    for (let i = 0; i < LIMITS.nodesPerHour; i++) ok(await handleRequest(s, 'spam', b, 1000 + i));
    expect(((await handleRequest(s, 'spam', b, 5000)) as { code: string }).code).toBe('rate_limited');
    ok(await handleRequest(s, 'spam', b, 1000 + 3_700_000)); // an hour later it's fine
  });
  it('banned players cannot publish', async () => {
    const s = new MemoryStore();
    s.banned.add('troll');
    expect(((await handleRequest(s, 'troll', body())) as { code: string }).code).toBe('forbidden');
  });
  it('survives 2000 random malformed bodies without throwing', async () => {
    const s = new MemoryStore();
    const rng = new Rng(4);
    const junk = (): unknown => {
      const k = rng.int(7);
      return k === 0 ? rng.int(1e9) : k === 1 ? 'x'.repeat(rng.int(50)) : k === 2 ? null : k === 3 ? [rng.int(5), 'a'] : k === 4 ? { i: 1.5, x: 'a', y: null, a: -1 } : k === 5 ? {} : [{ i: 0, x: 1, y: 2, a: 3 }];
    };
    for (let n = 0; n < 2000; n++) {
      const req: Record<string, unknown> = { op: rng.pick(['createNode', 'getNode', 'getHint', 'recordEvent', 'myNodes', 'zzz']) };
      for (const f of ['parentId', 'base', 'rule', 'seed', 'solved', 'proof', 'engine', 'id', 'kind']) if (rng.chance(0.6)) req[f] = junk();
      await expect(handleRequest(s, 'fuzz', req)).resolves.toBeDefined();
    }
    expect(s.nodes.size).toBe(0);
  });
});

describe('server: events and listing', () => {
  it('records solve/share events and lists my nodes (the gate metrics source)', async () => {
    const s = new MemoryStore();
    const ids = await asNodes(s, 'alice', synthesizeChain(2, 2));
    ok(await handleRequest(s, 'bob', { op: 'recordEvent', id: ids[1], kind: 'solve' }));
    ok(await handleRequest(s, 'bob', { op: 'recordEvent', id: ids[1], kind: 'share' }));
    expect(((await handleRequest(s, 'bob', { op: 'recordEvent', id: ids[1], kind: 'hack' })) as { code: string }).code).toBe('bad_request');
    const mine = ok(await handleRequest(s, 'alice', { op: 'myNodes' })) as { nodes: Array<{ depth: number }> };
    expect(mine.nodes.length).toBe(2);
    expect(s.events.map((e) => e.kind)).toEqual(['solve', 'share']);
  });
});
