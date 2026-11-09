import { ENGINE_VERSION } from '../game/constants';
import { checkCustom, type CustomDef } from '../game/custom';
import { getBaseLevel } from '../game/levels';
import { validateSolution } from '../game/placement';
import { runSolution } from '../game/sim';
import type { Level, RuleId, Solution } from '../game/types';
import { applyRule } from '../rules';

/**
 * A chain is the whole life of a puzzle as it is passed around.
 *   level_0 = authored base level
 *   level_k = applyRule(level_{k-1}, links[k-1].rule, links[k-1].seed)
 * links[k-1].solved is the SOLUTION the k-th player found for level_{k-1} (that is what unlocked the
 * right to pick the next rule). `proof` is a solution for the final level so nobody can ship an
 * unsolvable puzzle; receivers verify it with a single simulation (no solver needed).
 *
 * Everything needed to replay the whole evolution is stored as inputs (not video).
 */
export interface ChainLink { rule: RuleId; seed: number; solved: Solution }
export interface Chain {
  /** share-format version */
  v: 1;
  engine: number;
  base: string;
  /** present when the chain starts from a player-made puzzle (then `base` must equal its derived id) */
  custom?: CustomDef;
  links: ChainLink[];
  proof: Solution;
}

export const MAX_CHAIN_DEPTH = 40;

export type ChainCheck =
  | { ok: true; levels: Level[] }
  | { ok: false; error: string };

/** Rebuilds every level of the chain and verifies every stored solution. Treat chains as untrusted input. */
export function checkChain(chain: Chain, opts: { requireProof?: boolean } = {}): ChainCheck {
  if (chain.engine !== ENGINE_VERSION) return { ok: false, error: 'This challenge was made with a different game version.' };
  if (chain.links.length > MAX_CHAIN_DEPTH) return { ok: false, error: 'Chain too long.' };
  let base;
  if (chain.custom) {
    const cc = checkCustom(chain.custom);
    if (!cc.ok) return { ok: false, error: cc.error };
    if (cc.level.id !== chain.base) return { ok: false, error: 'Puzzle id mismatch.' };
    base = cc.level;
  } else {
    base = getBaseLevel(chain.base);
  }
  if (!base) return { ok: false, error: 'Unknown starting puzzle.' };
  const levels: Level[] = [base];
  for (let k = 0; k < chain.links.length; k++) {
    const link = chain.links[k];
    const cur = levels[k];
    const err = validateSolution(cur, link.solved);
    if (err) return { ok: false, error: `Step ${k + 1}: ${err}` };
    if (!runSolution(cur, link.solved).won) return { ok: false, error: `Step ${k + 1}: solution does not solve the puzzle.` };
    const next = applyRule(cur, link.rule, link.seed);
    if (!next) return { ok: false, error: `Step ${k + 1}: rule can't be applied.` };
    levels.push(next);
  }
  const last = levels[levels.length - 1];
  // Server-delivered chains hide the proof (it would be the answer); the server verified it at publish time.
  if (opts.requireProof === false && chain.proof.length === 0) return { ok: true, levels };
  const perr = validateSolution(last, chain.proof);
  if (perr) return { ok: false, error: `Proof: ${perr}` };
  if (!runSolution(last, chain.proof).won) return { ok: false, error: 'This puzzle can’t be solved.' };
  return { ok: true, levels };
}

export function currentLevel(chain: Chain): Level | null {
  const c = checkChain(chain);
  return c.ok ? c.levels[c.levels.length - 1] : null;
}

/**
 * Called after a player solved the chain's current puzzle and picked a (verified) rule.
 *  solved   = the player's own solution to the current puzzle
 *  nextProof= a solution to the NEW puzzle (from verifyRule)
 */
export function extendChain(chain: Chain, rule: RuleId, seed: number, solved: Solution, nextProof: Solution): Chain {
  return { ...chain, links: [...chain.links, { rule, seed, solved }], proof: nextProof };
}

/** Starts a brand-new chain from an authored level the player just solved. */
export function startChain(baseId: string, rule: RuleId, seed: number, solved: Solution, nextProof: Solution, custom?: CustomDef): Chain {
  return { v: 1, engine: ENGINE_VERSION, base: baseId, ...(custom ? { custom } : {}), links: [{ rule, seed, solved }], proof: nextProof };
}

export const chainDepth = (c: Chain) => c.links.length;
