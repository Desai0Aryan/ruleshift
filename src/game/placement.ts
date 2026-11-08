import { ANGLE_STEPS, PLANK_BOUNCE, PLANK_HALF_T, POS_Q } from './constants';
import { ANGLE_TABLE } from './angles';
import type { Level, Placement, Segment, Solution } from './types';

/** Segment for a placed plank. Pure arithmetic from table literals (no trig). */
export function placementSegment(level: Level, p: Placement): Segment {
  const len = level.inventory[p.i].len;
  const cx = p.x / POS_Q;
  const cy = p.y / POS_Q;
  const [c, s] = ANGLE_TABLE[p.a];
  const hx = (c * len) / 2;
  const hy = (s * len) / 2;
  return { ax: cx - hx, ay: cy - hy, bx: cx + hx, by: cy + hy, r: PLANK_HALF_T, e: PLANK_BOUNCE };
}

/**
 * Validates an UNTRUSTED solution against a level. Returns null if fine, else a reason.
 * Rules: integer fields, known piece index, no duplicate piece, centre inside zone,
 * and the plank may not touch a ball's spawn point (prevents trapping the ball).
 */
export function validateSolution(level: Level, sol: Solution): string | null {
  if (!Array.isArray(sol)) return 'solution is not a list';
  if (sol.length > level.inventory.length) return 'too many pieces';
  const seen = new Set<number>();
  for (const p of sol) {
    if (!p || !Number.isInteger(p.i) || !Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.a)) {
      return 'non-integer placement';
    }
    if (p.i < 0 || p.i >= level.inventory.length) return 'bad piece index';
    if (seen.has(p.i)) return 'piece placed twice';
    seen.add(p.i);
    if (p.a < 0 || p.a >= ANGLE_STEPS) return 'bad angle';
    const z = level.zone;
    if (p.x < z.x * POS_Q || p.x > (z.x + z.w) * POS_Q || p.y < z.y * POS_Q || p.y > (z.y + z.h) * POS_Q) {
      return 'piece outside placement zone';
    }
    const seg = placementSegment(level, p);
    for (const b of level.balls) {
      if (distPointSeg(b.x, b.y, seg) < b.r + seg.r + 0.5) return 'piece overlaps a ball spawn';
    }
  }
  return null;
}

export function distPointSeg(px: number, py: number, s: Segment): number {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - s.ax) * dx + (py - s.ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = s.ax + dx * t;
  const qy = s.ay + dy * t;
  const ex = px - qx;
  const ey = py - qy;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * UI helper (NOT used by the sim, so Math.atan2 is fine here): nearest angle index
 * for a direction vector. Planks are symmetric so the direction folds into 0..π.
 */
export function angleIndexFromDirection(dx: number, dy: number): number {
  let ang = Math.atan2(dy, dx);
  if (ang < 0) ang += Math.PI;
  if (ang >= Math.PI) ang -= Math.PI;
  let idx = Math.round((ang / Math.PI) * ANGLE_STEPS);
  if (idx >= ANGLE_STEPS) idx = 0;
  return idx;
}
