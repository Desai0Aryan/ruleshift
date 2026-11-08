/** Pure streak/results logic for the daily puzzle (persisted by the UI layer). */
export interface DailyResult { attempts: number; pieces: number }
export interface DailyProgress {
  v: 1;
  lastDay: number | null;
  streak: number;
  best: number;
  /** each full week of streak earns one freeze (max 2); a freeze covers ONE missed day */
  freezes: number;
  total: number;
  results: Record<string, DailyResult>;
}

export const MAX_FREEZES = 2;
export const FREEZE_EVERY = 7;
const KEEP_RESULTS = 60;

export const emptyProgress = (): DailyProgress => ({ v: 1, lastDay: null, streak: 0, best: 0, freezes: 0, total: 0, results: {} });

export function recordSolve(p: DailyProgress, day: number, result: DailyResult): DailyProgress {
  const prev = p.results[String(day)];
  if (p.lastDay === day) {
    // Re-solving the same day never changes the streak; only a better result is kept.
    if (prev && (result.attempts < prev.attempts || (result.attempts === prev.attempts && result.pieces < prev.pieces))) {
      return { ...p, results: { ...p.results, [String(day)]: result } };
    }
    return p;
  }
  if (p.lastDay !== null && day < p.lastDay) return p; // never move backwards (clock changes)
  let streak = 1;
  let freezes = p.freezes;
  if (p.lastDay !== null) {
    const gap = day - p.lastDay;
    if (gap === 1) streak = p.streak + 1;
    else if (gap === 2 && freezes > 0) { streak = p.streak + 1; freezes -= 1; }
  }
  if (streak % FREEZE_EVERY === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
  const results = { ...p.results, [String(day)]: result };
  const keys = Object.keys(results).map(Number).sort((a, b) => a - b);
  for (const k of keys.slice(0, Math.max(0, keys.length - KEEP_RESULTS))) delete results[String(k)];
  return { v: 1, lastDay: day, streak, best: Math.max(p.best, streak), freezes, total: p.total + 1, results };
}

export interface LiveStreak { streak: number; doneToday: boolean; atRisk: boolean; usesFreeze: boolean }

/** What to show on Home today: the streak as it stands if the player plays now. */
export function liveStreak(p: DailyProgress, today: number): LiveStreak {
  if (p.lastDay === null) return { streak: 0, doneToday: false, atRisk: false, usesFreeze: false };
  if (p.lastDay === today) return { streak: p.streak, doneToday: true, atRisk: false, usesFreeze: false };
  const gap = today - p.lastDay;
  if (gap === 1) return { streak: p.streak, doneToday: false, atRisk: true, usesFreeze: false };
  if (gap === 2 && p.freezes > 0) return { streak: p.streak, doneToday: false, atRisk: true, usesFreeze: true };
  return { streak: 0, doneToday: false, atRisk: false, usesFreeze: false };
}

/** Defensive parse of whatever is in storage. */
export function parseProgress(raw: string | null): DailyProgress {
  if (!raw) return emptyProgress();
  try {
    const o = JSON.parse(raw) as Partial<DailyProgress>;
    const int = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : d);
    const results: Record<string, DailyResult> = {};
    if (o.results && typeof o.results === 'object') {
      for (const [k, r] of Object.entries(o.results)) {
        if (r && typeof r.attempts === 'number' && typeof r.pieces === 'number' && /^\d+$/.test(k)) results[k] = { attempts: r.attempts, pieces: r.pieces };
      }
    }
    return {
      v: 1,
      lastDay: o.lastDay === null || o.lastDay === undefined ? null : int(o.lastDay, 0),
      streak: Math.max(0, int(o.streak, 0)), best: Math.max(0, int(o.best, 0)),
      freezes: Math.min(MAX_FREEZES, Math.max(0, int(o.freezes, 0))), total: Math.max(0, int(o.total, 0)), results,
    };
  } catch { return emptyProgress(); }
}
