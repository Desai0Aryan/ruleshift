// src/game/constants.ts
var ENGINE_VERSION = 1;
var WORLD_W = 90;
var WORLD_H = 160;
var TICK_HZ = 60;
var SUBSTEPS = 4;
var BALL_R = 3;
var GRAVITY = 140;
var MAX_SPEED = 210;
var PLANK_HALF_T = 1.1;
var PLANK_BOUNCE = 0.32;
var WALL_HALF_T = 1.2;
var WALL_BOUNCE = 0.3;
var BUMPER_BOUNCE = 1.12;
var CONTACT_FRICTION = 4e-3;
var REST_SPEED = 7;
var STILL_SPEED = 0.6;
var STILL_TICKS = 75;
var DEFAULT_MAX_TIME = 11;
var OUT_MARGIN = 24;
var PORTAL_COOLDOWN = 40;
var POS_Q = 4;
var ANGLE_STEPS = 64;
var SPEED_STEPS = [1, 1.25, 1.5, 1.75, 2];
var MAX_BALLS = 3;

// src/game/levelKit.ts
var wall = (ax, ay, bx, by, r = WALL_HALF_T) => ({
  ax,
  ay,
  bx,
  by,
  r,
  e: WALL_BOUNCE
});
var bumper = (x, y, r = 5, e = BUMPER_BOUNCE) => ({ x, y, r, e });
var cup = (cx, topY, w, h) => [
  wall(cx - w / 2, topY, cx - w / 2, topY + h),
  wall(cx - w / 2, topY + h, cx + w / 2, topY + h),
  wall(cx + w / 2, topY, cx + w / 2, topY + h)
];
function makeLevel(d) {
  const inventory = d.planks.map((len) => ({ kind: "plank", len }));
  return {
    id: d.id,
    name: d.name,
    base: d.id,
    w: WORLD_W,
    h: WORLD_H,
    balls: [{ x: d.ball[0], y: d.ball[1], r: BALL_R }],
    target: { x: d.target[0], y: d.target[1], r: d.targetR ?? 6.5 },
    segments: d.segments ?? [],
    discs: d.discs ?? [],
    inventory,
    zone: d.zone ?? { x: 8, y: 22, w: WORLD_W - 16, h: WORLD_H - 40 },
    gravity: { x: 0, y: GRAVITY },
    timeScale: 1,
    portals: null,
    maxTime: d.maxTime ?? DEFAULT_MAX_TIME,
    rules: []
  };
}
function cloneLevel(l) {
  return JSON.parse(JSON.stringify(l));
}

// src/game/rng.ts
var Rng = class {
  s;
  constructor(seed) {
    this.s = seed >>> 0;
  }
  next() {
    this.s = this.s + 1831565813 >>> 0;
    let t = this.s;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  /** integer in [0, n) */
  int(n) {
    return Math.floor(this.next() * n);
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[this.int(arr.length)];
  }
};

// src/game/angles.ts
var ANGLE_TABLE = [
  [1, 0],
  [0.9987955, 0.0490677],
  [0.9951847, 0.0980171],
  [0.9891765, 0.1467305],
  [0.9807853, 0.1950903],
  [0.9700313, 0.2429802],
  [0.9569403, 0.2902847],
  [0.9415441, 0.3368899],
  [0.9238795, 0.3826834],
  [0.9039893, 0.4275551],
  [0.8819213, 0.4713967],
  [0.8577286, 0.5141027],
  [0.8314696, 0.5555702],
  [0.8032075, 0.5956993],
  [0.7730105, 0.6343933],
  [0.7409511, 0.671559],
  [0.7071068, 0.7071068],
  [0.671559, 0.7409511],
  [0.6343933, 0.7730105],
  [0.5956993, 0.8032075],
  [0.5555702, 0.8314696],
  [0.5141027, 0.8577286],
  [0.4713967, 0.8819213],
  [0.4275551, 0.9039893],
  [0.3826834, 0.9238795],
  [0.3368899, 0.9415441],
  [0.2902847, 0.9569403],
  [0.2429802, 0.9700313],
  [0.1950903, 0.9807853],
  [0.1467305, 0.9891765],
  [0.0980171, 0.9951847],
  [0.0490677, 0.9987955],
  [0, 1],
  [-0.0490677, 0.9987955],
  [-0.0980171, 0.9951847],
  [-0.1467305, 0.9891765],
  [-0.1950903, 0.9807853],
  [-0.2429802, 0.9700313],
  [-0.2902847, 0.9569403],
  [-0.3368899, 0.9415441],
  [-0.3826834, 0.9238795],
  [-0.4275551, 0.9039893],
  [-0.4713967, 0.8819213],
  [-0.5141027, 0.8577286],
  [-0.5555702, 0.8314696],
  [-0.5956993, 0.8032075],
  [-0.6343933, 0.7730105],
  [-0.671559, 0.7409511],
  [-0.7071068, 0.7071068],
  [-0.7409511, 0.671559],
  [-0.7730105, 0.6343933],
  [-0.8032075, 0.5956993],
  [-0.8314696, 0.5555702],
  [-0.8577286, 0.5141027],
  [-0.8819213, 0.4713967],
  [-0.9039893, 0.4275551],
  [-0.9238795, 0.3826834],
  [-0.9415441, 0.3368899],
  [-0.9569403, 0.2902847],
  [-0.9700313, 0.2429802],
  [-0.9807853, 0.1950903],
  [-0.9891765, 0.1467305],
  [-0.9951847, 0.0980171],
  [-0.9987955, 0.0490677]
];

// src/game/placement.ts
function placementSegment(level, p) {
  const len = level.inventory[p.i].len;
  const cx = p.x / POS_Q;
  const cy = p.y / POS_Q;
  const [c, s] = ANGLE_TABLE[p.a];
  const hx = c * len / 2;
  const hy = s * len / 2;
  return { ax: cx - hx, ay: cy - hy, bx: cx + hx, by: cy + hy, r: PLANK_HALF_T, e: PLANK_BOUNCE };
}
function validateSolution(level, sol) {
  if (!Array.isArray(sol)) return "solution is not a list";
  if (sol.length > level.inventory.length) return "too many pieces";
  const seen = /* @__PURE__ */ new Set();
  for (const p of sol) {
    if (!p || !Number.isInteger(p.i) || !Number.isInteger(p.x) || !Number.isInteger(p.y) || !Number.isInteger(p.a)) {
      return "non-integer placement";
    }
    if (p.i < 0 || p.i >= level.inventory.length) return "bad piece index";
    if (seen.has(p.i)) return "piece placed twice";
    seen.add(p.i);
    if (p.a < 0 || p.a >= ANGLE_STEPS) return "bad angle";
    const z = level.zone;
    if (p.x < z.x * POS_Q || p.x > (z.x + z.w) * POS_Q || p.y < z.y * POS_Q || p.y > (z.y + z.h) * POS_Q) {
      return "piece outside placement zone";
    }
    const seg = placementSegment(level, p);
    for (const b of level.balls) {
      if (distPointSeg(b.x, b.y, seg) < b.r + seg.r + 0.5) return "piece overlaps a ball spawn";
    }
  }
  return null;
}
function distPointSeg(px, py, s) {
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

// src/game/sim.ts
function toCap(s) {
  const dx = s.bx - s.ax;
  const dy = s.by - s.ay;
  const l2 = dx * dx + dy * dy;
  return { ax: s.ax, ay: s.ay, dx, dy, inv: l2 > 0 ? 1 / l2 : 0, r: s.r, e: s.e };
}
function createSim(level, solution) {
  const pieceSegments = solution.map((p) => placementSegment(level, p));
  const caps = [];
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
    status: "running",
    minDist: level.balls.map((b) => dist(b.x, b.y, level.target.x, level.target.y)),
    doneTick: level.balls.map(() => -1),
    events: []
  };
}
function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}
function maxTicks(level) {
  return Math.floor(level.maxTime * TICK_HZ);
}
function stepSim(sim) {
  if (sim.status !== "running") return;
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
        let nx;
        let ny;
        let d;
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
          if (-vn > 16) sim.events.push({ type: "bounce", x: b.x - nx * b.r, y: b.y - ny * b.r, speed: -vn, bumper: c.e > 1 });
        }
      }
    }
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
        a.x -= nx * half;
        a.y -= ny * half;
        b.x += nx * half;
        b.y += ny * half;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn < 0) {
          const j2 = -(1 + 0.4) * vn / 2;
          a.vx -= j2 * nx;
          a.vy -= j2 * ny;
          b.vx += j2 * nx;
          b.vy += j2 * ny;
          if (-vn > 20) sim.events.push({ type: "collide", x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
        }
      }
    }
    for (let bi = 0; bi < balls.length; bi++) {
      const b = balls[bi];
      if (b.done) continue;
      const P = L.portals;
      if (P && b.cd === 0) {
        if (dist(b.x, b.y, P.a.x, P.a.y) < P.a.r) {
          sim.events.push({ type: "portal", x: b.x, y: b.y });
          b.x = P.b.x;
          b.y = P.b.y;
          b.cd = PORTAL_COOLDOWN;
          sim.events.push({ type: "portal", x: b.x, y: b.y });
        } else if (dist(b.x, b.y, P.b.x, P.b.y) < P.b.r) {
          sim.events.push({ type: "portal", x: b.x, y: b.y });
          b.x = P.a.x;
          b.y = P.a.y;
          b.cd = PORTAL_COOLDOWN;
          sim.events.push({ type: "portal", x: b.x, y: b.y });
        }
      }
      const dd = dist(b.x, b.y, tgt.x, tgt.y);
      if (dd < sim.minDist[bi]) sim.minDist[bi] = dd;
      if (dd < tgt.r) {
        b.done = true;
        sim.minDist[bi] = 0;
        sim.doneTick[bi] = sim.tick;
        sim.events.push({ type: "goal", ball: bi, x: b.x, y: b.y });
      } else if (b.x < -OUT_MARGIN || b.x > L.w + OUT_MARGIN || b.y < -OUT_MARGIN || b.y > L.h + OUT_MARGIN) {
        sim.status = "lost";
        sim.reason = "out";
      }
    }
    if (sim.status === "lost") break;
  }
  sim.tick++;
  if (sim.status === "lost") {
    sim.events.push({ type: "lost", reason: "out" });
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
    sim.status = "won";
    return;
  }
  sim.stillTicks = maxSp2 < STILL_SPEED * STILL_SPEED ? sim.stillTicks + 1 : 0;
  if (sim.stillTicks >= STILL_TICKS) {
    sim.status = "lost";
    sim.reason = "still";
    sim.events.push({ type: "lost", reason: "still" });
  } else if (sim.tick >= maxTicks(L)) {
    sim.status = "lost";
    sim.reason = "timeout";
    sim.events.push({ type: "lost", reason: "timeout" });
  }
}
function runSolution(level, solution, opts = {}) {
  const sim = createSim(level, solution);
  const trace = opts.trace ? [] : void 0;
  while (sim.status === "running") {
    stepSim(sim);
    if (trace && sim.tick % 3 === 0) trace.push([sim.balls[0].x, sim.balls[0].y]);
  }
  let fitness = 0;
  for (const m of sim.minDist) if (m > fitness) fitness = m;
  return { won: sim.status === "won", ticks: sim.tick, reason: sim.reason, fitness, trace, digest: simDigest(sim) };
}
var dv = new DataView(new ArrayBuffer(8));
function simDigest(sim) {
  let h = 2166136261;
  const mix = (v) => {
    dv.setFloat64(0, v, true);
    h ^= dv.getUint32(0, true);
    h = Math.imul(h, 16777619);
    h ^= dv.getUint32(4, true);
    h = Math.imul(h, 16777619);
  };
  mix(sim.tick);
  for (const b of sim.balls) {
    mix(b.x);
    mix(b.y);
    mix(b.vx);
    mix(b.vy);
    mix(b.done ? 1 : 0);
  }
  return h >>> 0;
}

// src/rules/index.ts
var RUBBER_E = 0.85;
var WIND_STEP = 30;
var WIND_MAX = 60;
var BIG_R = 4.5;
var SMALL_R = 2;
var MOON_MIN = 35;
var MAX_DISCS = 8;
function stamp(l, id, seed) {
  l.rules.push({ id, seed });
  return l;
}
function freeAt(level, x, y, r, ignoreBalls = false) {
  if (x < r + 2 || x > level.w - r - 2 || y < r + 2 || y > level.h - r - 2) return false;
  for (const s of level.segments) if (distPointSeg(x, y, s) < r + s.r + 1) return false;
  for (const d of level.discs) if (Math.hypot(x - d.x, y - d.y) < r + d.r + 1) return false;
  if (!ignoreBalls) {
    for (const b of level.balls) if (Math.hypot(x - b.x, y - b.y) < r + b.r + 0.5) return false;
  }
  if (Math.hypot(x - level.target.x, y - level.target.y) < r + level.target.r) return false;
  return true;
}
var RULES = {
  reverse_gravity: {
    id: "reverse_gravity",
    name: "Reverse gravity",
    blurb: "Everything falls upward. Start and goal swap sides.",
    icon: "gravity",
    color: "#ff7ad9",
    seeded: false,
    apply(level, seed) {
      const l = cloneLevel(level);
      l.gravity = { x: l.gravity.x, y: -l.gravity.y };
      l.balls = l.balls.map((b) => ({ ...b, y: l.h - b.y }));
      l.target = { ...l.target, y: l.h - l.target.y };
      return stamp(l, "reverse_gravity", seed);
    }
  },
  duplicate: {
    id: "duplicate",
    name: "Duplicate",
    blurb: "One ball becomes two. Both must arrive.",
    icon: "twin",
    color: "#7affc4",
    seeded: true,
    apply(level, seed) {
      if (level.balls.length >= MAX_BALLS) return null;
      const l = cloneLevel(level);
      const rng = new Rng(seed ^ 1540483477);
      const src = l.balls[rng.int(l.balls.length)];
      const d = BALL_R * 2.5;
      const offsets = [[d, 0], [-d, 0], [0, -d], [0, d], [d * 1.6, 0], [-d * 1.6, 0], [0, -d * 1.6]];
      const start = rng.int(offsets.length);
      for (let k = 0; k < offsets.length; k++) {
        const [ox, oy] = offsets[(start + k) % offsets.length];
        if (freeAt(l, src.x + ox, src.y + oy, src.r)) {
          l.balls.push({ x: src.x + ox, y: src.y + oy, r: src.r });
          return stamp(l, "duplicate", seed);
        }
      }
      return null;
    }
  },
  speed: {
    id: "speed",
    name: "Speed mode",
    blurb: "Everything moves faster.",
    icon: "speed",
    color: "#ffd54a",
    seeded: false,
    apply(level, seed) {
      const idx = SPEED_STEPS.findIndex((s) => s === level.timeScale);
      if (idx < 0 || idx >= SPEED_STEPS.length - 1) return null;
      const l = cloneLevel(level);
      l.timeScale = SPEED_STEPS[idx + 1];
      return stamp(l, "speed", seed);
    }
  },
  teleport: {
    id: "teleport",
    name: "Teleport",
    blurb: "Two portals swap where the ball ends up.",
    icon: "portal",
    color: "#8fb4ff",
    seeded: true,
    apply(level, seed) {
      const l = cloneLevel(level);
      l.portals = null;
      const rng = new Rng(seed ^ 2654435769);
      const natural = runSolution(l, [], { trace: true }).trace ?? [];
      const usable = natural.slice(2, Math.max(3, Math.floor(natural.length * 0.8)));
      const pr = 5;
      let a = null;
      for (let k = 0; k < 40 && !a; k++) {
        const base = usable.length > 0 ? rng.pick(usable) : [l.balls[0].x, l.balls[0].y + 20];
        const x = base[0] + rng.range(-8, 8);
        const y = base[1] + rng.range(-4, 10);
        if (freeAt(l, x, y, pr + 1)) a = { x, y };
      }
      if (!a) return null;
      let b = null;
      for (let k = 0; k < 80 && !b; k++) {
        const x = rng.range(10, l.w - 10);
        const y = rng.range(l.h * 0.25, l.h * 0.85);
        if (Math.hypot(x - a.x, y - a.y) > 28 && freeAt(l, x, y, pr + 1)) b = { x, y };
      }
      if (!b) return null;
      l.portals = { a: { x: round1(a.x), y: round1(a.y), r: pr }, b: { x: round1(b.x), y: round1(b.y), r: pr } };
      return stamp(l, "teleport", seed);
    }
  },
  rubber: {
    id: "rubber",
    name: "Rubber walls",
    blurb: "Every wall becomes bouncy. Ricochets everywhere.",
    icon: "rubber",
    color: "#ff9f5a",
    seeded: false,
    apply(level, seed) {
      if (level.segments.length === 0 || level.segments.every((s) => s.e >= RUBBER_E)) return null;
      const l = cloneLevel(level);
      for (const s of l.segments) s.e = RUBBER_E;
      return stamp(l, "rubber", seed);
    }
  },
  wind: {
    id: "wind",
    name: "Crosswind",
    blurb: "A steady wind pushes everything sideways.",
    icon: "wind",
    color: "#9be7ff",
    seeded: true,
    apply(level, seed) {
      const dir = new Rng(seed ^ 625341585).chance(0.5) ? 1 : -1;
      const gx = level.gravity.x + dir * WIND_STEP;
      if (Math.abs(gx) > WIND_MAX) return null;
      const l = cloneLevel(level);
      l.gravity = { x: gx, y: l.gravity.y };
      return stamp(l, "wind", seed);
    }
  },
  mirror: {
    id: "mirror",
    name: "Mirror",
    blurb: "The whole puzzle flips left to right.",
    icon: "mirror",
    color: "#c9a3ff",
    seeded: false,
    apply(level, seed) {
      const l = cloneLevel(level);
      const mx = (x) => l.w - x;
      l.balls = l.balls.map((b) => ({ ...b, x: mx(b.x) }));
      l.target = { ...l.target, x: mx(l.target.x) };
      l.segments = l.segments.map((s) => ({ ...s, ax: mx(s.ax), bx: mx(s.bx) }));
      l.discs = l.discs.map((d) => ({ ...d, x: mx(d.x) }));
      if (l.portals) l.portals = { a: { ...l.portals.a, x: mx(l.portals.a.x) }, b: { ...l.portals.b, x: mx(l.portals.b.x) } };
      l.zone = { ...l.zone, x: l.w - (l.zone.x + l.zone.w) };
      l.gravity = { x: 0 - l.gravity.x, y: l.gravity.y };
      return stamp(l, "mirror", seed);
    }
  },
  resize: {
    id: "resize",
    name: "Big or tiny",
    blurb: "The ball grows or shrinks. Same course, new feel.",
    icon: "size",
    color: "#ff6b8b",
    seeded: true,
    apply(level, seed) {
      const big = new Rng(seed ^ 2135587861).chance(0.5);
      const l = cloneLevel(level);
      let changed = false;
      for (const b of l.balls) {
        const r = big ? Math.min(BIG_R, b.r + 1.5) : Math.max(SMALL_R, b.r - 1);
        if (r !== b.r) {
          b.r = r;
          changed = true;
        }
      }
      return changed ? stamp(l, "resize", seed) : null;
    }
  },
  moon: {
    id: "moon",
    name: "Low gravity",
    blurb: "Floaty. Everything falls at half speed.",
    icon: "moon",
    color: "#e6e6a8",
    seeded: false,
    apply(level, seed) {
      if (Math.abs(level.gravity.y) <= MOON_MIN) return null;
      const l = cloneLevel(level);
      l.gravity = { x: l.gravity.x, y: l.gravity.y * 0.5 };
      return stamp(l, "moon", seed);
    }
  },
  bumper: {
    id: "bumper",
    name: "Add a bumper",
    blurb: "A springy bumper appears right in the ball\u2019s way.",
    icon: "bumper",
    color: "#ffb3ec",
    seeded: true,
    apply(level, seed) {
      if (level.discs.length >= MAX_DISCS) return null;
      const l = cloneLevel(level);
      const rng = new Rng(seed ^ 461845907);
      const natural = runSolution(l, [], { trace: true }).trace ?? [];
      const usable = natural.slice(3, Math.max(4, Math.floor(natural.length * 0.85)));
      const br = 4.5;
      for (let k = 0; k < 60; k++) {
        const base = usable.length > 0 ? rng.pick(usable) : [l.balls[0].x, l.balls[0].y + 24];
        const x = round1(base[0] + rng.range(-10, 10));
        const y = round1(base[1] + rng.range(-2, 14));
        if (freeAt(l, x, y, br + 1, true) && Math.hypot(x - l.target.x, y - l.target.y) > br + l.target.r + 8) {
          l.discs.push({ x, y, r: br, e: BUMPER_BOUNCE });
          return stamp(l, "bumper", seed);
        }
      }
      return null;
    }
  }
};
function round1(v) {
  return Math.round(v * 4) / 4;
}
var isRuleId = (v) => typeof v === "string" && Object.prototype.hasOwnProperty.call(RULES, v);
function applyRule(level, id, seed) {
  return RULES[id].apply(level, seed);
}

// src/game/levelDefs.ts
var LEVEL_DEFS = [
  {
    id: "L01",
    name: "First Drop",
    ball: [22, 18],
    target: [68, 138],
    planks: [30]
  },
  {
    id: "L02",
    name: "The Ledge",
    ball: [72, 16],
    target: [70, 134],
    segments: [wall(90, 50, 42, 60), ...cup(70, 120, 22, 22)],
    planks: [28]
  },
  {
    id: "L03",
    name: "Pinball Wizard",
    ball: [72, 16],
    target: [16, 140],
    discs: [bumper(30, 62), bumper(62, 84), bumper(34, 108)],
    planks: [24]
  },
  {
    id: "L04",
    name: "Funnel Vision",
    ball: [14, 18],
    target: [45, 142],
    segments: [wall(8, 72, 36, 104), wall(82, 72, 54, 104), ...cup(45, 128, 14, 22)],
    planks: [30, 22]
  },
  {
    id: "L05",
    name: "Zig Zag",
    ball: [14, 16],
    target: [74, 146],
    segments: [wall(0, 48, 58, 60), wall(90, 82, 32, 96), wall(0, 116, 50, 128)],
    planks: [24, 24]
  },
  {
    id: "L06",
    name: "Home Cup",
    ball: [72, 16],
    target: [20, 134],
    segments: [wall(46, 62, 90, 72), ...cup(20, 118, 26, 26)],
    planks: [30, 26]
  },
  {
    id: "L07",
    name: "Trampoline Park",
    ball: [45, 14],
    target: [18, 60],
    targetR: 6,
    discs: [bumper(45, 120, 9, 1.18)],
    segments: [wall(0, 80, 22, 80), wall(70, 40, 90, 40)],
    planks: [24, 20]
  },
  {
    id: "L08",
    name: "Bumper Cars",
    ball: [20, 16],
    target: [70, 140],
    discs: [bumper(34, 54, 6), bumper(66, 70, 6), bumper(30, 96, 6), bumper(60, 116, 5)],
    planks: [22, 22]
  },
  {
    id: "L09",
    name: "Long Way Down",
    ball: [76, 14],
    target: [16, 148],
    segments: [wall(90, 40, 40, 52), wall(0, 80, 52, 92), wall(90, 118, 40, 128), ...cup(16, 132, 22, 18)],
    discs: [bumper(60, 100, 4)],
    planks: [26, 24, 22]
  },
  {
    id: "L10",
    name: "The Needle",
    ball: [60, 16],
    target: [26, 138],
    targetR: 6,
    segments: [wall(0, 88, 52, 100), wall(70, 88, 90, 88), wall(14, 112, 14, 150), wall(38, 124, 38, 150)],
    planks: [24, 20]
  },
  {
    id: "L11",
    name: "Mind the Gap",
    ball: [14, 18],
    target: [74, 142],
    segments: [wall(0, 62, 34, 72), wall(0, 108, 36, 108), wall(54, 108, 90, 108), ...cup(74, 124, 24, 26)],
    planks: [26, 26]
  },
  {
    id: "L12",
    name: "Switchback",
    ball: [14, 16],
    target: [74, 146],
    segments: [wall(0, 44, 66, 54), wall(90, 78, 24, 90), wall(0, 112, 66, 122)],
    discs: [bumper(76, 134, 4)],
    planks: [22, 22, 22]
  },
  // ---- Part 3: second pack (harder, more varied) ----
  {
    id: "L13",
    name: "Slalom",
    ball: [14, 16],
    target: [26, 146],
    segments: [wall(0, 50, 60, 58), wall(90, 84, 30, 92), wall(0, 118, 60, 126)],
    discs: [bumper(72, 70, 4), bumper(18, 104, 4)],
    planks: [24, 22]
  },
  {
    id: "L14",
    name: "Pachinko",
    ball: [45, 14],
    target: [45, 146],
    discs: [bumper(30, 50, 5), bumper(60, 50, 5), bumper(18, 80, 5), bumper(45, 80, 5), bumper(72, 80, 5), bumper(30, 110, 5), bumper(60, 110, 5)],
    segments: [wall(10, 130, 38, 150), wall(80, 130, 52, 150)],
    planks: [22, 22]
  },
  {
    id: "L15",
    name: "Over the Wall",
    ball: [16, 20],
    target: [74, 140],
    segments: [wall(50, 70, 50, 150), wall(50, 70, 36, 70)],
    planks: [30, 24]
  },
  {
    id: "L16",
    name: "Tight Squeeze",
    ball: [70, 16],
    target: [20, 142],
    targetR: 6,
    segments: [wall(0, 70, 56, 82), wall(76, 70, 90, 70), wall(24, 110, 90, 110), wall(24, 110, 24, 130)],
    planks: [26, 22]
  },
  {
    id: "L17",
    name: "Two Cups",
    ball: [45, 14],
    target: [74, 138],
    segments: [...cup(18, 100, 24, 30), ...cup(74, 112, 24, 24)],
    discs: [bumper(45, 70, 5)],
    planks: [30, 24]
  },
  {
    id: "L18",
    name: "Spiral Stair",
    ball: [14, 14],
    target: [12, 148],
    segments: [wall(0, 40, 66, 54), wall(90, 76, 24, 92), wall(0, 110, 66, 124), wall(90, 136, 36, 148)],
    planks: [24, 22, 22],
    maxTime: 17
  },
  {
    id: "L19",
    name: "Bank Shot",
    ball: [76, 14],
    target: [14, 120],
    targetR: 6,
    segments: [wall(40, 60, 40, 100), wall(40, 100, 0, 100)],
    discs: [bumper(60, 90, 6, 1.2)],
    planks: [28, 24],
    maxTime: 12
  },
  {
    id: "L20",
    name: "Narrow Gate",
    ball: [20, 16],
    target: [70, 142],
    segments: [wall(0, 80, 38, 80), wall(54, 80, 90, 80), wall(38, 80, 38, 94), wall(54, 80, 54, 94)],
    discs: [bumper(16, 56, 5), bumper(74, 110, 5)],
    planks: [24, 22, 20]
  },
  {
    id: "L21",
    name: "Stepping Stones",
    ball: [12, 16],
    target: [78, 146],
    segments: [wall(4, 52, 30, 56), wall(40, 74, 62, 78), wall(58, 100, 86, 104), wall(0, 126, 40, 132)],
    planks: [24, 24]
  },
  {
    id: "L22",
    name: "The Funnel Maze",
    ball: [45, 12],
    target: [45, 148],
    targetR: 6,
    segments: [wall(0, 44, 36, 66), wall(90, 44, 54, 66), wall(0, 90, 36, 112), wall(90, 90, 54, 112), wall(32, 126, 58, 126)],
    planks: [26, 22, 20]
  },
  {
    id: "L23",
    name: "Under the Roof",
    ball: [76, 14],
    target: [76, 146],
    targetR: 6,
    segments: [wall(30, 60, 90, 60), wall(0, 96, 56, 110)],
    planks: [28, 24]
  },
  {
    id: "L24",
    name: "Grand Finale",
    ball: [14, 14],
    target: [76, 148],
    targetR: 6,
    segments: [wall(0, 46, 62, 54), wall(90, 76, 28, 86), wall(0, 108, 62, 116), wall(54, 130, 54, 150)],
    discs: [bumper(76, 62, 4), bumper(16, 92, 4), bumper(70, 124, 4)],
    planks: [22, 22, 20]
  }
];

// src/game/levels.ts
var BASE_LEVELS = LEVEL_DEFS.map(makeLevel);
var BASE_LEVEL_IDS = BASE_LEVELS.map((l) => l.id);
function getBaseLevel(id) {
  return BASE_LEVELS.find((l) => l.id === id);
}

// src/social/chain.ts
var MAX_CHAIN_DEPTH = 40;
function checkChain(chain, opts = {}) {
  if (chain.engine !== ENGINE_VERSION) return { ok: false, error: "This challenge was made with a different game version." };
  if (chain.links.length > MAX_CHAIN_DEPTH) return { ok: false, error: "Chain too long." };
  const base = getBaseLevel(chain.base);
  if (!base) return { ok: false, error: "Unknown starting puzzle." };
  const levels = [base];
  for (let k = 0; k < chain.links.length; k++) {
    const link = chain.links[k];
    const cur = levels[k];
    const err2 = validateSolution(cur, link.solved);
    if (err2) return { ok: false, error: `Step ${k + 1}: ${err2}` };
    if (!runSolution(cur, link.solved).won) return { ok: false, error: `Step ${k + 1}: solution does not solve the puzzle.` };
    const next = applyRule(cur, link.rule, link.seed);
    if (!next) return { ok: false, error: `Step ${k + 1}: rule can't be applied.` };
    levels.push(next);
  }
  const last = levels[levels.length - 1];
  if (opts.requireProof === false && chain.proof.length === 0) return { ok: true, levels };
  const perr = validateSolution(last, chain.proof);
  if (perr) return { ok: false, error: `Proof: ${perr}` };
  if (!runSolution(last, chain.proof).won) return { ok: false, error: "This puzzle can\u2019t be solved." };
  return { ok: true, levels };
}

// src/server/handler.ts
var LIMITS = { nodesPerHour: 40, maxSolutionPieces: 8 };
var err = (code, error) => ({ ok: false, code, error });
var isInt = (v) => typeof v === "number" && Number.isInteger(v) && Math.abs(v) <= 4294967295;
function parseSolution(v) {
  if (!Array.isArray(v) || v.length > LIMITS.maxSolutionPieces) return null;
  const out = [];
  for (const p of v) {
    if (!p || typeof p !== "object") return null;
    const o = p;
    if (!isInt(o.i) || !isInt(o.x) || !isInt(o.y) || !isInt(o.a)) return null;
    out.push({ i: o.i, x: o.x, y: o.y, a: o.a });
  }
  return out;
}
var idOk = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{4,40}$/.test(v);
async function pathTo(store, id) {
  const rev = [];
  let cur = id;
  while (cur) {
    if (rev.length > MAX_CHAIN_DEPTH) return null;
    const n = await store.getNode(cur);
    if (!n) return null;
    rev.push(n);
    cur = n.parentId;
  }
  return rev.reverse();
}
var chainOf = (path, proof) => ({
  v: 1,
  engine: ENGINE_VERSION,
  base: path[0].base,
  links: path.map((n) => ({ rule: n.rule, seed: n.seed, solved: n.solved })),
  proof
});
async function handleRequest(store, userId, body, now = Date.now()) {
  if (!body || typeof body !== "object" || typeof body.op !== "string") return err("bad_request", "Malformed request.");
  if (body.op !== "deleteMe" && store.isBanned && await store.isBanned(userId)) return err("forbidden", "This account can\u2019t publish.");
  switch (body.op) {
    case "createNode": {
      const { parentId, base, rule, seed, engine } = body;
      if (engine !== ENGINE_VERSION) return err("engine_mismatch", "Please update the app to send this challenge.");
      if (parentId !== null && !idOk(parentId)) return err("bad_request", "Bad parent.");
      if (typeof base !== "string" || base.length > 16) return err("bad_request", "Bad base level.");
      if (!isRuleId(rule) || !isInt(seed)) return err("bad_request", "Bad twist.");
      const solved = parseSolution(body.solved);
      const proof = parseSolution(body.proof);
      if (!solved || !proof) return err("bad_request", "Bad solution.");
      if (await store.countNodesSince(userId, now - 36e5) >= LIMITS.nodesPerHour) return err("rate_limited", "Slow down a little!");
      let prefix = [];
      if (parentId) {
        const p = await pathTo(store, parentId);
        if (!p) return err("not_found", "That challenge no longer exists.");
        prefix = p;
        if (prefix[0].base !== base) return err("bad_request", "Base level mismatch.");
      }
      if (prefix.length + 1 > MAX_CHAIN_DEPTH) return err("too_deep", "This chain is as long as it can get!");
      const candidate = {
        v: 1,
        engine: ENGINE_VERSION,
        base,
        links: [...prefix.map((n) => ({ rule: n.rule, seed: n.seed, solved: n.solved })), { rule, seed: seed >>> 0, solved }],
        proof
      };
      const verdict = checkChain(candidate);
      if (!verdict.ok) return err("invalid_puzzle", verdict.error);
      const row = {
        id: store.newId(),
        parentId: parentId ?? null,
        depth: prefix.length + 1,
        base,
        rule,
        seed: seed >>> 0,
        solved,
        proof,
        playerId: userId,
        createdAt: now,
        engine: ENGINE_VERSION
      };
      await store.insertNode(row);
      return { ok: true, id: row.id, depth: row.depth };
    }
    case "getNode": {
      if (!idOk(body.id)) return err("bad_request", "Bad id.");
      const path = await pathTo(store, body.id);
      if (!path) return err("not_found", "That challenge no longer exists.");
      await store.addEvent({ nodeId: body.id, userId, kind: "open", at: now });
      const chain = chainOf(path, []);
      return { ok: true, id: body.id, depth: path.length, chain, proofHidden: true };
    }
    case "getHint": {
      if (!idOk(body.id)) return err("bad_request", "Bad id.");
      const n = await store.getNode(body.id);
      if (!n) return err("not_found", "That challenge no longer exists.");
      return { ok: true, proof: n.proof };
    }
    case "recordEvent": {
      if (!idOk(body.id) || body.kind !== "solve" && body.kind !== "share" && body.kind !== "copy") return err("bad_request", "Bad event.");
      if (!await store.getNode(body.id)) return err("not_found", "That challenge no longer exists.");
      await store.addEvent({ nodeId: body.id, userId, kind: body.kind, at: now });
      return { ok: true, recorded: true };
    }
    case "myNodes": {
      const rows = await store.listNodesBy(userId, 50);
      return { ok: true, nodes: rows.map((r) => ({ id: r.id, depth: r.depth, rule: r.rule, createdAt: r.createdAt })) };
    }
    case "deleteMe": {
      if (!store.deleteUser) return err("bad_request", "Not supported.");
      await store.deleteUser(userId);
      return { ok: true, deleted: true };
    }
    default:
      return err("bad_request", "Unknown operation.");
  }
}
export {
  LIMITS,
  handleRequest
};
