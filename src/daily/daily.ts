import { BASE_LEVELS, pinnedSolution } from '../game/levels';
import { Rng } from '../game/rng';
import type { RuleId } from '../game/types';
import { RULE_ORDER } from '../rules';
import { verifyRule } from '../rules/verify';
import { type Chain, extendChain, startChain } from '../social/chain';
import { decodeChain, encodeChain } from '../social/codec';
import { challengeFromChain, type Challenge } from '../social/flow';
import type { KV } from '../social/kv';

/**
 * Daily puzzle. Everyone on the same calendar date gets the SAME puzzle with no server involved:
 * the date picks a base level and a rule order, and the (deterministic) solver proves each twist is
 * playable. Same engine + same date => same puzzle on every device. The server only needs to collect
 * results later (leaderboard); it never has to distribute the puzzle.
 */

/** First daily is #1. Move this only before launch. */
export const DAILY_EPOCH_DAY = Math.floor(Date.UTC(2026, 10, 9) / 86400000);

/** Day number from the player's LOCAL calendar date, so "today's puzzle" flips at their midnight. */
export function dayIndex(d: Date = new Date()): number {
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}
export const dailyNumber = (day: number) => Math.max(1, day - DAILY_EPOCH_DAY + 1);
/** 0 = Sunday ... 6 = Saturday (1970-01-01 was a Thursday) */
export const weekday = (day: number) => (((day + 4) % 7) + 7) % 7;

export interface DailySpec { day: number; baseIdx: number; hops: number; seed: number; tier: 'easy' | 'medium' | 'hard' }

/** Difficulty ramps through the week: gentle Mon/Tue, harder toward the weekend. */
export function dailySpec(day: number): DailySpec {
  const dow = weekday(day);
  const tier: DailySpec['tier'] = dow === 1 || dow === 2 ? 'easy' : dow === 6 || dow === 0 ? 'hard' : 'medium';
  const rng = new Rng(Math.imul(day, 2654435761) ^ 0xa5a5a5a5);
  const third = Math.floor(BASE_LEVELS.length / 3);
  const lo = tier === 'easy' ? 0 : tier === 'medium' ? third : third * 2;
  const hi = tier === 'easy' ? third : tier === 'medium' ? third * 2 : BASE_LEVELS.length;
  const baseIdx = lo + rng.int(hi - lo);
  const hops = tier === 'easy' ? 1 : tier === 'medium' ? 1 + rng.int(2) : 2;
  return { day, baseIdx, hops, tier, seed: (rng.next() * 0xffffff) | 0 };
}

function shuffled(rng: Rng): RuleId[] {
  const pool = [...RULE_ORDER];
  const out: RuleId[] = [];
  while (pool.length) out.push(pool.splice(rng.int(pool.length), 1)[0]);
  return out;
}

/** Builds the day's chain. Async (yields to the UI) because the solver proves every twist. */
export async function buildDailyChain(day: number, onProgress?: (frac: number) => void): Promise<Chain> {
  const spec = dailySpec(day);
  const rng = new Rng(spec.seed);
  let level = BASE_LEVELS[spec.baseIdx];
  let solved = pinnedSolution(level.id)!;
  let chain: Chain | null = null;
  for (let h = 0; h < spec.hops; h++) {
    let picked: Awaited<ReturnType<typeof verifyRule>> | null = null;
    for (const id of shuffled(rng)) {
      const v = await verifyRule(level, id, { baseSeed: spec.seed + h * 101, budget: 3500, onProgress: (f) => onProgress?.((h + f * 0.5) / spec.hops) });
      if (v.status === 'ok') { picked = v; break; }
    }
    if (!picked || picked.status !== 'ok') throw new Error('daily: no playable twist found');
    const applied = picked.level.rules[picked.level.rules.length - 1];
    chain = chain
      ? extendChain(chain, applied.id, applied.seed, solved, picked.solution)
      : startChain(level.base, applied.id, applied.seed, solved, picked.solution);
    level = picked.level;
    solved = picked.solution; // the proof for this level is the "player's solution" for the next link
    onProgress?.((h + 1) / spec.hops);
  }
  return chain!;
}

export type DailyChallenge = Challenge & { day: number };

const cacheKey = (day: number) => `ruleshift.daily.v1.${day}`;
const memo = new Map<number, Promise<Chain>>();

/** Cached per day (a rebuilt chain is byte-identical anyway). Corrupt/foreign cache entries are ignored. */
export function getDailyChain(day: number, kv?: KV, onProgress?: (frac: number) => void): Promise<Chain> {
  let p = memo.get(day);
  if (!p) {
    p = (async () => {
      if (kv) {
        try {
          const raw = await kv.get(cacheKey(day));
          if (raw) {
            const d = decodeChain(raw);
            if (d.ok) { const c = challengeFromChain(d.chain); if (c.ok) return d.chain; }
          }
        } catch { /* fall through and rebuild */ }
      }
      const chain = await buildDailyChain(day, onProgress);
      if (kv) { try { await kv.set(cacheKey(day), encodeChain(chain)); } catch { /* ignore */ } }
      return chain;
    })();
    memo.set(day, p);
    p.catch(() => memo.delete(day));
  }
  return p;
}

export async function getDailyChallenge(day: number, kv?: KV, onProgress?: (frac: number) => void): Promise<DailyChallenge> {
  const chain = await getDailyChain(day, kv, onProgress);
  const r = challengeFromChain(chain);
  if (!r.ok) throw new Error(r.error);
  return { ...r.challenge, source: 'daily', day };
}

export function dailyShareText(day: number, result: { attempts: number; pieces: number }, streak: number): string {
  const tries = result.attempts === 1 ? 'first try' : `${result.attempts} tries`;
  const fire = streak >= 2 ? ` · 🔥${streak}` : '';
  return `RULESHIFT Daily #${dailyNumber(day)} ✅ ${tries} · ${result.pieces} piece${result.pieces === 1 ? '' : 's'}${fire}\nCan you beat it? https://ruleshift.app`;
}
