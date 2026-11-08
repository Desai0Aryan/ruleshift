export interface Segment {
  ax: number; ay: number; bx: number; by: number;
  /** half thickness (capsule radius) */
  r: number;
  /** restitution */
  e: number;
}
export interface Disc { x: number; y: number; r: number; e: number }
export interface BallSpec { x: number; y: number; r: number }
export interface Target { x: number; y: number; r: number }
export interface Portal { x: number; y: number; r: number }
export interface PieceSpec { kind: 'plank'; len: number }
export interface Zone { x: number; y: number; w: number; h: number }

/** One applied rule. (id, seed) fully determines the transformation. */
export interface RuleApplication { id: RuleId; seed: number }

export type RuleId = 'reverse_gravity' | 'duplicate' | 'speed' | 'teleport';

export interface Level {
  id: string;
  name: string;
  w: number;
  h: number;
  balls: BallSpec[];
  target: Target;
  segments: Segment[];
  discs: Disc[];
  inventory: PieceSpec[];
  /** where piece centres may be placed */
  zone: Zone;
  gravity: { x: number; y: number };
  timeScale: number;
  portals: { a: Portal; b: Portal } | null;
  maxTime: number;
  /** rules applied on top of the authored base level, in order */
  rules: RuleApplication[];
  /** authored base level id this level derives from */
  base: string;
}

/**
 * A piece placement. x,y are integers in 1/POS_Q world units (piece centre);
 * a is an angle index 0..ANGLE_STEPS-1 (angle = a*π/ANGLE_STEPS). i = inventory index.
 */
export interface Placement { i: number; x: number; y: number; a: number }
export type Solution = Placement[];
