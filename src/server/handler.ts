import { ENGINE_VERSION } from '../game/constants';
import { isRuleId } from '../rules';
import { type Chain, checkChain, MAX_CHAIN_DEPTH } from '../social/chain';
import type { RuleId, Solution } from '../game/types';

/**
 * Backend brain. Pure TypeScript with an injected store, so the exact same code runs
 *  - inside the Supabase Edge Function (bundled by `npm run server:build`), and
 *  - in the unit tests against an in-memory store.
 * Principle: the server never trusts a client. Every published node is re-simulated from scratch
 * with the shared deterministic engine (the whole path, plus the new solution and proof).
 */
export interface NodeRow {
  id: string;
  parentId: string | null;
  /** number of links in the path ending at this node (root = 1) */
  depth: number;
  base: string;
  rule: RuleId;
  seed: number;
  /** player's solution to the puzzle BEFORE this node's twist */
  solved: Solution;
  /** solution to the puzzle AFTER this twist (kept private: it is the answer) */
  proof: Solution;
  playerId: string;
  createdAt: number;
  engine: number;
}

export type EventKind = 'open' | 'solve' | 'share' | 'copy';

export interface ServerStore {
  newId(): string;
  getNode(id: string): Promise<NodeRow | null>;
  insertNode(row: NodeRow): Promise<void>;
  countNodesSince(playerId: string, sinceMs: number): Promise<number>;
  addEvent(e: { nodeId: string; userId: string; kind: EventKind; at: number }): Promise<void>;
  listNodesBy(playerId: string, limit: number): Promise<NodeRow[]>;
  isBanned?(playerId: string): Promise<boolean>;
  /** Erases everything tied to this player. Puzzles other people built on stay (detached from the player). */
  deleteUser?(playerId: string): Promise<void>;
}

export type ApiRequest = Record<string, unknown>;
export type ApiError = { ok: false; error: string; code: 'bad_request' | 'not_found' | 'invalid_puzzle' | 'rate_limited' | 'engine_mismatch' | 'forbidden' | 'too_deep' };
export type ApiResponse =
  | ApiError
  | { ok: true; id: string; depth: number }
  | { ok: true; chain: Omit<Chain, 'proof'> & { proof: Solution }; id: string; depth: number; proofHidden: true }
  | { ok: true; proof: Solution }
  | { ok: true; recorded: true }
  | { ok: true; deleted: true }
  | { ok: true; nodes: Array<{ id: string; depth: number; rule: RuleId; createdAt: number }> };

export const LIMITS = { nodesPerHour: 40, maxSolutionPieces: 8 } as const;

const err = (code: ApiError['code'], error: string): ApiError => ({ ok: false, code, error });
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) <= 0xffffffff;

function parseSolution(v: unknown): Solution | null {
  if (!Array.isArray(v) || v.length > LIMITS.maxSolutionPieces) return null;
  const out: Solution = [];
  for (const p of v) {
    if (!p || typeof p !== 'object') return null;
    const o = p as Record<string, unknown>;
    if (!isInt(o.i) || !isInt(o.x) || !isInt(o.y) || !isInt(o.a)) return null;
    out.push({ i: o.i, x: o.x, y: o.y, a: o.a });
  }
  return out;
}

const idOk = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{4,40}$/.test(v);

/** Walks parent pointers root->node. Bounded so a corrupted table can't loop forever. */
async function pathTo(store: ServerStore, id: string): Promise<NodeRow[] | null> {
  const rev: NodeRow[] = [];
  let cur: string | null = id;
  while (cur) {
    if (rev.length > MAX_CHAIN_DEPTH) return null;
    const n = await store.getNode(cur);
    if (!n) return null;
    rev.push(n);
    cur = n.parentId;
  }
  return rev.reverse();
}

const chainOf = (path: NodeRow[], proof: Solution): Chain => ({
  v: 1,
  engine: ENGINE_VERSION,
  base: path[0].base,
  links: path.map((n) => ({ rule: n.rule, seed: n.seed, solved: n.solved })),
  proof,
});

export async function handleRequest(store: ServerStore, userId: string, body: ApiRequest, now = Date.now()): Promise<ApiResponse> {
  if (!body || typeof body !== 'object' || typeof body.op !== 'string') return err('bad_request', 'Malformed request.');
  if (body.op !== 'deleteMe' && store.isBanned && (await store.isBanned(userId))) return err('forbidden', 'This account can’t publish.');

  switch (body.op) {
    case 'createNode': {
      const { parentId, base, rule, seed, engine } = body;
      if (engine !== ENGINE_VERSION) return err('engine_mismatch', 'Please update the app to send this challenge.');
      if (parentId !== null && !idOk(parentId)) return err('bad_request', 'Bad parent.');
      if (typeof base !== 'string' || base.length > 16) return err('bad_request', 'Bad base level.');
      if (!isRuleId(rule) || !isInt(seed)) return err('bad_request', 'Bad twist.');
      const solved = parseSolution(body.solved);
      const proof = parseSolution(body.proof);
      if (!solved || !proof) return err('bad_request', 'Bad solution.');

      if ((await store.countNodesSince(userId, now - 3_600_000)) >= LIMITS.nodesPerHour) return err('rate_limited', 'Slow down a little!');

      let prefix: NodeRow[] = [];
      if (parentId) {
        const p = await pathTo(store, parentId);
        if (!p) return err('not_found', 'That challenge no longer exists.');
        prefix = p;
        if (prefix[0].base !== base) return err('bad_request', 'Base level mismatch.');
      }
      if (prefix.length + 1 > MAX_CHAIN_DEPTH) return err('too_deep', 'This chain is as long as it can get!');

      const candidate: Chain = {
        v: 1,
        engine: ENGINE_VERSION,
        base,
        links: [...prefix.map((n) => ({ rule: n.rule, seed: n.seed, solved: n.solved })), { rule, seed: seed >>> 0, solved }],
        proof,
      };
      const verdict = checkChain(candidate);
      if (!verdict.ok) return err('invalid_puzzle', verdict.error);

      const row: NodeRow = {
        id: store.newId(), parentId: parentId ?? null, depth: prefix.length + 1, base, rule, seed: seed >>> 0,
        solved, proof, playerId: userId, createdAt: now, engine: ENGINE_VERSION,
      };
      await store.insertNode(row);
      return { ok: true, id: row.id, depth: row.depth };
    }

    case 'getNode': {
      if (!idOk(body.id)) return err('bad_request', 'Bad id.');
      const path = await pathTo(store, body.id);
      if (!path) return err('not_found', 'That challenge no longer exists.');
      await store.addEvent({ nodeId: body.id, userId, kind: 'open', at: now });
      const chain = chainOf(path, []);
      return { ok: true, id: body.id, depth: path.length, chain, proofHidden: true };
    }

    case 'getHint': {
      if (!idOk(body.id)) return err('bad_request', 'Bad id.');
      const n = await store.getNode(body.id);
      if (!n) return err('not_found', 'That challenge no longer exists.');
      return { ok: true, proof: n.proof };
    }

    case 'recordEvent': {
      if (!idOk(body.id) || (body.kind !== 'solve' && body.kind !== 'share' && body.kind !== 'copy')) return err('bad_request', 'Bad event.');
      if (!(await store.getNode(body.id))) return err('not_found', 'That challenge no longer exists.');
      await store.addEvent({ nodeId: body.id, userId, kind: body.kind, at: now });
      return { ok: true, recorded: true };
    }

    case 'myNodes': {
      const rows = await store.listNodesBy(userId, 50);
      return { ok: true, nodes: rows.map((r) => ({ id: r.id, depth: r.depth, rule: r.rule, createdAt: r.createdAt })) };
    }

    case 'deleteMe': {
      // Allowed even for banned users (data deletion is a right; the ban list is handled server-side).
      if (!store.deleteUser) return err('bad_request', 'Not supported.');
      await store.deleteUser(userId);
      return { ok: true, deleted: true };
    }

    default:
      return err('bad_request', 'Unknown operation.');
  }
}
