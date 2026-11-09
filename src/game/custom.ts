import { BALL_R, BUMPER_BOUNCE, DEFAULT_MAX_TIME, GRAVITY, WALL_BOUNCE, WALL_HALF_T, WORLD_H, WORLD_W } from './constants';
import { fnv1a } from './rng';
import { runSolution } from './sim';
import type { Level } from './types';

/**
 * Player-made level ("Creator mode"). A compact, hostile-input-safe description that travels INSIDE a chain,
 * so every receiver (and the server) rebuilds exactly the same Level from it.
 *
 * All numbers are integers in HALF world units (x2) so codes stay small and floats never sneak in.
 * No text fields at all: nothing a player can type can reach another player (no moderation surface).
 */
export interface CustomDef {
  /** format version */
  v: 1;
  /** ball spawn [x, y] */
  b: [number, number];
  /** goal [x, y, radius] */
  t: [number, number, number];
  /** walls [ax, ay, bx, by] */
  w: Array<[number, number, number, number]>;
  /** bumpers [x, y, radius] */
  d: Array<[number, number, number]>;
  /** plank lengths in whole world units */
  p: number[];
}

export const CUSTOM_LIMITS = {
  maxWalls: 14,
  maxBumpers: 8,
  minPlanks: 1,
  maxPlanks: 4,
  plankLengths: [16, 20, 24, 28, 32] as const,
  targetRadii: [10, 13, 16] as const, // half units => 5, 6.5, 8
  bumperRadii: [6, 8, 10, 12, 14, 16] as const, // 3..8
  minWallLen: 4, // half units
  maxJson: 2500,
} as const;

const W2 = WORLD_W * 2;
const H2 = WORLD_H * 2;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && Math.abs(v) < 100000;
const isPair = (a: unknown, n: number): a is number[] => Array.isArray(a) && a.length === n && a.every(isInt);

export const emptyCustom = (): CustomDef => ({ v: 1, b: [30, 40], t: [150, 260, 13], w: [], d: [], p: [24, 24] });

/** Distance from point to segment (all in half units). */
function distSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax; const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

/**
 * Strict structural + geometric validation. Returns null if fine, else a human-readable reason.
 * Pure and cheap; the same function runs in the app editor, on every receiving device, and on the server.
 */
export function validateCustom(def: unknown): string | null {
  if (!def || typeof def !== 'object') return 'Not a puzzle.';
  const d = def as Partial<CustomDef>;
  if (d.v !== 1) return 'Unknown puzzle version.';
  if (!isPair(d.b, 2)) return 'Bad ball.';
  if (!isPair(d.t, 3)) return 'Bad goal.';
  if (!Array.isArray(d.w) || !d.w.every((s) => isPair(s, 4))) return 'Bad walls.';
  if (!Array.isArray(d.d) || !d.d.every((s) => isPair(s, 3))) return 'Bad bumpers.';
  if (!Array.isArray(d.p) || !d.p.every(isInt)) return 'Bad planks.';
  if (JSON.stringify(d).length > CUSTOM_LIMITS.maxJson) return 'Puzzle is too complex.';

  const [bx, by] = d.b as number[];
  const [tx, ty, tr] = d.t as number[];
  const walls = d.w as number[][];
  const bumpers = d.d as number[][];
  if (walls.length > CUSTOM_LIMITS.maxWalls) return `At most ${CUSTOM_LIMITS.maxWalls} walls.`;
  if (bumpers.length > CUSTOM_LIMITS.maxBumpers) return `At most ${CUSTOM_LIMITS.maxBumpers} bumpers.`;
  if (d.p!.length < CUSTOM_LIMITS.minPlanks || d.p!.length > CUSTOM_LIMITS.maxPlanks) return `Give the player 1 to ${CUSTOM_LIMITS.maxPlanks} planks.`;
  if (!d.p!.every((l) => (CUSTOM_LIMITS.plankLengths as readonly number[]).includes(l))) return 'Bad plank length.';
  if (!(CUSTOM_LIMITS.targetRadii as readonly number[]).includes(tr)) return 'Bad goal size.';

  const inW = (x: number, m = 0) => x >= m && x <= W2 - m;
  const inH = (y: number, m = 0) => y >= m && y <= H2 - m;
  if (!inW(bx, 16) || !inH(by, 16)) return 'Ball is out of bounds.';
  if (!inW(tx, 16) || !inH(ty, 16)) return 'Goal is out of bounds.';
  for (const [ax, ay, cx, cy] of walls) {
    if (!inW(ax) || !inW(cx) || !inH(ay) || !inH(cy)) return 'A wall is out of bounds.';
    if (Math.hypot(cx - ax, cy - ay) < CUSTOM_LIMITS.minWallLen) return 'A wall is too short.';
  }
  for (const [x, y, r] of bumpers) {
    if (!inW(x, r) || !inH(y, r)) return 'A bumper is out of bounds.';
    if (!(CUSTOM_LIMITS.bumperRadii as readonly number[]).includes(r)) return 'Bad bumper size.';
  }

  // The ball must start in free space and with some breathing room; the goal must not sit on the ball.
  const clear = (BALL_R + 1.5) * 2; // half units
  for (const [ax, ay, cx, cy] of walls) {
    if (distSeg(bx, by, ax, ay, cx, cy) < clear + WALL_HALF_T * 2) return 'The ball starts inside or too close to a wall.';
  }
  for (const [x, y, r] of bumpers) {
    if (Math.hypot(bx - x, by - y) < r + clear) return 'The ball starts too close to a bumper.';
  }
  if (Math.hypot(bx - tx, by - ty) < tr + clear + 8) return 'The goal is too close to the ball.';
  return null;
}

export const customId = (def: CustomDef): string => `c${fnv1a(JSON.stringify([def.b, def.t, def.w, def.d, def.p])).toString(36)}`;

/** Deterministically rebuilds the playable Level. Call only after validateCustom() passed. */
export function buildCustomLevel(def: CustomDef): Level {
  const id = customId(def);
  const h = (n: number) => n / 2;
  return {
    id, name: 'Your puzzle', base: id,
    w: WORLD_W, h: WORLD_H,
    balls: [{ x: h(def.b[0]), y: h(def.b[1]), r: BALL_R }],
    target: { x: h(def.t[0]), y: h(def.t[1]), r: h(def.t[2]) },
    segments: def.w.map(([ax, ay, bx, by]) => ({ ax: h(ax), ay: h(ay), bx: h(bx), by: h(by), r: WALL_HALF_T, e: WALL_BOUNCE })),
    discs: def.d.map(([x, y, r]) => ({ x: h(x), y: h(y), r: h(r), e: BUMPER_BOUNCE })),
    inventory: def.p.map((len) => ({ kind: 'plank' as const, len })),
    zone: { x: 8, y: 22, w: WORLD_W - 16, h: WORLD_H - 40 },
    gravity: { x: 0, y: GRAVITY },
    timeScale: 1, portals: null, maxTime: DEFAULT_MAX_TIME, rules: [],
  };
}

/** Playability check beyond geometry: the empty board must not already win (otherwise there is nothing to solve). */
export function customTrivialReason(def: CustomDef): string | null {
  const lvl = buildCustomLevel(def);
  return runSolution(lvl, []).won ? 'The ball reaches the goal on its own. Add something to solve!' : null;
}

/** Everything checkable without a solver. (Solvability is proven by the creator's own solution in the chain.) */
export function checkCustom(def: unknown): { ok: true; def: CustomDef; level: Level } | { ok: false; error: string } {
  const e = validateCustom(def);
  if (e) return { ok: false, error: e };
  const d = def as CustomDef;
  const t = customTrivialReason(d);
  if (t) return { ok: false, error: t };
  return { ok: true, def: d, level: buildCustomLevel(d) };
}
