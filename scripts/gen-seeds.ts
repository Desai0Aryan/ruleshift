import { writeFileSync } from 'node:fs';
import { BASE_LEVELS } from '../src/game/levels';
import { RULES } from '../src/rules';
import { checkChain } from '../src/social/chain';
import { encodeChain } from '../src/social/codec';
import { synthesizeChain } from '../src/social/synth';
import type { RuleId } from '../src/game/types';

/** Designer seed chains: cold-start content so a brand-new player always has chains to try (PLAN.md risk #3). */
const plan: Array<{ base: number; hops: number; prefer: RuleId[] }> = [
  { base: 0, hops: 1, prefer: ['speed'] },
  { base: 1, hops: 2, prefer: ['duplicate', 'speed'] },
  { base: 2, hops: 2, prefer: ['teleport', 'duplicate'] },
  { base: 3, hops: 3, prefer: ['reverse_gravity', 'speed', 'duplicate'] },
  { base: 4, hops: 2, prefer: ['speed', 'teleport'] },
  { base: 5, hops: 3, prefer: ['duplicate', 'teleport', 'speed'] },
  { base: 6, hops: 2, prefer: ['reverse_gravity', 'duplicate'] },
  { base: 7, hops: 4, prefer: ['speed', 'duplicate', 'teleport', 'reverse_gravity'] },
  { base: 8, hops: 3, prefer: ['teleport', 'speed', 'duplicate'] },
  { base: 9, hops: 2, prefer: ['duplicate', 'speed'] },
];
const out = plan.map((p, n) => {
  const chain = synthesizeChain(p.base, p.hops, { seed: 500 + n * 17, prefer: p.prefer });
  const c = checkChain(chain);
  if (!c.ok) throw new Error('seed invalid ' + n);
  const title = `${BASE_LEVELS[p.base].name}: ${chain.links.map((l) => RULES[l.rule].name).join(' → ')}`;
  console.log(n, title);
  return { title, depth: chain.links.length, code: encodeChain(chain) };
});
writeFileSync('src/social/seeds.generated.json', JSON.stringify(out, null, 1));
console.log(`wrote ${out.length} seed chains`);
