import { getBaseLevel, pinnedSolution } from '../game/levels';
import type { Level, RuleId, Solution } from '../game/types';
import { type Chain, checkChain, extendChain, startChain } from './chain';

/**
 * What the player is currently trying to solve, and where it came from.
 * `hint` is a known-good solution used for hints (authored levels: pinned; friend challenges: the
 * sender's proof). NOTE: Part 2 moves proofs server-side so hints can't leak through share codes.
 */
export interface Challenge {
  level: Level;
  /** null for an authored level that has not been modified yet */
  chain: Chain | null;
  hint: Solution;
  /** 1-based hop number the player is about to add */
  depth: number;
  source: 'campaign' | 'friend';
  /** server node this puzzle came from (remote challenges only) */
  nodeId?: string;
}

export function challengeFromBase(id: string): Challenge | null {
  const level = getBaseLevel(id);
  if (!level) return null;
  return { level, chain: null, hint: pinnedSolution(id) ?? [], depth: 1, source: 'campaign' };
}

export function challengeFromChain(
  chain: Chain,
  opts: { nodeId?: string; proofHidden?: boolean } = {},
): { ok: true; challenge: Challenge } | { ok: false; error: string } {
  const c = checkChain(chain, { requireProof: !opts.proofHidden });
  if (!c.ok) return c;
  return {
    ok: true,
    challenge: { level: c.levels[c.levels.length - 1], chain, hint: chain.proof, depth: chain.links.length + 1, source: 'friend', nodeId: opts.nodeId },
  };
}

/** After solving + picking a VERIFIED rule, produce the chain to send on. */
export function passItOn(ch: Challenge, solved: Solution, rule: { id: RuleId; seed: number }, nextProof: Solution): Chain {
  return ch.chain
    ? extendChain(ch.chain, rule.id, rule.seed, solved, nextProof)
    : startChain(ch.level.base, rule.id, rule.seed, solved, nextProof);
}
