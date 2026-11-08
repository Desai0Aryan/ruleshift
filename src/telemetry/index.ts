import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tiny on-device analytics so the Phase-1 gate ("is it fun for 20 s?") and the Phase-2 gate
 * ("do people send challenges?") can be measured from the very first TestFlight build, before any
 * backend exists. Part 4 plugs PostHog into `setSink` without touching call sites.
 */
export type EventName =
  | 'app_open' | 'level_start' | 'attempt' | 'level_solved' | 'hint_used'
  | 'rule_picked' | 'rule_unavailable' | 'share_tapped' | 'copy_tapped'
  | 'challenge_opened' | 'challenge_invalid' | 'replay_watched' | 'gif_export' | 'seed_opened' | 'publish_failed'
  | 'hand_reroll' | 'daily_started' | 'daily_solved' | 'daily_shared';

export interface TelemetryRecord { t: number; name: EventName; props?: Record<string, string | number | boolean> }

const KEY = 'ruleshift.telemetry.v1';
let counts: Partial<Record<EventName, number>> = {};
let recent: TelemetryRecord[] = [];
let sink: ((r: TelemetryRecord) => void) | null = null;
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function setSink(fn: ((r: TelemetryRecord) => void) | null) { sink = fn; }

async function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as { counts?: typeof counts; recent?: TelemetryRecord[] };
      // merge anything recorded while loading
      for (const [k, v] of Object.entries(p.counts ?? {})) counts[k as EventName] = (counts[k as EventName] ?? 0) + (v as number);
      recent = [...(p.recent ?? []), ...recent].slice(-300);
    }
  } catch { /* ignore */ }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    AsyncStorage.setItem(KEY, JSON.stringify({ counts, recent })).catch(() => {});
  }, 1500);
}

export function track(name: EventName, props?: TelemetryRecord['props']) {
  void load();
  const rec: TelemetryRecord = { t: Date.now(), name, props };
  counts[name] = (counts[name] ?? 0) + 1;
  recent.push(rec);
  if (recent.length > 300) recent.shift();
  try { sink?.(rec); } catch { /* sinks must never crash the game */ }
  scheduleSave();
}

export interface GateSummary {
  counts: Partial<Record<EventName, number>>;
  /** shares per solved puzzle: the key Phase-2 number */
  sendRate: number | null;
  /** twist picked per solved puzzle */
  twistRate: number | null;
  /** attempts per level start */
  attemptsPerLevel: number | null;
}

export async function summary(): Promise<GateSummary> {
  await load();
  const solved = counts.level_solved ?? 0;
  const starts = counts.level_start ?? 0;
  return {
    counts: { ...counts },
    sendRate: solved ? (counts.share_tapped ?? 0) / solved : null,
    twistRate: solved ? (counts.rule_picked ?? 0) / solved : null,
    attemptsPerLevel: starts ? (counts.attempt ?? 0) / starts : null,
  };
}

export async function exportJson(): Promise<string> {
  await load();
  return JSON.stringify({ counts, recent }, null, 2);
}

export async function clearTelemetry() {
  counts = {};
  recent = [];
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}
