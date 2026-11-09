import { describe, expect, it } from 'vitest';
import { coachStep } from '../src/ui/coach';
import { PlayController } from '../src/game/controller';
import { BASE_LEVELS, pinnedSolution } from '../src/game/levels';

describe('coach', () => {
  it('walks the first level: drag, aim, watch, done', () => {
    expect(coachStep({ show: true, placed: 0, phase: 'edit' })?.id).toBe('drag');
    expect(coachStep({ show: true, placed: 1, phase: 'edit' })?.id).toBe('aim');
    expect(coachStep({ show: true, placed: 1, phase: 'running' })?.id).toBe('watch');
    expect(coachStep({ show: true, placed: 1, phase: 'lost' })).toBeNull();
    expect(coachStep({ show: false, placed: 0, phase: 'edit' })).toBeNull();
  });
});

describe('reduce motion', () => {
  it('removes shake and thins particles on a win', () => {
    const run = (reduce: boolean) => {
      const c = new PlayController(BASE_LEVELS[0]);
      c.reduceMotion = reduce;
      c.setSolution(pinnedSolution(BASE_LEVELS[0].id)!);
      c.play();
      for (let i = 0; i < 1500 && c.phase === 'running'; i++) c.advance(1 / 60);
      return { phase: c.phase, shake: c.shake, particles: c.particles.length };
    };
    const full = run(false); const calm = run(true);
    expect(full.phase).toBe('won'); expect(calm.phase).toBe('won');
    expect(calm.shake).toBe(0);
    expect(full.shake).toBeGreaterThan(0);
    expect(calm.particles).toBeLessThan(full.particles / 2);
  });
});
