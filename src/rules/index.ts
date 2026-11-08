import { BALL_R, BUMPER_BOUNCE, MAX_BALLS, SPEED_STEPS, WORLD_H, WORLD_W } from '../game/constants';
import { cloneLevel } from '../game/levelKit';
import { Rng } from '../game/rng';
import { runSolution } from '../game/sim';
import { distPointSeg } from '../game/placement';
import type { Level, RuleId } from '../game/types';

/**
 * A rule is a PURE, DETERMINISTIC transform: (level, seed) -> level | null.
 * null = "not applicable here". Receivers rebuild a chain by replaying (id, seed) pairs, so a rule must
 * never use Math.random/Date/etc. Add a new rule = add one entry here + one id in RuleId. That's it.
 */
export interface RuleDef {
  id: RuleId;
  name: string;
  blurb: string;
  /** emoji-free glyph key the UI maps to an icon */
  icon: 'gravity' | 'twin' | 'speed' | 'portal' | 'rubber' | 'wind' | 'mirror' | 'size' | 'moon' | 'bumper';
  color: string;
  /** deterministic rules ignore the seed, so re-rolling a different seed is pointless */
  seeded: boolean;
  apply(level: Level, seed: number): Level | null;
}

const RUBBER_E = 0.85;
const WIND_STEP = 30;
const WIND_MAX = 60;
const BIG_R = 4.5;
const SMALL_R = 2;
const MOON_MIN = 35;
const MAX_DISCS = 8;

function stamp(l: Level, id: RuleId, seed: number): Level {
  l.rules.push({ id, seed });
  return l;
}

function freeAt(level: Level, x: number, y: number, r: number, ignoreBalls = false): boolean {
  if (x < r + 2 || x > level.w - r - 2 || y < r + 2 || y > level.h - r - 2) return false;
  for (const s of level.segments) if (distPointSeg(x, y, s) < r + s.r + 1) return false;
  for (const d of level.discs) if (Math.hypot(x - d.x, y - d.y) < r + d.r + 1) return false;
  if (!ignoreBalls) for (const b of level.balls) if (Math.hypot(x - b.x, y - b.y) < r + b.r + 0.5) return false;
  if (Math.hypot(x - level.target.x, y - level.target.y) < r + level.target.r) return false;
  return true;
}

export const RULES: Record<RuleId, RuleDef> = {
  reverse_gravity: {
    id: 'reverse_gravity',
    name: 'Reverse gravity',
    blurb: 'Everything falls upward. Start and goal swap sides.',
    icon: 'gravity',
    color: '#ff7ad9',
    seeded: false,
    apply(level, seed) {
      const l = cloneLevel(level);
      // Flipping gravity alone makes almost every puzzle impossible (the ball just flies off the top),
      // so the start and goal are mirrored top<->bottom too. Obstacles stay put, which turns the same
      // scenery into a genuinely different puzzle. Applying it twice restores the original.
      l.gravity = { x: l.gravity.x, y: -l.gravity.y };
      l.balls = l.balls.map((b) => ({ ...b, y: l.h - b.y }));
      l.target = { ...l.target, y: l.h - l.target.y };
      return stamp(l, 'reverse_gravity', seed);
    },
  },

  duplicate: {
    id: 'duplicate',
    name: 'Duplicate',
    blurb: 'One ball becomes two. Both must arrive.',
    icon: 'twin',
    color: '#7affc4',
    seeded: true,
    apply(level, seed) {
      if (level.balls.length >= MAX_BALLS) return null;
      const l = cloneLevel(level);
      const rng = new Rng(seed ^ 0x5bd1e995);
      const src = l.balls[rng.int(l.balls.length)];
      const d = BALL_R * 2.5;
      const offsets: Array<[number, number]> = [[d, 0], [-d, 0], [0, -d], [0, d], [d * 1.6, 0], [-d * 1.6, 0], [0, -d * 1.6]];
      const start = rng.int(offsets.length);
      for (let k = 0; k < offsets.length; k++) {
        const [ox, oy] = offsets[(start + k) % offsets.length];
        if (freeAt(l, src.x + ox, src.y + oy, src.r)) {
          l.balls.push({ x: src.x + ox, y: src.y + oy, r: src.r });
          return stamp(l, 'duplicate', seed);
        }
      }
      return null;
    },
  },

  speed: {
    id: 'speed',
    name: 'Speed mode',
    blurb: 'Everything moves faster.',
    icon: 'speed',
    color: '#ffd54a',
    seeded: false,
    apply(level, seed) {
      const idx = SPEED_STEPS.findIndex((s) => s === level.timeScale);
      if (idx < 0 || idx >= SPEED_STEPS.length - 1) return null;
      const l = cloneLevel(level);
      l.timeScale = SPEED_STEPS[idx + 1];
      return stamp(l, 'speed', seed);
    },
  },

  teleport: {
    id: 'teleport',
    name: 'Teleport',
    blurb: 'Two portals swap where the ball ends up.',
    icon: 'portal',
    color: '#8fb4ff',
    seeded: true,
    apply(level, seed) {
      const l = cloneLevel(level);
      l.portals = null;
      const rng = new Rng(seed ^ 0x9e3779b9);
      // Portal A sits on (or near) the ball's natural path so it actually matters.
      const natural = runSolution(l, [], { trace: true }).trace ?? [];
      const usable = natural.slice(2, Math.max(3, Math.floor(natural.length * 0.8)));
      const pr = 5;
      let a: { x: number; y: number } | null = null;
      for (let k = 0; k < 40 && !a; k++) {
        const base: [number, number] = usable.length > 0 ? rng.pick(usable) : [l.balls[0].x, l.balls[0].y + 20];
        const x = base[0] + rng.range(-8, 8);
        const y = base[1] + rng.range(-4, 10);
        if (freeAt(l, x, y, pr + 1)) a = { x, y };
      }
      if (!a) return null;
      let b: { x: number; y: number } | null = null;
      for (let k = 0; k < 80 && !b; k++) {
        const x = rng.range(10, l.w - 10);
        const y = rng.range(l.h * 0.25, l.h * 0.85);
        if (Math.hypot(x - a.x, y - a.y) > 28 && freeAt(l, x, y, pr + 1)) b = { x, y };
      }
      if (!b) return null;
      l.portals = { a: { x: round1(a.x), y: round1(a.y), r: pr }, b: { x: round1(b.x), y: round1(b.y), r: pr } };
      return stamp(l, 'teleport', seed);
    },
  },
  rubber: {
    id: 'rubber',
    name: 'Rubber walls',
    blurb: 'Every wall becomes bouncy. Ricochets everywhere.',
    icon: 'rubber',
    color: '#ff9f5a',
    seeded: false,
    apply(level, seed) {
      if (level.segments.length === 0 || level.segments.every((s) => s.e >= RUBBER_E)) return null;
      const l = cloneLevel(level);
      for (const s of l.segments) s.e = RUBBER_E;
      return stamp(l, 'rubber', seed);
    },
  },

  wind: {
    id: 'wind',
    name: 'Crosswind',
    blurb: 'A steady wind pushes everything sideways.',
    icon: 'wind',
    color: '#9be7ff',
    seeded: true,
    apply(level, seed) {
      const dir = new Rng(seed ^ 0x2545f491).chance(0.5) ? 1 : -1;
      const gx = level.gravity.x + dir * WIND_STEP;
      if (Math.abs(gx) > WIND_MAX) return null;
      const l = cloneLevel(level);
      l.gravity = { x: gx, y: l.gravity.y };
      return stamp(l, 'wind', seed);
    },
  },

  mirror: {
    id: 'mirror',
    name: 'Mirror',
    blurb: 'The whole puzzle flips left to right.',
    icon: 'mirror',
    color: '#c9a3ff',
    seeded: false,
    apply(level, seed) {
      const l = cloneLevel(level);
      const mx = (x: number) => l.w - x;
      l.balls = l.balls.map((b) => ({ ...b, x: mx(b.x) }));
      l.target = { ...l.target, x: mx(l.target.x) };
      l.segments = l.segments.map((s) => ({ ...s, ax: mx(s.ax), bx: mx(s.bx) }));
      l.discs = l.discs.map((d) => ({ ...d, x: mx(d.x) }));
      if (l.portals) l.portals = { a: { ...l.portals.a, x: mx(l.portals.a.x) }, b: { ...l.portals.b, x: mx(l.portals.b.x) } };
      l.zone = { ...l.zone, x: l.w - (l.zone.x + l.zone.w) };
      l.gravity = { x: 0 - l.gravity.x, y: l.gravity.y };
      return stamp(l, 'mirror', seed);
    },
  },

  resize: {
    id: 'resize',
    name: 'Big or tiny',
    blurb: 'The ball grows or shrinks. Same course, new feel.',
    icon: 'size',
    color: '#ff6b8b',
    seeded: true,
    apply(level, seed) {
      const big = new Rng(seed ^ 0x7f4a7c15).chance(0.5);
      const l = cloneLevel(level);
      let changed = false;
      for (const b of l.balls) {
        const r = big ? Math.min(BIG_R, b.r + 1.5) : Math.max(SMALL_R, b.r - 1);
        if (r !== b.r) { b.r = r; changed = true; }
      }
      return changed ? stamp(l, 'resize', seed) : null;
    },
  },

  moon: {
    id: 'moon',
    name: 'Low gravity',
    blurb: 'Floaty. Everything falls at half speed.',
    icon: 'moon',
    color: '#e6e6a8',
    seeded: false,
    apply(level, seed) {
      if (Math.abs(level.gravity.y) <= MOON_MIN) return null;
      const l = cloneLevel(level);
      l.gravity = { x: l.gravity.x, y: l.gravity.y * 0.5 };
      return stamp(l, 'moon', seed);
    },
  },

  bumper: {
    id: 'bumper',
    name: 'Add a bumper',
    blurb: 'A springy bumper appears right in the ball’s way.',
    icon: 'bumper',
    color: '#ffb3ec',
    seeded: true,
    apply(level, seed) {
      if (level.discs.length >= MAX_DISCS) return null;
      const l = cloneLevel(level);
      const rng = new Rng(seed ^ 0x1b873593);
      const natural = runSolution(l, [], { trace: true }).trace ?? [];
      const usable = natural.slice(3, Math.max(4, Math.floor(natural.length * 0.85)));
      const br = 4.5;
      for (let k = 0; k < 60; k++) {
        const base: [number, number] = usable.length > 0 ? rng.pick(usable) : [l.balls[0].x, l.balls[0].y + 24];
        const x = round1(base[0] + rng.range(-10, 10));
        const y = round1(base[1] + rng.range(-2, 14));
        if (freeAt(l, x, y, br + 1, true) && Math.hypot(x - l.target.x, y - l.target.y) > br + l.target.r + 8) {
          l.discs.push({ x, y, r: br, e: BUMPER_BOUNCE });
          return stamp(l, 'bumper', seed);
        }
      }
      return null;
    },
  },
};

/** exact decimal-free rounding so portal coordinates survive JSON round trips unchanged */
function round1(v: number): number { return Math.round(v * 4) / 4; }

/** APPEND ONLY: the index is stored in share codes. */
export const RULE_ORDER: RuleId[] = ['reverse_gravity', 'duplicate', 'speed', 'teleport', 'rubber', 'wind', 'mirror', 'resize', 'moon', 'bumper'];

/** The rule picker shows a deterministic "hand" so ten rules never crowd a phone screen. */
export function dealHand(seed: number, size = 4): RuleId[] {
  const rng = new Rng(seed ^ 0x6a09e667);
  const pool = [...RULE_ORDER];
  const hand: RuleId[] = [];
  while (hand.length < size && pool.length > 0) hand.push(pool.splice(rng.int(pool.length), 1)[0]);
  return hand;
}
export const isRuleId = (v: unknown): v is RuleId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(RULES, v);

export function applyRule(level: Level, id: RuleId, seed: number): Level | null {
  return RULES[id].apply(level, seed);
}

// silence unused-import lint for world size (kept for rule authors)
void WORLD_W; void WORLD_H;

/** Text glyph per icon key, shared by the native app and the web preview. */
export const ICON_GLYPH: Record<RuleDef['icon'], string> = {
  gravity: '\u21C5', twin: '\u25CF\u25CF', speed: '\u00BB', portal: '\u25CE',
  rubber: '\u223F', wind: '\u2248', mirror: '\u21CB', size: '\u25C9', moon: '\u25D0', bumper: '\u2738',
};
