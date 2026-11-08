import { fnv1a } from '../game/rng';
import type { Solution } from '../game/types';
import type { ApiResponse } from '../server/handler';
import { createNodeBody } from '../server/payload';
import { RULES } from '../rules';
import type { Chain } from './chain';
import { decodeChain, encodeChain } from './codec';
import { type Challenge, challengeFromChain } from './flow';
import type { KV } from './kv';
import { extractCode, shareMessage, shareUrl } from './links';
import type { RuleId } from '../game/types';

export interface PublishResult {
  /** server node id (remote) or a local id derived from the code */
  id: string;
  /** what the friend gets: short link (remote) or code-bearing link (offline) */
  message: string;
  remote: boolean;
}

export interface MyChain { id: string; depth: number; rule: RuleId; createdAt: number; remote: boolean; code: string }

export type FetchResult = { ok: true; challenge: Challenge } | { ok: false; error: string };

export interface ChainRepository {
  publish(chain: Chain, parentNodeId: string | null): Promise<PublishResult>;
  fetch(idOrCodeOrText: string): Promise<FetchResult>;
  hint(challenge: Challenge): Promise<Solution>;
  event(challenge: Challenge | null, nodeId: string | undefined, kind: 'solve' | 'share' | 'copy'): Promise<void>;
  mine(): Promise<MyChain[]>;
  /** loads a stored chain (for replay) by history id */
  chainFor(entry: MyChain): Chain | null;
}

/** Sends one request to the backend. Real impl = Supabase Edge Function; tests plug the handler in directly. */
export interface Transport { call(body: Record<string, unknown>): Promise<ApiResponse> }

const HISTORY_KEY = 'ruleshift.mychains.v1';
const MAX_HISTORY = 60;

/**
 * Hybrid repository: uses the backend when there is one and it is reachable, and silently degrades to
 * self-contained share codes otherwise. Every published chain is also kept in on-device history ("My chains"),
 * which is what lets you re-share or replay anything you made, even offline.
 */
export class HybridRepository implements ChainRepository {
  constructor(private kv: KV, private transport: Transport | null) {}

  private async history(): Promise<MyChain[]> {
    try { return JSON.parse((await this.kv.get(HISTORY_KEY)) ?? '[]') as MyChain[]; } catch { return []; }
  }
  private async remember(entry: MyChain) {
    const h = (await this.history()).filter((x) => x.id !== entry.id);
    h.unshift(entry);
    await this.kv.set(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY)));
  }

  async publish(chain: Chain, parentNodeId: string | null): Promise<PublishResult> {
    const last = chain.links[chain.links.length - 1];
    const code = encodeChain(chain);
    let rejection: string | null = null;
    // A chain that arrived as an offline code has no server ancestry, so it can't be attached to the server tree.
    const attachable = parentNodeId !== null || chain.links.length === 1;
    if (this.transport && attachable) {
      try {
        const r = await this.transport.call(createNodeBody(chain, parentNodeId));
        if (r.ok && 'id' in r) {
          await this.remember({ id: r.id, depth: chain.links.length, rule: last.rule, createdAt: Date.now(), remote: true, code });
          return { id: r.id, remote: true, message: shareMessage(chain, shareUrl(r.id)) };
        }
        // Content the server judged invalid is a definitive "no": never paper over it with a code.
        if (!r.ok && (r.code === 'invalid_puzzle' || r.code === 'bad_request' || r.code === 'not_found' || r.code === 'too_deep')) rejection = r.error;
        // rate_limited / engine_mismatch / forbidden: degrade to an offline code below.
      } catch { /* offline or server down: degrade to an offline code below */ }
    }
    if (rejection) throw new Error(rejection);
    const id = `l${fnv1a(code).toString(36)}`;
    await this.remember({ id, depth: chain.links.length, rule: last.rule, createdAt: Date.now(), remote: false, code });
    return { id, remote: false, message: shareMessage(chain) };
  }

  async fetch(input: string): Promise<FetchResult> {
    const code = extractCode(input);
    if (code) {
      const d = decodeChain(code);
      if (!d.ok) return d;
      return challengeFromChain(d.chain);
    }
    const id = parseNodeId(input);
    if (!id) return { ok: false, error: 'That doesn’t look like a RULESHIFT challenge.' };
    if (!this.transport) return { ok: false, error: 'This challenge is online. Connect to the internet and try again.' };
    let r: ApiResponse;
    try { r = await this.transport.call({ op: 'getNode', id }); } catch { return { ok: false, error: 'Couldn’t reach the server. Check your connection.' }; }
    if (!r.ok) return { ok: false, error: r.error };
    if (!('chain' in r)) return { ok: false, error: 'Unexpected server answer.' };
    return challengeFromChain(r.chain, { nodeId: r.id, proofHidden: true });
  }

  async hint(challenge: Challenge): Promise<Solution> {
    if (challenge.hint.length > 0) return challenge.hint;
    if (this.transport && challenge.nodeId) {
      try {
        const r = await this.transport.call({ op: 'getHint', id: challenge.nodeId });
        if (r.ok && 'proof' in r) return r.proof;
      } catch { /* offline */ }
    }
    return [];
  }

  async event(_c: Challenge | null, nodeId: string | undefined, kind: 'solve' | 'share' | 'copy'): Promise<void> {
    if (!this.transport || !nodeId) return;
    try { await this.transport.call({ op: 'recordEvent', id: nodeId, kind }); } catch { /* analytics must never break play */ }
  }

  async mine(): Promise<MyChain[]> { return this.history(); }

  chainFor(entry: MyChain): Chain | null {
    const d = decodeChain(entry.code);
    return d.ok ? d.chain : null;
  }
}

/** Accepts a bare node id, or a link ending in /c/<id>. */
export function parseNodeId(input: string): string | null {
  const t = input.trim();
  const m = t.match(/\/c\/([A-Za-z0-9_-]{4,40})\b/) ?? t.match(/^([A-Za-z0-9_-]{4,40})$/);
  return m ? m[1] : null;
}

export const ruleName = (id: RuleId) => RULES[id].name;
