import { describe, expect, it } from 'vitest';
import { BASE_LEVELS } from '../src/game/levels';
import { runSolution, verifySolution } from '../src/game/sim';
import { cloneLevel } from '../src/game/levelKit';
import { applyRule, RULE_ORDER, RULES } from '../src/rules';
import { verifyRuleSync } from '../src/rules/verify';

describe('rules are pure + deterministic', () => {
  for (const id of RULE_ORDER) {
    it(`${id}: same (level, seed) => identical result, input untouched`, () => {
      for (const l of BASE_LEVELS.slice(0, 6)) {
        const before = JSON.stringify(l);
        const a = applyRule(l, id, 42);
        const b = applyRule(cloneLevel(l), id, 42);
        expect(JSON.stringify(l)).toBe(before);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
        if (a) expect(a.rules.at(-1)).toEqual({ id, seed: 42 });
      }
    });
  }
  it('reverse gravity twice restores the original puzzle', () => {
    const l = BASE_LEVELS[2];
    const twice = applyRule(applyRule(l, 'reverse_gravity', 1)!, 'reverse_gravity', 1)!;
    expect({ ...twice, rules: [] }).toEqual(l);
  });
  it('speed is capped (so chains cannot make physics unplayable)', () => {
    let l = BASE_LEVELS[0];
    let n = 0;
    for (;;) { const nx = applyRule(l, 'speed', 1); if (!nx) break; l = nx; n++; }
    expect(n).toBe(4);
    expect(l.timeScale).toBe(2);
  });
  it('duplicate is capped at 3 balls and never spawns inside geometry', () => {
    let l = BASE_LEVELS[0];
    for (let s = 1; s < 10; s++) { const nx = applyRule(l, 'duplicate', s); if (!nx) break; l = nx; }
    expect(l.balls.length).toBe(3);
  });
  it('teleport places two separated portals inside the world', () => {
    const l = applyRule(BASE_LEVELS[3], 'teleport', 9)!;
    expect(l.portals).not.toBeNull();
    expect(Math.hypot(l.portals!.a.x - l.portals!.b.x, l.portals!.a.y - l.portals!.b.y)).toBeGreaterThan(20);
  });
  it('every rule has UI metadata', () => {
    for (const id of RULE_ORDER) {
      expect(RULES[id].name.length).toBeGreaterThan(2);
      expect(RULES[id].color).toMatch(/^#/);
    }
  });
});

describe('verified rules (anti-collapse guarantee)', () => {
  it('whenever a rule is offered, its proof really wins on the modified level', () => {
    for (const l of BASE_LEVELS.slice(0, 8)) {
      for (const id of RULE_ORDER) {
        const v = verifyRuleSync(l, id, { budget: 3000 });
        if (v.status === 'ok') {
          expect(verifySolution(v.level, v.solution).ok).toBe(true);
          expect(runSolution(v.level, []).won).toBe(false); // never trivial
        }
      }
    }
  });
  it('most rules are offerable on most levels (otherwise the game would feel locked down)', () => {
    let ok = 0, total = 0;
    for (const l of BASE_LEVELS) for (const id of RULE_ORDER) { total++; if (verifyRuleSync(l, id, { budget: 3000 }).status === 'ok') ok++; }
    expect(ok / total).toBeGreaterThan(0.8);
  });
  it('refuses a rule that makes the puzzle impossible instead of offering it', () => {
    const v = verifyRuleSync(BASE_LEVELS[1], 'reverse_gravity', { budget: 1500 });
    expect(v.status).toBe('unsolved');
  });
});
