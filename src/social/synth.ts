import { BASE_LEVELS, pinnedSolution } from '../game/levels';
import { solve } from '../game/solver';
import { RULE_ORDER } from '../rules';
import { verifyRuleSync } from '../rules/verify';
import type { RuleId } from '../game/types';
import { type Chain, extendChain, startChain } from './chain';

/**
 * Plays a chain automatically (solver stands in for the players). Used for designer seed chains
 * (cold-start content), tests and demos. Deterministic for the same arguments.
 */
export function synthesizeChain(baseIdx: number, hops: number, opts: { seed?: number; prefer?: RuleId[]; budget?: number } = {}): Chain {
  const base = BASE_LEVELS[baseIdx];
  const budget = opts.budget ?? 4000;
  let chain: Chain | null = null;
  let level = base;
  let solved = pinnedSolution(base.id)!;
  for (let h = 0; h < hops; h++) {
    const order = opts.prefer ? [...opts.prefer.slice(h % opts.prefer.length), ...opts.prefer.slice(0, h % opts.prefer.length), ...RULE_ORDER] : RULE_ORDER.map((_, k) => RULE_ORDER[(h + k) % RULE_ORDER.length]);
    let picked = null as ReturnType<typeof verifyRuleSync> | null;
    for (const id of order) {
      picked = verifyRuleSync(level, id, { budget, baseSeed: (opts.seed ?? 100) + h });
      if (picked.status === 'ok') break;
    }
    if (!picked || picked.status !== 'ok') throw new Error('synthesizeChain: no rule offerable');
    const rule = picked.level.rules[picked.level.rules.length - 1];
    chain = chain
      ? extendChain(chain, rule.id, rule.seed, solved, picked.solution)
      : startChain(base.id, rule.id, rule.seed, solved, picked.solution);
    level = picked.level;
    const next = solve(level, { seed: 2, budget: 8000 });
    if (!next.solved) throw new Error('synthesizeChain: player solver failed');
    solved = next.solution;
  }
  return chain!;
}
