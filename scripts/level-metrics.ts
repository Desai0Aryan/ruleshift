import { ANGLE_STEPS, POS_Q } from '../src/game/constants';
import { BASE_LEVELS } from '../src/game/levels';
import { Rng } from '../src/game/rng';
import { validateSolution } from '../src/game/placement';
import { runSolution } from '../src/game/sim';

/** luck = % of uniformly random full placements that win. Lower = more of a puzzle. */
for (const l of BASE_LEVELS) {
  const rng = new Rng(777);
  let n = 0, wins = 0;
  while (n < 4000) {
    const sol = l.inventory.map((_, i) => ({
      i, x: Math.round(rng.range(l.zone.x, l.zone.x + l.zone.w) * POS_Q),
      y: Math.round(rng.range(l.zone.y, l.zone.y + l.zone.h) * POS_Q), a: rng.int(ANGLE_STEPS),
    }));
    if (validateSolution(l, sol)) continue;
    n++;
    if (runSolution(l, sol).won) wins++;
  }
  console.log(`${l.id} ${l.name.padEnd(18)} luck=${((wins / n) * 100).toFixed(2)}%  empty=${runSolution(l, []).won ? 'WINS' : 'fails'}(${runSolution(l, []).reason})`);
}
