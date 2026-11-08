import { createSolver, type SolveResult } from '../game/solver';
import { runSolution } from '../game/sim';
import type { Level, RuleId, Solution } from '../game/types';
import { applyRule, RULES } from './index';

export type Verdict =
  | { status: 'ok'; level: Level; seed: number; solution: Solution; sims: number }
  | { status: 'not_applicable'; reason: string }
  | { status: 'trivial'; reason: string }
  | { status: 'unsolved'; reason: string };

export interface VerifyOptions {
  baseSeed?: number;
  /** how many different seeds to try for seeded rules */
  attempts?: number;
  /** solver sims per attempt */
  budget?: number;
  onProgress?: (frac: number) => void;
}

/**
 * Applies a rule and PROVES the result is playable: solvable (solver found a winning placement)
 * and not trivial (the empty board must not already win). Seeded rules retry with new seeds.
 * Anti-collapse guarantee for chains: a modified puzzle that is unsolvable or trivial is never offered.
 */
export async function verifyRule(level: Level, id: RuleId, opts: VerifyOptions = {}): Promise<Verdict> {
  const rule = RULES[id];
  const attempts = rule.seeded ? opts.attempts ?? 6 : 1;
  const budget = opts.budget ?? 5000;
  const baseSeed = opts.baseSeed ?? 1;
  let lastReason = 'no variation found';
  let sawTrivial = false;
  for (let a = 0; a < attempts; a++) {
    const seed = (baseSeed + a * 7919) >>> 0;
    const cand = applyRule(level, id, seed);
    if (!cand) {
      if (a === 0 && !rule.seeded) return { status: 'not_applicable', reason: 'Not possible on this puzzle' };
      lastReason = 'Not possible on this puzzle';
      continue;
    }
    if (runSolution(cand, []).won) {
      sawTrivial = true;
      continue;
    }
    const solver = createSolver(cand, { seed: seed + 1, budget });
    while (!solver.done) {
      solver.step(120);
      opts.onProgress?.((a + Math.min(1, solver.sims / budget)) / attempts);
      await tick();
    }
    const r: SolveResult = solver.result();
    if (r.solved) return { status: 'ok', level: cand, seed, solution: r.solution, sims: r.sims };
    lastReason = 'Would make it impossible';
  }
  if (sawTrivial && lastReason === 'no variation found') return { status: 'trivial', reason: 'Would make it too easy' };
  if (lastReason === 'Not possible on this puzzle') return { status: 'not_applicable', reason: lastReason };
  return { status: 'unsolved', reason: lastReason };
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

/** Synchronous variant for scripts/tests. */
export function verifyRuleSync(level: Level, id: RuleId, opts: VerifyOptions = {}): Verdict {
  const rule = RULES[id];
  const attempts = rule.seeded ? opts.attempts ?? 6 : 1;
  const budget = opts.budget ?? 5000;
  const baseSeed = opts.baseSeed ?? 1;
  let reason = 'Would make it impossible';
  let anyCandidate = false;
  let sawTrivial = false;
  for (let a = 0; a < attempts; a++) {
    const seed = (baseSeed + a * 7919) >>> 0;
    const cand = applyRule(level, id, seed);
    if (!cand) continue;
    anyCandidate = true;
    if (runSolution(cand, []).won) { sawTrivial = true; continue; }
    const solver = createSolver(cand, { seed: seed + 1, budget });
    while (!solver.done) solver.step(200);
    const r = solver.result();
    if (r.solved) return { status: 'ok', level: cand, seed, solution: r.solution, sims: r.sims };
  }
  if (!anyCandidate) return { status: 'not_applicable', reason: 'Not possible on this puzzle' };
  if (sawTrivial) reason = 'Would make it too easy';
  return sawTrivial ? { status: 'trivial', reason } : { status: 'unsolved', reason };
}
