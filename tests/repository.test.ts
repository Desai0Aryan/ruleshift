import { describe, expect, it } from 'vitest';
import { handleRequest } from '../src/server/handler';
import { MemoryStore } from '../src/server/memoryStore';
import { MemoryKV } from '../src/social/kv';
import { HybridRepository, parseNodeId, type Transport } from '../src/social/repository';
import { extendChain } from '../src/social/chain';
import { solve } from '../src/game/solver';
import { verifyRuleSync } from '../src/rules/verify';
import { synthesizeChain } from '../src/social/synth';

const transportFor = (store: MemoryStore, user: string): Transport => ({ call: (b) => handleRequest(store, user, b) });
const offline: Transport = { call: async () => { throw new Error('network down'); } };

describe('hybrid repository (client <-> real server logic, in process)', () => {
  it('full social loop: A publishes, B opens by short link, solves, extends, C opens depth 2', async () => {
    const store = new MemoryStore();
    const alice = new HybridRepository(new MemoryKV(), transportFor(store, 'alice'));
    const bob = new HybridRepository(new MemoryKV(), transportFor(store, 'bob'));
    const carol = new HybridRepository(new MemoryKV(), transportFor(store, 'carol'));

    const c1 = synthesizeChain(3, 1);
    const p1 = await alice.publish(c1, null);
    expect(p1.remote).toBe(true);
    expect(p1.message).toContain(`/c/${p1.id}`);
    expect(p1.message).not.toContain('RS1.'); // short link, no giant code

    const got = await bob.fetch(p1.message); // pasting the whole message works
    expect(got.ok).toBe(true);
    if (!got.ok) return;
    expect(got.challenge.nodeId).toBe(p1.id);
    expect(got.challenge.hint).toEqual([]); // answer is hidden
    expect(got.challenge.depth).toBe(2);
    const hint = await bob.hint(got.challenge);
    expect(hint).toEqual(c1.proof);

    // bob solves (solver stands in), picks a twist, publishes under alice's node
    const solved = solve(got.challenge.level, { seed: 5, budget: 8000 });
    expect(solved.solved).toBe(true);
    let v = null as ReturnType<typeof verifyRuleSync> | null;
    for (const id of ['speed', 'duplicate', 'teleport', 'reverse_gravity'] as const) { v = verifyRuleSync(got.challenge.level, id, { budget: 4000 }); if (v.status === 'ok') break; }
    if (!v || v.status !== 'ok') throw new Error('no twist');
    const r = v.level.rules[v.level.rules.length - 1];
    const c2 = extendChain(got.challenge.chain!, r.id, r.seed, solved.solution, v.solution);
    const p2 = await bob.publish(c2, got.challenge.nodeId!);
    expect(p2.remote).toBe(true);

    const got2 = await carol.fetch(`https://ruleshift.app/c/${p2.id}`);
    expect(got2.ok).toBe(true);
    if (got2.ok) expect(got2.challenge.chain!.links.length).toBe(2);
    expect([...store.nodes.values()].map((n) => n.depth).sort()).toEqual([1, 2]);
  });

  it('falls back to a self-contained code when the server is unreachable, and the code still works', async () => {
    const a = new HybridRepository(new MemoryKV(), offline);
    const c = synthesizeChain(0, 1);
    const p = await a.publish(c, null);
    expect(p.remote).toBe(false);
    expect(p.message).toContain('RS1.');
    const b = new HybridRepository(new MemoryKV(), null);
    const got = await b.fetch(p.message);
    expect(got.ok).toBe(true);
  });

  it('a server rejection is surfaced, not hidden behind an offline code', async () => {
    const store = new MemoryStore();
    const a = new HybridRepository(new MemoryKV(), transportFor(store, 'mallory'));
    const bad = { ...synthesizeChain(0, 1) };
    bad.proof = [];
    await expect(a.publish(bad, null)).rejects.toThrow();
  });

  it('keeps "My chains" history on device (remote + offline), newest first, capped', async () => {
    const kv = new MemoryKV();
    const store = new MemoryStore();
    const r = new HybridRepository(kv, transportFor(store, 'alice'));
    await r.publish(synthesizeChain(0, 1), null);
    const off = new HybridRepository(kv, offline);
    await off.publish(synthesizeChain(1, 1), null);
    const mine = await r.mine();
    expect(mine.length).toBe(2);
    expect(mine[0].remote).toBe(false);
    expect(mine[1].remote).toBe(true);
    expect(r.chainFor(mine[0])?.base).toBe('L02');
  });

  it('rejects junk and offline lookups of online links with friendly errors', async () => {
    const r = new HybridRepository(new MemoryKV(), null);
    expect((await r.fetch('hello world!')).ok).toBe(false);
    const x = await r.fetch('abcd1234');
    expect(x.ok).toBe(false);
    const withNet = new HybridRepository(new MemoryKV(), transportFor(new MemoryStore(), 'x'));
    const nf = await withNet.fetch('zzzzzzzz');
    expect(nf.ok).toBe(false);
  });

  it('a deep chain that arrived as an offline code is re-shared as a code (cannot join the server tree)', async () => {
    const store = new MemoryStore();
    const r = new HybridRepository(new MemoryKV(), transportFor(store, 'dave'));
    const p = await r.publish(synthesizeChain(2, 3), null);
    expect(p.remote).toBe(false);
    expect(p.message).toContain('RS1.');
    expect(store.nodes.size).toBe(0);
  });

  it('parses node ids from links and bare ids', () => {
    expect(parseNodeId('https://ruleshift.app/c/abc23xyz')).toBe('abc23xyz');
    expect(parseNodeId('  abc23xyz ')).toBe('abc23xyz');
    expect(parseNodeId('no way!')).toBeNull();
  });
});
