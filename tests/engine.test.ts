import { describe, expect, it } from 'vitest';
import { ANGLE_STEPS, POS_Q } from '../src/game/constants';
import { ANGLE_TABLE } from '../src/game/angles';
import { BASE_LEVELS, pinnedSolution } from '../src/game/levels';
import { validateSolution } from '../src/game/placement';
import { Rng } from '../src/game/rng';
import { createSim, runSolution, stepSim, verifySolution } from '../src/game/sim';
import { solve } from '../src/game/solver';
import { cloneLevel } from '../src/game/levelKit';

describe('angle table', () => {
  it('has 64 unit-length directions', () => {
    expect(ANGLE_TABLE.length).toBe(ANGLE_STEPS);
    for (const [c, s] of ANGLE_TABLE) expect(Math.abs(c * c + s * s - 1)).toBeLessThan(1e-6);
  });
});

describe('determinism', () => {
  it('same input twice => bit-identical digest', () => {
    for (const l of BASE_LEVELS) {
      const sol = pinnedSolution(l.id)!;
      expect(runSolution(l, sol).digest).toBe(runSolution(cloneLevel(l), JSON.parse(JSON.stringify(sol))).digest);
    }
  });

  it('GOLDEN: pinned digests never change (guards against engine drift between app versions/devices)', () => {
    // If this fails you changed physics. Bump ENGINE_VERSION, re-run `npm run levels:solve`, update GOLDEN.
    const got: Record<string, number> = {};
    for (const l of BASE_LEVELS) got[l.id] = runSolution(l, pinnedSolution(l.id)!).digest;
    expect(got).toMatchSnapshot();
  });

  it('engine source never touches non-deterministic APIs', async () => {
    const fs = await import('node:fs');
    for (const f of ['sim.ts', 'placement.ts', 'solver.ts', 'rng.ts']) {
      const src = fs.readFileSync(`src/game/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const placementUiHelper = f === 'placement.ts'; // angleIndexFromDirection is UI-only
      for (const banned of ['Math.sin', 'Math.cos', 'Math.pow', 'Math.exp', 'Math.random', 'Date.now', 'performance.now', 'Math.hypot']) {
        if (placementUiHelper && banned === 'Math.atan2') continue;
        expect(src.includes(banned), `${f} uses ${banned}`).toBe(false);
      }
      if (f !== 'placement.ts') expect(src.includes('Math.atan2'), `${f} uses atan2`).toBe(false);
    }
  });

  it('stepping tick-by-tick matches runSolution', () => {
    const l = BASE_LEVELS[0];
    const sol = pinnedSolution(l.id)!;
    const sim = createSim(l, sol);
    while (sim.status === 'running') stepSim(sim);
    expect(sim.status).toBe('won');
    expect(sim.tick).toBe(runSolution(l, sol).ticks);
  });
});

describe('physics sanity', () => {
  it('a free ball falls and exits the world', () => {
    const l = cloneLevel(BASE_LEVELS[0]);
    l.segments = [];
    const r = runSolution(l, []);
    expect(r.won).toBe(false);
    expect(r.reason).toBe('out');
  });

  it('a ball on a flat floor comes to rest and is reported as still', () => {
    const l = cloneLevel(BASE_LEVELS[0]);
    l.target = { x: 5, y: 150, r: 3 };
    l.segments = [{ ax: 0, ay: 100, bx: 90, by: 100, r: 1.2, e: 0.3 }];
    const r = runSolution(l, []);
    expect(r.reason).toBe('still');
  });

  it('never tunnels through a wall at top speed', () => {
    const l = cloneLevel(BASE_LEVELS[0]);
    l.balls = [{ x: 45, y: 2, r: 3 }];
    l.target = { x: 10, y: 150, r: 3 };
    l.timeScale = 2;
    l.segments = [{ ax: 0, ay: 120, bx: 90, by: 120, r: 1.1, e: 0.2 }];
    const sim = createSim(l, []);
    let maxY = 0;
    while (sim.status === 'running') { stepSim(sim); maxY = Math.max(maxY, sim.balls[0].y); }
    expect(maxY).toBeLessThan(121);
  });

  it('reverse gravity flips the fall direction', () => {
    const l = cloneLevel(BASE_LEVELS[0]);
    l.gravity.y = -l.gravity.y;
    const sim = createSim(l, []);
    for (let i = 0; i < 10; i++) stepSim(sim);
    expect(sim.balls[0].vy).toBeLessThan(0);
  });

  it('portals teleport and keep momentum', () => {
    const l = cloneLevel(BASE_LEVELS[0]);
    l.segments = [];
    l.balls = [{ x: 20, y: 20, r: 3 }];
    l.portals = { a: { x: 20, y: 50, r: 5 }, b: { x: 70, y: 100, r: 5 } };
    const sim = createSim(l, []);
    let jumped = false;
    for (let i = 0; i < 200 && !jumped; i++) { stepSim(sim); if (sim.balls[0].x > 60) jumped = true; }
    expect(jumped).toBe(true);
    expect(sim.balls[0].vy).toBeGreaterThan(30);
  });

  it('two balls collide instead of passing through each other', () => {
    const l = cloneLevel(BASE_LEVELS[0]);
    l.segments = [];
    l.balls = [{ x: 30, y: 40, r: 3 }, { x: 31, y: 40, r: 3 }];
    const sim = createSim(l, []);
    stepSim(sim);
    const d = Math.hypot(sim.balls[0].x - sim.balls[1].x, sim.balls[0].y - sim.balls[1].y);
    expect(d).toBeGreaterThanOrEqual(5.9);
  });
});

describe('solutions & validation (untrusted input)', () => {
  const L = BASE_LEVELS[0];
  const ok = pinnedSolution(L.id)!;
  it('accepts the pinned solution', () => expect(verifySolution(L, ok).ok).toBe(true));
  it('rejects garbage', () => {
    expect(validateSolution(L, [{ i: 0, x: 1.5, y: 10, a: 0 }])).toMatch(/non-integer/);
    expect(validateSolution(L, [{ i: 5, x: 40, y: 40, a: 0 }])).toMatch(/bad piece/);
    expect(validateSolution(L, [{ i: 0, x: 40, y: 40, a: 64 }])).toMatch(/bad angle/);
    expect(validateSolution(L, [{ i: 0, x: 0, y: 0, a: 0 }])).toMatch(/outside/);
    expect(validateSolution(L, [ok[0], ok[0]])).toMatch(/too many|twice/);
    const wide = cloneLevel(L);
    wide.zone = { x: 0, y: 0, w: 90, h: 160 };
    expect(validateSolution(wide, [{ i: 0, x: L.balls[0].x * POS_Q, y: (L.balls[0].y + 1) * POS_Q, a: 0 }])).toMatch(/spawn/);
    // @ts-expect-error deliberately wrong type
    expect(validateSolution(L, 'nope')).toMatch(/not a list/);
  });
  it('a non-winning but valid placement is rejected by verifySolution', () => {
    expect(verifySolution(L, [{ i: 0, x: 60 * POS_Q, y: 140 * POS_Q, a: 0 }]).ok).toBe(false);
  });
});

describe('authored levels', () => {
  it('there are at least 12 and ids are unique', () => {
    expect(BASE_LEVELS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(BASE_LEVELS.map((l) => l.id)).size).toBe(BASE_LEVELS.length);
  });
  for (const l of BASE_LEVELS) {
    it(`${l.id} ${l.name}: pinned solution is valid, wins, and the empty board does not`, () => {
      const sol = pinnedSolution(l.id);
      expect(sol, 'run npm run levels:solve').toBeDefined();
      expect(verifySolution(l, sol!).ok).toBe(true);
      expect(runSolution(l, []).won).toBe(false);
    });
  }
});

describe('solver', () => {
  it('is deterministic for a given seed', () => {
    const l = BASE_LEVELS[4];
    const a = solve(l, { seed: 3, budget: 3000 });
    const b = solve(l, { seed: 3, budget: 3000 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
  it('reports failure honestly on an impossible puzzle', () => {
    const l = cloneLevel(BASE_LEVELS[0]);
    // ball sealed inside a closed box
    l.segments = [
      { ax: 30, ay: 30, bx: 60, by: 30, r: 1.5, e: 0.1 }, { ax: 30, ay: 60, bx: 60, by: 60, r: 1.5, e: 0.1 },
      { ax: 30, ay: 30, bx: 30, by: 60, r: 1.5, e: 0.1 }, { ax: 60, ay: 30, bx: 60, by: 60, r: 1.5, e: 0.1 },
    ];
    l.balls = [{ x: 45, y: 45, r: 3 }];
    l.target = { x: 45, y: 140, r: 5 };
    const r = solve(l, { budget: 400 });
    expect(r.solved).toBe(false);
  });
  it('uses the rng reproducibly', () => {
    const a = new Rng(5), b = new Rng(5);
    for (let i = 0; i < 50; i++) expect(a.next()).toBe(b.next());
  });
});
