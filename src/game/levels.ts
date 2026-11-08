import { LEVEL_DEFS } from './levelDefs';
import { makeLevel } from './levelKit';
import PINNED from './levels.solutions.json';
import type { Level, Solution } from './types';

export const BASE_LEVELS: Level[] = LEVEL_DEFS.map(makeLevel);
export const BASE_LEVEL_IDS = BASE_LEVELS.map((l) => l.id);

export function getBaseLevel(id: string): Level | undefined {
  return BASE_LEVELS.find((l) => l.id === id);
}

/** Reference solution pinned by `npm run levels:solve` (used for hints and tests). */
export function pinnedSolution(id: string): Solution | undefined {
  return (PINNED as Record<string, Solution>)[id];
}
