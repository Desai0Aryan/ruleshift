import { CUSTOM_LIMITS, type CustomDef, buildCustomLevel, customTrivialReason, emptyCustom, validateCustom } from '../game/custom';
import { WORLD_H, WORLD_W } from '../game/constants';
import type { Level } from '../game/types';

export type Tool = 'wall' | 'bumper' | 'ball' | 'goal' | 'erase';

/**
 * Framework-agnostic level editor (same idea as PlayController): the native app and the web preview are
 * thin views over this, and everything here is unit-tested. Pointer coordinates are WORLD units.
 * The draft is always a CustomDef, i.e. exactly what ends up inside a shared chain.
 */
export class EditorController {
  def: CustomDef;
  tool: Tool = 'wall';
  bumperR = 10; // half units (5 world units)
  /** wall being dragged */
  preview: [number, number, number, number] | null = null;
  message = '';
  private undoStack: CustomDef[] = [];
  private drag: { kind: Tool; ox: number; oy: number } | null = null;
  /** bumped on every change so views know when to rebuild */
  revision = 0;

  constructor(def: CustomDef = emptyCustom()) { this.def = clone(def); }

  // ---------- helpers ----------
  /** world units -> half units on a 1-unit grid (2 half units) so levels look tidy */
  private snap = (v: number) => Math.round(v) * 2;
  private clampX = (h: number, m: number) => Math.max(m, Math.min(WORLD_W * 2 - m, h));
  private clampY = (h: number, m: number) => Math.max(m, Math.min(WORLD_H * 2 - m, h));
  private push() { this.undoStack.push(clone(this.def)); if (this.undoStack.length > 60) this.undoStack.shift(); }
  private changed() { this.revision++; }
  private say(m: string) { this.message = m; }

  level(): Level { return buildCustomLevel(this.def); }

  // ---------- pointer ----------
  down(x: number, y: number) {
    this.message = '';
    const hx = this.snap(x); const hy = this.snap(y);
    switch (this.tool) {
      case 'wall':
        if (this.def.w.length >= CUSTOM_LIMITS.maxWalls) return this.say(`That's the maximum of ${CUSTOM_LIMITS.maxWalls} walls.`);
        this.drag = { kind: 'wall', ox: this.clampX(hx, 0), oy: this.clampY(hy, 0) };
        this.preview = [this.drag.ox, this.drag.oy, this.drag.ox, this.drag.oy];
        break;
      case 'bumper': {
        if (this.def.d.length >= CUSTOM_LIMITS.maxBumpers) return this.say(`That's the maximum of ${CUSTOM_LIMITS.maxBumpers} bumpers.`);
        const r = this.bumperR;
        this.push();
        this.def.d.push([this.clampX(hx, r), this.clampY(hy, r), r]);
        this.changed();
        break;
      }
      case 'ball': case 'goal':
        this.push();
        this.drag = { kind: this.tool, ox: 0, oy: 0 };
        this.place(this.tool, hx, hy);
        break;
      case 'erase': this.erase(x, y); break;
    }
  }

  move(x: number, y: number) {
    if (!this.drag) return;
    const hx = this.snap(x); const hy = this.snap(y);
    if (this.drag.kind === 'wall') this.preview = [this.drag.ox, this.drag.oy, this.clampX(hx, 0), this.clampY(hy, 0)];
    else if (this.drag.kind === 'ball' || this.drag.kind === 'goal') this.place(this.drag.kind, hx, hy);
  }

  up(x: number, y: number) {
    if (!this.drag) return;
    if (this.drag.kind === 'wall') {
      this.move(x, y);
      const p = this.preview!;
      this.preview = null;
      if (Math.hypot(p[2] - p[0], p[3] - p[1]) < CUSTOM_LIMITS.minWallLen) this.say('Drag further to draw a wall.');
      else { this.push(); this.def.w.push([p[0], p[1], p[2], p[3]]); this.changed(); }
    } else this.move(x, y);
    this.drag = null;
  }

  private place(kind: 'ball' | 'goal', hx: number, hy: number) {
    if (kind === 'ball') this.def.b = [this.clampX(hx, 16), this.clampY(hy, 16)];
    else this.def.t = [this.clampX(hx, 16), this.clampY(hy, 16), this.def.t[2]];
    this.changed();
  }

  /** removes the wall or bumper closest to the point (within ~4 world units) */
  private erase(x: number, y: number) {
    const px = x * 2; const py = y * 2;
    let best: { kind: 'w' | 'd'; i: number; d: number } | null = null;
    this.def.w.forEach(([ax, ay, bx, by], i) => {
      const dx = bx - ax; const dy = by - ay; const l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
      const d = Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
      if (!best || d < best.d) best = { kind: 'w', i, d };
    });
    this.def.d.forEach(([cx, cy, r], i) => {
      const d = Math.max(0, Math.hypot(px - cx, py - cy) - r);
      if (!best || d < best.d) best = { kind: 'd', i, d };
    });
    const b = best as { kind: 'w' | 'd'; i: number; d: number } | null;
    if (!b || b.d > 8) return this.say('Tap right on a wall or bumper to erase it.');
    this.push();
    if (b.kind === 'w') this.def.w.splice(b.i, 1); else this.def.d.splice(b.i, 1);
    this.changed();
  }

  // ---------- settings ----------
  setTool(t: Tool) { this.tool = t; this.drag = null; this.preview = null; this.message = ''; }
  cycleBumperSize() {
    const sizes = CUSTOM_LIMITS.bumperRadii;
    this.bumperR = sizes[(sizes.indexOf(this.bumperR as never) + 1) % sizes.length];
  }
  cycleGoalSize() {
    this.push();
    const sizes = CUSTOM_LIMITS.targetRadii;
    this.def.t = [this.def.t[0], this.def.t[1], sizes[(sizes.indexOf(this.def.t[2] as never) + 1) % sizes.length]];
    this.changed();
  }
  addPlank() {
    if (this.def.p.length >= CUSTOM_LIMITS.maxPlanks) return this.say(`At most ${CUSTOM_LIMITS.maxPlanks} planks.`);
    this.push(); this.def.p.push(24); this.changed();
  }
  removePlank() {
    if (this.def.p.length <= CUSTOM_LIMITS.minPlanks) return this.say('Players need at least one plank.');
    this.push(); this.def.p.pop(); this.changed();
  }
  cyclePlank(i: number) {
    if (i < 0 || i >= this.def.p.length) return;
    const L = CUSTOM_LIMITS.plankLengths;
    this.push(); this.def.p[i] = L[(L.indexOf(this.def.p[i] as never) + 1) % L.length]; this.changed();
  }

  // ---------- history ----------
  get canUndo() { return this.undoStack.length > 0; }
  undo() { const p = this.undoStack.pop(); if (p) { this.def = p; this.preview = null; this.drag = null; this.changed(); } }
  clear() { this.push(); this.def = { ...emptyCustom(), p: this.def.p.slice() }; this.changed(); }

  // ---------- checks ----------
  /** null when the puzzle can be tested/published. (Solvability is proven when the creator solves it.) */
  problem(): string | null {
    return validateCustom(this.def) ?? customTrivialReason(this.def);
  }
}

const clone = (d: CustomDef): CustomDef => JSON.parse(JSON.stringify(d)) as CustomDef;
