import { ANGLE_STEPS, POS_Q } from './constants';
import { validateSolution } from './placement';
import { Rng } from './rng';
import { runSolution } from './sim';
import type { Level, Placement, Solution } from './types';

/**
 * Deterministic stochastic solver: seeded random sampling biased toward the ball's own path,
 * then hill-climbing on "closest approach to the target". Same (level, seed, budget) => same answer.
 *
 * Used to (1) prove a rule-modified puzzle is solvable before it is sent, (2) pin solutions for
 * authored levels, (3) produce hints.
 */
export interface SolveOptions {
  seed?: number;
  /** max simulations to spend */
  budget?: number;
}
export interface SolveResult {
  solved: boolean;
  solution: Solution;
  sims: number;
  bestFitness: number;
}

interface Scored { sol: Solution; fit: number; trace: Array<[number, number]> }

export interface Solver {
  step(n: number): void;
  readonly done: boolean;
  readonly sims: number;
  result(): SolveResult;
}

export function createSolver(level: Level, opts: SolveOptions = {}): Solver {
  const rng = new Rng((opts.seed ?? 1) * 2654435761 + 12345);
  const budget = opts.budget ?? 6000;
  const inv = level.inventory;
  const z = level.zone;
  let sims = 0;
  let done = false;
  let solved: Solution | null = null;
  let best: Scored | null = null;
  const pool: Scored[] = [];
  const POOL = 8;

  const clampP = (p: Placement): Placement => ({
    i: p.i,
    x: Math.max(Math.ceil(z.x * POS_Q), Math.min(Math.floor((z.x + z.w) * POS_Q), p.x)),
    y: Math.max(Math.ceil(z.y * POS_Q), Math.min(Math.floor((z.y + z.h) * POS_Q), p.y)),
    a: ((p.a % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS,
  });

  function evaluate(sol: Solution): Scored | null {
    if (validateSolution(level, sol) !== null) return null;
    sims++;
    const r = runSolution(level, sol, { trace: true });
    const s: Scored = { sol, fit: r.fitness, trace: r.trace ?? [] };
    if (r.won) {
      solved = sol;
      done = true;
    }
    return s;
  }

  function randomPlacement(i: number, near?: Array<[number, number]>): Placement {
    let x: number;
    let y: number;
    if (near && near.length > 0 && rng.chance(0.7)) {
      const [px, py] = rng.pick(near);
      x = px + rng.range(-14, 14);
      y = py + rng.range(-6, 18);
    } else {
      x = rng.range(z.x, z.x + z.w);
      y = rng.range(z.y, z.y + z.h);
    }
    return clampP({ i, x: Math.round(x * POS_Q), y: Math.round(y * POS_Q), a: rng.int(ANGLE_STEPS) });
  }

  function randomSolution(): Solution {
    const near = best?.trace ?? pool[0]?.trace;
    const sol: Solution = [];
    for (let i = 0; i < inv.length; i++) {
      if (sol.length > 0 && rng.chance(0.18)) continue;
      sol.push(randomPlacement(i, near));
    }
    return sol;
  }

  function mutate(parent: Solution): Solution {
    const sol = parent.map((p) => ({ ...p }));
    const roll = rng.next();
    if (sol.length === 0) return randomSolution();
    const k = rng.int(sol.length);
    if (roll < 0.4) {
      const m = rng.chance(0.5) ? 3 : 12;
      sol[k] = clampP({ ...sol[k], x: sol[k].x + Math.round(rng.range(-m, m) * POS_Q), y: sol[k].y + Math.round(rng.range(-m, m) * POS_Q) });
    } else if (roll < 0.7) {
      const m = rng.chance(0.5) ? 2 : 9;
      sol[k] = clampP({ ...sol[k], a: sol[k].a + Math.round(rng.range(-m, m)) });
    } else if (roll < 0.82) {
      sol[k] = randomPlacement(sol[k].i, best?.trace);
    } else if (roll < 0.92) {
      const used = new Set(sol.map((p) => p.i));
      const free = inv.map((_, i) => i).filter((i) => !used.has(i));
      if (free.length > 0) sol.push(randomPlacement(rng.pick(free), best?.trace));
      else if (sol.length > 1) sol.splice(k, 1);
    } else if (sol.length > 1) {
      sol.splice(k, 1);
    } else {
      sol[k] = randomPlacement(sol[k].i, best?.trace);
    }
    return sol;
  }

  function consider(s: Scored | null) {
    if (!s) return;
    if (!best || s.fit < best.fit) best = s;
    if (pool.length < POOL) pool.push(s);
    else {
      let wi = 0;
      for (let i = 1; i < pool.length; i++) if (pool[i].fit > pool[wi].fit) wi = i;
      if (s.fit < pool[wi].fit) pool[wi] = s;
    }
  }

  // Nothing to place: the empty solution is the only candidate.
  if (inv.length === 0) {
    consider(evaluate([]));
    done = true;
  } else {
    // Seed the pool with the "do nothing" attempt so its trace guides sampling.
    consider(evaluate([]));
  }

  const explore = Math.max(60, Math.floor(budget * 0.25));
  return {
    step(n: number) {
      for (let k = 0; k < n && !done; k++) {
        if (sims >= budget) {
          done = true;
          break;
        }
        if (sims < explore || pool.length === 0) consider(evaluate(randomSolution()));
        else consider(evaluate(mutate(rng.pick(pool).sol)));
      }
    },
    get done() { return done || sims >= budget; },
    get sims() { return sims; },
    result(): SolveResult {
      return { solved: solved !== null, solution: solved ?? best?.sol ?? [], sims, bestFitness: solved ? 0 : best?.fit ?? Infinity };
    },
  };
}

export function solve(level: Level, opts: SolveOptions = {}): SolveResult {
  const s = createSolver(level, opts);
  while (!s.done) s.step(200);
  return s.result();
}

/** Yields to the event loop between batches so a UI thread stays responsive. */
export async function solveAsync(level: Level, opts: SolveOptions & { onProgress?: (frac: number) => void } = {}): Promise<SolveResult> {
  const s = createSolver(level, opts);
  const budget = opts.budget ?? 6000;
  while (!s.done) {
    s.step(150);
    opts.onProgress?.(Math.min(1, s.sims / budget));
    await new Promise<void>((r) => setTimeout(r, 0));
  }
  return s.result();
}
