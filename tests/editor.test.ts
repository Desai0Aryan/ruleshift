import { describe, expect, it } from 'vitest';
import { EditorController } from '../src/editor/controller';
import { CUSTOM_LIMITS, validateCustom } from '../src/game/custom';

const wall = (e: EditorController, x1: number, y1: number, x2: number, y2: number) => { e.setTool('wall'); e.down(x1, y1); e.move((x1 + x2) / 2, (y1 + y2) / 2); e.up(x2, y2); };

describe('editor', () => {
  it('draws walls by dragging, snapped to the grid, and ignores taps', () => {
    const e = new EditorController();
    wall(e, 10.2, 80.4, 50.4, 90.6);
    expect(e.def.w).toEqual([[20, 160, 100, 182]]);
    e.setTool('wall'); e.down(30, 30); e.up(30.1, 30);
    expect(e.def.w).toHaveLength(1);
    expect(e.message).toMatch(/further/);
  });
  it('preview follows the drag and clears on release', () => {
    const e = new EditorController(); e.setTool('wall');
    e.down(10, 10); e.move(40, 10);
    expect(e.preview).toEqual([20, 20, 80, 20]);
    e.up(40, 10);
    expect(e.preview).toBeNull();
  });
  it('places bumpers (respecting the cap), moves ball and goal by dragging, clamps to the world', () => {
    const e = new EditorController();
    e.setTool('bumper');
    for (let i = 0; i < 12; i++) { e.down(10 + i * 6, 60); e.up(10 + i * 6, 60); }
    expect(e.def.d).toHaveLength(CUSTOM_LIMITS.maxBumpers);
    expect(e.message).toMatch(/maximum/);
    e.setTool('ball'); e.down(40, 30); e.move(-50, -50); e.up(-50, -50);
    expect(e.def.b).toEqual([16, 16]);
    e.setTool('goal'); e.down(60, 120); e.move(500, 900); e.up(500, 900);
    expect(e.def.t.slice(0, 2)).toEqual([164, 304]);
    expect(validateCustom({ ...e.def, d: [] })).toBeNull();
  });
  it('wall cap', () => {
    const e = new EditorController();
    for (let i = 0; i < 20; i++) wall(e, 5, 10 + i * 6, 40, 10 + i * 6);
    expect(e.def.w).toHaveLength(CUSTOM_LIMITS.maxWalls);
  });
  it('erases the nearest wall or bumper, only when tapped close', () => {
    const e = new EditorController();
    wall(e, 10, 80, 50, 80);
    e.setTool('bumper'); e.down(70, 40); e.up(70, 40);
    e.setTool('erase'); e.down(30, 120);
    expect(e.def.w).toHaveLength(1); expect(e.message).toMatch(/right on/);
    e.down(30, 81); expect(e.def.w).toHaveLength(0);
    e.down(70, 41); expect(e.def.d).toHaveLength(0);
  });
  it('undo restores every kind of change, including wall drags', () => {
    const e = new EditorController();
    const start = JSON.stringify(e.def);
    wall(e, 10, 80, 50, 80);
    e.setTool('bumper'); e.down(70, 40); e.up(70, 40);
    e.setTool('goal'); e.down(10, 10); e.up(10, 10);
    e.cycleGoalSize(); e.addPlank(); e.cyclePlank(0);
    while (e.canUndo) e.undo();
    expect(JSON.stringify(e.def)).toBe(start);
  });
  it('plank settings stay within limits', () => {
    const e = new EditorController();
    for (let i = 0; i < 9; i++) e.addPlank();
    expect(e.def.p).toHaveLength(CUSTOM_LIMITS.maxPlanks);
    for (let i = 0; i < 9; i++) e.removePlank();
    expect(e.def.p).toHaveLength(1);
    for (let i = 0; i < 7; i++) e.cyclePlank(0);
    expect(CUSTOM_LIMITS.plankLengths).toContain(e.def.p[0]);
  });
  it('every drawing the editor can produce passes validation or says why not', () => {
    const e = new EditorController();
    let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let n = 0; n < 300; n++) {
      const t = (['wall', 'bumper', 'ball', 'goal', 'erase'] as const)[Math.floor(rnd() * 5)];
      e.setTool(t);
      e.down(rnd() * 100 - 5, rnd() * 170 - 5); e.move(rnd() * 100, rnd() * 170); e.up(rnd() * 100, rnd() * 170);
      if (rnd() < 0.1) e.undo();
      // structure must ALWAYS be valid-or-explained, never throw
      const p = e.problem();
      expect(p === null || typeof p === 'string').toBe(true);
    }
  });
  it('a finished design is testable', () => {
    const e = new EditorController();
    e.setTool('ball'); e.down(20, 20); e.up(20, 20);
    e.setTool('goal'); e.down(10, 148); e.up(10, 148);
    wall(e, 0, 90, 60, 100);
    expect(e.problem()).toBeNull();
    expect(e.level().segments).toHaveLength(1);
    // default design with nothing in the way: ball just falls past the goal => fine to test, not trivial
    expect(new EditorController().problem()).toBeNull();
  });
});
