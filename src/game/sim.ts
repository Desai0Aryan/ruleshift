import {
  CONTACT_FRICTION, MAX_SPEED, OUT_MARGIN, PORTAL_COOLDOWN, REST_SPEED, STILL_SPEED, STILL_TICKS, SUBSTEPS, TICK_HZ,
} from './constants';
import { placementSegment, validateSolution } from './placement';
import type { Level, Segment, Solution } from './types';

/**
 * Deterministic simulation.
 *
 * Determinism contract (see docs/DETERMINISM.md):
 *  - fixed timestep, fixed substeps, fixed iteration order
 *  - only + - * / Math.sqrt Math.min/max/abs/floor (all exactly specified by IEEE-754 / ECMAScript)
 *  - NO Math.sin/cos/atan2/pow/exp/random, NO Date, NO object-key iteration
 */

interface Cap { ax: number; ay: number; dx: number; dy: number; inv: number; r: number; e: number }

export interface BallState {
  x: number; y: number; vx: number; vy: number; r: number;
  /** reached the target (frozen, no longer simulated) */
  done: boolean;
  /** portal cooldown in substeps */
  cd: number;
}

export type SimStatus = 'running' | 'won' | 'lost';
export type LossReason = 'out' | 'timeout' | 'still';

export interface Sim {
  level: Level;
  caps: Cap[];
  /** pieces as renderable segments (only the placed ones) */
  pieceSegments: Segment[];
  balls: BallState[];
  tick: number;
  stillTicks: number;
  status: SimStatus;
  reason?: LossReason;
  /** per-ball minimum distance to the target centre seen so far */
  minDist: number[];
  /** ticks at which each ball entered the target (for juice), or -1 */
  doneTick: number[];
  /** events produced during the most recent tick (cleared at start of each tick) */
  events: SimEvent[];
}

export type SimEvent =
  | { type: 'bounce'; x: number; y: number; speed: number; bumper: boolean }
  | { type: 'portal'; x: number; y: number }
  | { type: 'goal'; ball: number; x: number; y: number }
  | { type: 'collide'; x: number; y: number }
  | { type: 'lost'; reason: LossReason };

function toCap(s: Segment): Cap {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const l2 = dx * dx + dy * dy;
  return { ax: s.ax, ay: s.ay, dx, dy, inv: l2 > 0 ? 1 / l2 : 0, r: s.r, e: s.e };
}

export function createSim(level: Level, solution: Solution): Sim {
  const pieceSegments = solution.map((p) => placementSegment(level, p));
  const caps: Cap[] = [];
  for (const s of level.segments) caps.push(toCap(s));
  for (const d of level.discs) caps.push(toCap({ ax: d.x, ay: d.y, bx: d.x, by: d.y, r: d.r, e: d.e }));
  for (const s of pieceSegments) caps.push(toCap(s));
  return {
    level,
    caps,
    pieceSegments,
    balls: level.balls.map((b) => ({ x: b.x, y: b.y, vx: 0, vy: 0, r: b.r, done: false, cd: 0 })),
    tick: 0,
    stillTicks: 0,
    status: 'running',
    minDist: level.balls.map((b) => dist(b.x, b.y, level.target.x, level.target.y)),
    doneTick: level.balls.map(() => -1),
    events: [],
  };
}

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

export function maxTicks(level: Level): number {
  return Math.floor(level.maxTime * TICK_HZ);
}

/** Advance exactly one tick (= timeScale/60 game seconds, in SUBSTEPS substeps). */
export function stepSim(sim: Sim): void {
  if (sim.status !== 'running') return;
  sim.events.length = 0;
  const L = sim.level;
  const dt = L.timeScale / TICK_HZ / SUBSTEPS;
  const gx = L.gravity.x;
  const gy = L.gravity.y;
  const caps = sim.caps;
  const balls = sim.balls;
  const tgt = L.target;

  for (let s = 0; s < SUBSTEPS; s++) {
    for (let bi = 0; bi < balls.length; bi++) {
      const b = balls[bi];
      if (b.done) continue;
      b.vx += gx * dt;
      b.vy += gy * dt;
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > MAX_SPEED * MAX_SPEED) {
        const k = MAX_SPEED / Math.sqrt(sp2);
        b.vx *= k;
        b.vy *= k;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.cd > 0) b.cd--;

      for (let ci = 0; ci < caps.length; ci++) {
        const c = caps[ci];
        let t = c.inv > 0 ? ((b.x - c.ax) * c.dx + (b.y - c.ay) * c.dy) * c.inv : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = b.x - (c.ax + c.dx * t);
        const ey = b.y - (c.ay + c.dy * t);
        const rr = b.r + c.r;
        const d2 = ex * ex + ey * ey;
        if (d2 >= rr * rr) continue;
        let nx: number;
        let ny: number;
        let d: number;
        if (d2 > 1e-12) {
          d = Math.sqrt(d2);
          nx = ex / d;
          ny = ey / d;
        } else {
          d = 0;
          nx = 0;
          ny = gy > 0 ? -1 : 1;
        }
        const pen = rr - d;
        b.x += nx * pen;
        b.y += ny * pen;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          const e = -vn < REST_SPEED ? 0 : c.e;
          const k = (1 + e) * vn;
          b.vx -= k * nx;
          b.vy -= k * ny;
          const tx = -ny;
          const ty = nx;
          const vt = b.vx * tx + b.vy * ty;
          b.vx -= vt * tx * CONTACT_FRICTION;
          b.vy -= vt * ty * CONTACT_FRICTION;
          if (-vn > 16) sim.events.push({ type: 'bounce', x: b.x - nx * b.r, y: b.y - ny * b.r, speed: -vn, bumper: c.e > 1 });
        }
      }
    }

    // ball-ball (equal mass, fixed pair order)
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.done) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j];
        if (b.done) continue;
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const rr = a.r + b.r;
        const d2 = ex * ex + ey * ey;
        if (d2 >= rr * rr) continue;
        let nx = 1;
        let ny = 0;
        let d = 0;
        if (d2 > 1e-12) {
          d = Math.sqrt(d2);
          nx = ex / d;
          ny = ey / d;
        }
        const half = (rr - d) / 2;
        a.x -= nx * half; a.y -= ny * half;
        b.x += nx * half; b.y += ny * half;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const j2 = -(1 + 0.4) * vn / 2;
          a.vx -= j2 * nx; a.vy -= j2 * ny;
          b.vx += j2 * nx; b.vy += j2 * ny;
          if (-vn > 20) sim.events.push({ type: 'collide', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
      }
    }

    // portals + goal + bounds
    for (let bi = 0; bi < balls.length; bi++) {
      const b = balls[bi];
      if (b.done) continue;
      const P = L.portals;
      if (P && b.cd === 0) {
        if (dist(b.x, b.y, P.a.x, P.a.y) < P.a.r) {
          sim.events.push({ type: 'portal', x: b.x, y: b.y });
          b.x = P.b.x; b.y = P.b.y; b.cd = PORTAL_COOLDOWN;
          sim.events.push({ type: 'portal', x: b.x, y: b.y });
        } else if (dist(b.x, b.y, P.b.x, P.b.y) < P.b.r) {
          sim.events.push({ type: 'portal', x: b.x, y: b.y });
          b.x = P.a.x; b.y = P.a.y; b.cd = PORTAL_COOLDOWN;
          sim.events.push({ type: 'portal', x: b.x, y: b.y });
        }
      }
      const dd = dist(b.x, b.y, tgt.x, tgt.y);
      if (dd < sim.minDist[bi]) sim.minDist[bi] = dd;
      if (dd < tgt.r) {
        b.done = true;
        sim.minDist[bi] = 0;
        sim.doneTick[bi] = sim.tick;
        sim.events.push({ type: 'goal', ball: bi, x: b.x, y: b.y });
      } else if (b.x < -OUT_MARGIN || b.x > L.w + OUT_MARGIN || b.y < -OUT_MARGIN || b.y > L.h + OUT_MARGIN) {
        sim.status = 'lost';
        sim.reason = 'out';
      }
    }
    if (sim.status === 'lost') break;
  }

  sim.tick++;
  if (sim.status === 'lost') {
    sim.events.push({ type: 'lost', reason: 'out' });
    return;
  }
  let allDone = true;
  let maxSp2 = 0;
  for (const b of balls) {
    if (b.done) continue;
    allDone = false;
    const s2 = b.vx * b.vx + b.vy * b.vy;
    if (s2 > maxSp2) maxSp2 = s2;
  }
  if (allDone) {
    sim.status = 'won';
    return;
  }
  sim.stillTicks = maxSp2 < STILL_SPEED * STILL_SPEED ? sim.stillTicks + 1 : 0;
  if (sim.stillTicks >= STILL_TICKS) {
    sim.status = 'lost';
    sim.reason = 'still';
    sim.events.push({ type: 'lost', reason: 'still' });
  } else if (sim.tick >= maxTicks(L)) {
    sim.status = 'lost';
    sim.reason = 'timeout';
    sim.events.push({ type: 'lost', reason: 'timeout' });
  }
}

export interface RunResult {
  won: boolean;
  ticks: number;
  reason?: LossReason;
  /** worst (over balls) closest approach to the target; 0 when won */
  fitness: number;
  /** subsampled path of ball 0 (only when trace requested) */
  trace?: Array<[number, number]>;
  digest: number;
}

export function runSolution(level: Level, solution: Solution, opts: { trace?: boolean } = {}): RunResult {
  const sim = createSim(level, solution);
  const trace: Array<[number, number]> | undefined = opts.trace ? [] : undefined;
  while (sim.status === 'running') {
    stepSim(sim);
    if (trace && sim.tick % 3 === 0) trace.push([sim.balls[0].x, sim.balls[0].y]);
  }
  let fitness = 0;
  for (const m of sim.minDist) if (m > fitness) fitness = m;
  return { won: sim.status === 'won', ticks: sim.tick, reason: sim.reason, fitness, trace, digest: simDigest(sim) };
}

/** Untrusted-input entry point: validates, then simulates. */
export function verifySolution(level: Level, solution: Solution): { ok: boolean; error?: string; ticks?: number } {
  const err = validateSolution(level, solution);
  if (err) return { ok: false, error: err };
  const r = runSolution(level, solution);
  return r.won ? { ok: true, ticks: r.ticks } : { ok: false, error: 'does not reach the target' };
}

const dv = new DataView(new ArrayBuffer(8));

/** FNV-1a digest of the exact bit pattern of the simulation state; used for golden determinism tests. */
export function simDigest(sim: Sim): number {
  let h = 0x811c9dc5;
  const mix = (v: number) => {
    dv.setFloat64(0, v, true); // explicit little-endian: digest is identical on any platform
    h ^= dv.getUint32(0, true); h = Math.imul(h, 0x01000193);
    h ^= dv.getUint32(4, true); h = Math.imul(h, 0x01000193);
  };
  mix(sim.tick);
  for (const b of sim.balls) { mix(b.x); mix(b.y); mix(b.vx); mix(b.vy); mix(b.done ? 1 : 0); }
  return h >>> 0;
}
