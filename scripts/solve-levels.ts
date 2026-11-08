import { writeFileSync } from 'node:fs';
import { BASE_LEVELS } from '../src/game/levels';
import { runSolution } from '../src/game/sim';
import { solve } from '../src/game/solver';

const out: Record<string, unknown> = {};
let bad = 0;
for (const l of BASE_LEVELS) {
  const trivial = runSolution(l, []).won;
  let best = null as ReturnType<typeof solve> | null;
  const t0 = Date.now();
  for (let seed = 1; seed <= 6 && !(best && best.solved); seed++) best = solve(l, { seed, budget: 12000 });
  const r = best!;
  console.log(`${l.id} ${l.name.padEnd(18)} trivial=${trivial} solved=${r.solved} sims=${r.sims} pieces=${r.solution.length} fit=${r.bestFitness.toFixed(1)} ${Date.now() - t0}ms`);
  if (r.solved && !trivial) out[l.id] = r.solution; else bad++;
}
writeFileSync('src/game/levels.solutions.json', JSON.stringify(out));
console.log(bad === 0 ? 'ALL LEVELS OK' : `${bad} PROBLEM LEVEL(S)`);
process.exit(bad === 0 ? 0 : 1);
