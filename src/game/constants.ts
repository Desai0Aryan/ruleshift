/**
 * Engine constants. Changing ANY value here changes how every puzzle plays and
 * invalidates every stored solution/share code, so bump ENGINE_VERSION when you do.
 */
export const ENGINE_VERSION = 1;

/** World is a fixed virtual space, scaled to the screen by the renderer. */
export const WORLD_W = 90;
export const WORLD_H = 160;

export const TICK_HZ = 60;
export const SUBSTEPS = 4;

export const BALL_R = 3;
export const GRAVITY = 140; // world units / s^2 (positive = down)
export const MAX_SPEED = 210;

export const PLANK_HALF_T = 1.1;
export const PLANK_BOUNCE = 0.32;
export const WALL_HALF_T = 1.2;
export const WALL_BOUNCE = 0.3;
export const BUMPER_BOUNCE = 1.12;

/** Fraction of tangential speed removed per contact substep (cheap friction). */
export const CONTACT_FRICTION = 0.004;
/** Below this approach speed a bounce is fully absorbed (stops jitter). */
export const REST_SPEED = 7;

export const STILL_SPEED = 0.6;
export const STILL_TICKS = 75;
export const DEFAULT_MAX_TIME = 11; // seconds of sim time
export const OUT_MARGIN = 24;

export const PORTAL_COOLDOWN = 40; // substeps

/** Placement quantisation: positions are integers in 1/POS_Q world units. */
export const POS_Q = 4;
export const ANGLE_STEPS = 64; // planks are symmetric: 0..π in π/64 steps

export const SPEED_STEPS = [1, 1.25, 1.5, 1.75, 2] as const;
export const MAX_BALLS = 3;
