import { ANGLE_STEPS, POS_Q, TICK_HZ } from './constants';
import { ANGLE_TABLE } from './angles';
import { angleIndexFromDirection, distPointSeg, placementSegment, validateSolution } from './placement';
import { createSim, type Sim, stepSim } from './sim';
import type { Level, Placement, Solution } from './types';

export type Phase = 'edit' | 'running' | 'won' | 'lost';

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string;
  kind: 'dot' | 'ring';
}

export type GameEvent =
  | 'place' | 'pickup' | 'rotate' | 'start' | 'bounce' | 'bumper' | 'portal' | 'goal' | 'win' | 'lose' | 'invalid';

export interface HitResult { i: number; part: 'body' | 'end' }

/**
 * Framework-agnostic play session: owns piece placement, the fixed-timestep loop, and juice state
 * (trails, particles, shake). Renderers just read its fields. Gameplay logic itself lives in sim.ts.
 */
export class PlayController {
  level: Level;
  placed: (Placement | null)[];
  phase: Phase = 'edit';
  sim: Sim | null = null;
  trails: Array<Array<[number, number]>> = [];
  particles: Particle[] = [];
  shake = 0;
  /** accessibility: no screen shake and far fewer particles */
  reduceMotion = false;
  attempts = 0;
  elapsedEdit = 0;
  /** seconds since the phase changed (renderers use it for easing) */
  phaseTime = 0;
  /** optional ghost plank shown as a hint */
  ghost: Placement | null = null;
  autoRetry = true;
  onEvent: (e: GameEvent, data?: { x: number; y: number; speed?: number }) => void = () => {};
  private accum = 0;
  private lastAngle: number[];
  private rnd = 1234567;

  constructor(level: Level) {
    this.level = level;
    this.placed = level.inventory.map(() => null);
    this.lastAngle = level.inventory.map(() => 0);
  }

  // ---------- editing ----------
  get solution(): Solution {
    return this.placed.filter((p): p is Placement => p !== null);
  }
  get error(): string | null {
    return validateSolution(this.level, this.solution);
  }
  get canPlay(): boolean {
    return this.phase === 'edit' && this.error === null;
  }
  invalid(i: number): boolean {
    const p = this.placed[i];
    return !!p && validateSolution(this.level, [p]) !== null;
  }

  private clampPlacement(i: number, wx: number, wy: number, a: number): Placement {
    const z = this.level.zone;
    const x = Math.max(z.x, Math.min(z.x + z.w, wx));
    const y = Math.max(z.y, Math.min(z.y + z.h, wy));
    return { i, x: Math.round(x * POS_Q), y: Math.round(y * POS_Q), a };
  }

  place(i: number, wx: number, wy: number): void {
    if (this.phase !== 'edit') return;
    this.placed[i] = this.clampPlacement(i, wx, wy, this.lastAngle[i]);
    this.onEvent('place');
  }
  move(i: number, wx: number, wy: number): void {
    const p = this.placed[i];
    if (this.phase !== 'edit' || !p) return;
    this.placed[i] = this.clampPlacement(i, wx, wy, p.a);
  }
  rotateToward(i: number, wx: number, wy: number): void {
    const p = this.placed[i];
    if (this.phase !== 'edit' || !p) return;
    const a = angleIndexFromDirection(wx - p.x / POS_Q, wy - p.y / POS_Q);
    if (a !== p.a) this.onEvent('rotate');
    this.placed[i] = { ...p, a };
    this.lastAngle[i] = a;
  }
  rotateStep(i: number, steps: number): void {
    const p = this.placed[i];
    if (this.phase !== 'edit' || !p) return;
    const a = (((p.a + steps) % ANGLE_STEPS) + ANGLE_STEPS) % ANGLE_STEPS;
    this.placed[i] = { ...p, a };
    this.lastAngle[i] = a;
    this.onEvent('rotate');
  }
  remove(i: number): void {
    if (this.phase !== 'edit') return;
    if (this.placed[i]) this.onEvent('pickup');
    this.placed[i] = null;
  }
  /** Loads a whole solution (used by hints, replays, and "show me the answer"). */
  setSolution(sol: Solution): void {
    this.placed = this.level.inventory.map(() => null);
    for (const p of sol) { this.placed[p.i] = { ...p }; this.lastAngle[p.i] = p.a; }
  }

  /** Nearest piece under a world-space point, preferring the rotate handle of the piece. */
  hitTest(wx: number, wy: number, slop = 4): HitResult | null {
    let best: HitResult | null = null;
    let bestD = Infinity;
    for (let i = 0; i < this.placed.length; i++) {
      const p = this.placed[i];
      if (!p) continue;
      const seg = placementSegment(this.level, p);
      const [c, s] = ANGLE_TABLE[p.a];
      const half = this.level.inventory[p.i].len / 2;
      const ex = p.x / POS_Q + c * half;
      const ey = p.y / POS_Q + s * half;
      const dEnd = Math.hypot(wx - ex, wy - ey);
      if (dEnd < slop + 3 && dEnd < bestD) { best = { i, part: 'end' }; bestD = dEnd - 3; }
      const d = distPointSeg(wx, wy, seg);
      if (d < seg.r + slop && d < bestD) { best = { i, part: 'body' }; bestD = d; }
    }
    return best;
  }

  /** world-space position of a piece's rotate handle (the +direction end) */
  handlePos(i: number): [number, number] | null {
    const p = this.placed[i];
    if (!p) return null;
    const [c, s] = ANGLE_TABLE[p.a];
    const half = this.level.inventory[p.i].len / 2;
    return [p.x / POS_Q + c * half, p.y / POS_Q + s * half];
  }

  // ---------- running ----------
  play(): boolean {
    if (!this.canPlay) {
      this.onEvent('invalid');
      return false;
    }
    this.sim = createSim(this.level, this.solution);
    this.trails = this.sim.balls.map(() => []);
    this.attempts++;
    this.setPhase('running');
    this.accum = 0;
    this.onEvent('start');
    return true;
  }

  /** back to editing, keeping the placed pieces (instant retry) */
  reset(): void {
    this.sim = null;
    this.trails = [];
    this.ghost = this.ghost;
    this.setPhase('edit');
  }

  private setPhase(p: Phase) {
    this.phase = p;
    this.phaseTime = 0;
  }

  private rand(): number {
    // juice-only LCG; never feeds the simulation
    this.rnd = (Math.imul(this.rnd, 1664525) + 1013904223) >>> 0;
    return this.rnd / 4294967296;
  }

  private burst(x: number, y: number, n: number, color: string, speed: number, life = 0.6) {
    if (this.reduceMotion) n = Math.ceil(n / 5);
    for (let k = 0; k < n; k++) {
      const a = this.rand() * Math.PI * 2;
      const v = speed * (0.35 + this.rand() * 0.65);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: life * (0.6 + this.rand() * 0.6), max: life, size: 0.6 + this.rand() * 1.2, color, kind: 'dot' });
    }
  }

  advance(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.phaseTime += dt;
    if (this.phase === 'edit') this.elapsedEdit += dt;
    if (this.phase === 'running' && this.sim) {
      this.accum += dt;
      const step = 1 / TICK_HZ;
      let n = 0;
      while (this.accum >= step && this.sim.status === 'running' && n < 6) {
        this.accum -= step;
        n++;
        stepSim(this.sim);
        this.consume();
      }
      if (this.sim.status !== 'running') {
        if (this.sim.status === 'won') {
          this.setPhase('won');
          this.burst(this.level.target.x, this.level.target.y, 70, '#ffd54a', 70, 1.1);
          this.burst(this.level.target.x, this.level.target.y, 40, '#7affc4', 55, 1.0);
          this.particles.push({ x: this.level.target.x, y: this.level.target.y, vx: 0, vy: 0, life: 0.7, max: 0.7, size: 6, color: '#ffd54a', kind: 'ring' });
          if (!this.reduceMotion) this.shake = Math.max(this.shake, 0.5);
          this.onEvent('win', { x: this.level.target.x, y: this.level.target.y });
        } else {
          this.setPhase('lost');
          this.onEvent('lose');
        }
      }
    }
    if (this.phase === 'lost' && this.autoRetry && this.phaseTime > 0.85) this.reset();
    // particles + shake
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'dot') { p.vy += 120 * dt; p.vx *= 0.99; }
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 2.4);
  }

  private consume() {
    const sim = this.sim!;
    sim.balls.forEach((b, i) => {
      const tr = this.trails[i];
      if (!b.done && sim.tick % 2 === 0) { tr.push([b.x, b.y]); if (tr.length > 26) tr.shift(); }
    });
    for (const e of sim.events) {
      if (e.type === 'bounce') {
        this.burst(e.x, e.y, e.bumper ? 10 : 4, e.bumper ? '#ff7ad9' : '#c8ceff', 22 + Math.min(e.speed, 140) * 0.2, 0.35);
        if (e.bumper) { if (!this.reduceMotion) this.shake = Math.max(this.shake, 0.25); this.onEvent('bumper', { x: e.x, y: e.y, speed: e.speed }); }
        else this.onEvent('bounce', { x: e.x, y: e.y, speed: e.speed });
      } else if (e.type === 'portal') {
        this.burst(e.x, e.y, 14, '#8fb4ff', 40, 0.5);
        this.onEvent('portal', { x: e.x, y: e.y });
      } else if (e.type === 'goal') {
        this.burst(e.x, e.y, 24, '#ffd54a', 50, 0.7);
        this.onEvent('goal', { x: e.x, y: e.y });
      }
    }
  }

  /** Whether any invalid piece currently exists (renderers tint it red). */
  get anyInvalid(): boolean { return this.error !== null; }
}
