import { describe, expect, it } from 'vitest';
import { buildDailyChain, dailyNumber, dailyShareText, dailySpec, dayIndex, DAILY_EPOCH_DAY, getDailyChain, weekday } from '../src/daily/daily';
import { emptyProgress, liveStreak, parseProgress, recordSolve } from '../src/daily/progress';
import { BASE_LEVELS } from '../src/game/levels';
import { checkChain } from '../src/social/chain';
import { encodeChain } from '../src/social/codec';
import { MemoryKV } from '../src/social/kv';

describe('daily puzzle', () => {
  it('day index uses the local calendar date and weekday math is right', () => {
    expect(dayIndex(new Date(2026, 10, 9, 0, 1))).toBe(DAILY_EPOCH_DAY);
    expect(dayIndex(new Date(2026, 10, 9, 23, 59))).toBe(DAILY_EPOCH_DAY);
    expect(dayIndex(new Date(2026, 10, 10, 0, 0))).toBe(DAILY_EPOCH_DAY + 1);
    expect(weekday(dayIndex(new Date(2026, 10, 9)))).toBe(1); // Monday
    expect(weekday(0)).toBe(4); // Thursday 1970-01-01
    expect(dailyNumber(DAILY_EPOCH_DAY)).toBe(1);
    expect(dailyNumber(DAILY_EPOCH_DAY - 50)).toBe(1);
  });
  it('spec is deterministic and ramps difficulty through the week', () => {
    for (let d = DAILY_EPOCH_DAY; d < DAILY_EPOCH_DAY + 60; d++) {
      expect(dailySpec(d)).toEqual(dailySpec(d));
      const s = dailySpec(d);
      expect(s.baseIdx).toBeGreaterThanOrEqual(0);
      expect(s.baseIdx).toBeLessThan(BASE_LEVELS.length);
      if (s.tier === 'easy') expect(s.baseIdx).toBeLessThan(8);
      if (s.tier === 'hard') expect(s.baseIdx).toBeGreaterThanOrEqual(16);
    }
    const tiers = new Set(Array.from({ length: 7 }, (_, i) => dailySpec(DAILY_EPOCH_DAY + i).tier));
    expect(tiers.size).toBe(3);
  });
  it('every day in a two-week window builds a verified, identical-every-time puzzle', async () => {
    for (let d = DAILY_EPOCH_DAY; d < DAILY_EPOCH_DAY + 14; d++) {
      const a = await buildDailyChain(d);
      const b = await buildDailyChain(d);
      expect(encodeChain(a)).toBe(encodeChain(b));
      expect(a.links.length).toBe(dailySpec(d).hops);
      expect(checkChain(a).ok).toBe(true);
    }
  }, 120000);
  it('different days give different puzzles', async () => {
    const codes = new Set<string>();
    for (let d = DAILY_EPOCH_DAY; d < DAILY_EPOCH_DAY + 7; d++) codes.add(encodeChain(await buildDailyChain(d)));
    expect(codes.size).toBe(7);
  }, 60000);
  it('caches per day and survives a corrupt cache entry', async () => {
    const kv = new MemoryKV();
    const day = DAILY_EPOCH_DAY + 100;
    const a = await getDailyChain(day, kv);
    expect(kv.m.get(`ruleshift.daily.v1.${day}`)).toBe(encodeChain(a));
    const kv2 = new MemoryKV();
    const day2 = DAILY_EPOCH_DAY + 101;
    kv2.m.set(`ruleshift.daily.v1.${day2}`, 'garbage');
    const b = await getDailyChain(day2, kv2);
    expect(checkChain(b).ok).toBe(true);
    expect(kv2.m.get(`ruleshift.daily.v1.${day2}`)).toBe(encodeChain(b));
  }, 60000);
  it('share text', () => {
    const t = dailyShareText(DAILY_EPOCH_DAY + 2, { attempts: 1, pieces: 2 }, 5);
    expect(t).toContain('Daily #3');
    expect(t).toContain('first try');
    expect(t).toContain('🔥5');
    expect(dailyShareText(DAILY_EPOCH_DAY, { attempts: 4, pieces: 1 }, 1)).not.toContain('🔥');
  });
});

describe('streaks', () => {
  const r = { attempts: 2, pieces: 2 };
  it('consecutive days build a streak, same day is idempotent', () => {
    let p = emptyProgress();
    p = recordSolve(p, 100, r);
    p = recordSolve(p, 101, r);
    p = recordSolve(p, 101, { attempts: 3, pieces: 3 });
    expect(p.streak).toBe(2);
    expect(p.total).toBe(2);
    expect(p.results['101']).toEqual(r); // worse re-solve ignored
    p = recordSolve(p, 101, { attempts: 1, pieces: 2 });
    expect(p.results['101'].attempts).toBe(1); // better kept
    expect(p.streak).toBe(2);
  });
  it('a missed day resets the streak without a freeze', () => {
    let p = recordSolve(recordSolve(emptyProgress(), 100, r), 101, r);
    p = recordSolve(p, 103, r);
    expect(p.streak).toBe(1);
    expect(p.best).toBe(2);
  });
  it('7 days earn a freeze, which covers exactly one missed day', () => {
    let p = emptyProgress();
    for (let d = 0; d < 7; d++) p = recordSolve(p, 200 + d, r);
    expect(p.streak).toBe(7);
    expect(p.freezes).toBe(1);
    p = recordSolve(p, 208, r); // missed 207
    expect(p.streak).toBe(8);
    expect(p.freezes).toBe(0);
    p = recordSolve(p, 211, r); // missed two days: freeze can't help
    expect(p.streak).toBe(1);
  });
  it('freezes are capped', () => {
    let p = emptyProgress();
    for (let d = 0; d < 30; d++) p = recordSolve(p, 300 + d, r);
    expect(p.freezes).toBeLessThanOrEqual(2);
  });
  it('clock going backwards never breaks progress', () => {
    let p = recordSolve(recordSolve(emptyProgress(), 100, r), 101, r);
    const q = recordSolve(p, 90, r);
    expect(q).toEqual(p);
  });
  it('liveStreak reflects what Home should show', () => {
    let p = recordSolve(recordSolve(emptyProgress(), 100, r), 101, r);
    expect(liveStreak(p, 101)).toMatchObject({ streak: 2, doneToday: true });
    expect(liveStreak(p, 102)).toMatchObject({ streak: 2, doneToday: false, atRisk: true, usesFreeze: false });
    expect(liveStreak(p, 103)).toMatchObject({ streak: 0 });
    for (let d = 102; d < 107; d++) p = recordSolve(p, d, r); // reaches 7 -> freeze
    expect(liveStreak(p, p.lastDay! + 2)).toMatchObject({ streak: 7, usesFreeze: true });
    expect(liveStreak(emptyProgress(), 5).streak).toBe(0);
  });
  it('parseProgress survives garbage', () => {
    expect(parseProgress('not json')).toEqual(emptyProgress());
    expect(parseProgress(null)).toEqual(emptyProgress());
    expect(parseProgress('{"streak":"x","freezes":99,"results":{"a":1,"5":{"attempts":1,"pieces":2}}}')).toMatchObject({ streak: 0, freezes: 2, results: { '5': { attempts: 1, pieces: 2 } } });
  });
});
