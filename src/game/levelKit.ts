import { BALL_R, BUMPER_BOUNCE, DEFAULT_MAX_TIME, GRAVITY, WALL_BOUNCE, WALL_HALF_T, WORLD_H, WORLD_W } from './constants';
import type { Disc, Level, PieceSpec, Segment, Zone } from './types';

/** Tiny authoring helpers so levels read like drawings. */
export const wall = (ax: number, ay: number, bx: number, by: number, r = WALL_HALF_T): Segment => ({
  ax, ay, bx, by, r, e: WALL_BOUNCE,
});
export const bumper = (x: number, y: number, r = 5, e = BUMPER_BOUNCE): Disc => ({ x, y, r, e });
/** A box-shaped cup (open at top): left wall, floor, right wall. */
export const cup = (cx: number, topY: number, w: number, h: number): Segment[] => [
  wall(cx - w / 2, topY, cx - w / 2, topY + h),
  wall(cx - w / 2, topY + h, cx + w / 2, topY + h),
  wall(cx + w / 2, topY, cx + w / 2, topY + h),
];

export interface LevelDef {
  id: string;
  name: string;
  ball: [number, number];
  target: [number, number];
  targetR?: number;
  segments?: Segment[];
  discs?: Disc[];
  planks: number[]; // plank lengths
  zone?: Zone;
  maxTime?: number;
}

export function makeLevel(d: LevelDef): Level {
  const inventory: PieceSpec[] = d.planks.map((len) => ({ kind: 'plank', len }));
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
    rules: [],
  };
}

export function cloneLevel(l: Level): Level {
  return JSON.parse(JSON.stringify(l)) as Level;
}
