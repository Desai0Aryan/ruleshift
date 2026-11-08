import { BASE_LEVELS } from '../src/game/levels';
import { RULE_ORDER } from '../src/rules';
import { verifyRuleSync } from '../src/rules/verify';

console.log('level'.padEnd(22) + RULE_ORDER.map((r) => r.padEnd(18)).join(''));
const tally: Record<string, Record<string, number>> = {};
for (const l of BASE_LEVELS) {
  let row = `${l.id} ${l.name}`.padEnd(22);
  for (const r of RULE_ORDER) {
    const t0 = Date.now();
    const v = verifyRuleSync(l, r, { budget: 5000 });
    tally[r] = tally[r] ?? {};
    tally[r][v.status] = (tally[r][v.status] ?? 0) + 1;
    row += `${v.status}${v.status === 'ok' ? `(${v.sims})` : ''} ${Date.now() - t0}ms`.padEnd(18);
  }
  console.log(row);
}
console.log(JSON.stringify(tally));
