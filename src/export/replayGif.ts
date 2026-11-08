import { ANGLE_TABLE } from '../game/angles';
import { POS_Q } from '../game/constants';
import type { PlayController } from '../game/controller';
import { placementSegment } from '../game/placement';
import { ChainReplay, replayStages } from '../game/replay';
import { RULES } from '../rules';
import type { Chain } from '../social/chain';
import { C } from '../ui/theme';
import { encodeGif, type GifFrame, medianCut, Quantizer, TRANSPARENT_INDEX } from './gif';
import { hex, Raster, type RGB } from './raster';

const col = {
  top: hex(C.bgTop), bottom: hex(C.bgBottom), wall: hex(C.wall), wallEdge: hex(C.wallEdge), bumper: hex(C.bumper),
  target: hex(C.target), ball: hex(C.ball), ballGlow: hex(C.ballGlow), plank: hex(C.plank), text: hex(C.text),
  dot: [60, 66, 140] as RGB, frame: [50, 56, 120] as RGB,
};

interface Geo { scale: number; ox: number; oy: number }

function drawStatic(r: Raster, g: Geo, ctl: PlayController) {
  const L = ctl.level;
  r.gradient(col.top, col.bottom);
  for (let x = 0; x <= L.w; x += 10) for (let y = 0; y <= L.h; y += 10) r.circle(g.ox + x * g.scale, g.oy + y * g.scale, 0.8, col.dot, 0.9);
  const X = (x: number) => g.ox + x * g.scale, Y = (y: number) => g.oy + y * g.scale;
  const corners: Array<[number, number]> = [[0, 0], [L.w, 0], [L.w, L.h], [0, L.h], [0, 0]];
  for (let i = 0; i < 4; i++) r.capsule(X(corners[i][0]), Y(corners[i][1]), X(corners[i + 1][0]), Y(corners[i + 1][1]), 0.8, col.frame, 0.8);
  for (const s of L.segments) {
    r.capsule(X(s.ax), Y(s.ay), X(s.bx), Y(s.by), s.r * g.scale, col.wall);
    r.capsule(X(s.ax), Y(s.ay), X(s.bx), Y(s.by), s.r * g.scale * 0.4, col.wallEdge);
  }
  for (const d of L.discs) {
    r.glow(X(d.x), Y(d.y), d.r * g.scale, col.bumper, 0.35);
    r.circle(X(d.x), Y(d.y), d.r * g.scale, col.bumper);
    r.circle(X(d.x - d.r * 0.3), Y(d.y - d.r * 0.3), d.r * g.scale * 0.35, [255, 255, 255], 0.45);
  }
}

function drawDynamic(r: Raster, g: Geo, ctl: PlayController, t: number) {
  const L = ctl.level;
  const X = (x: number) => g.ox + x * g.scale, Y = (y: number) => g.oy + y * g.scale, S = (v: number) => v * g.scale;
  const T = L.target;
  r.glow(X(T.x), Y(T.y), S(T.r), col.target, 0.5);
  r.ring(X(T.x), Y(T.y), S(T.r) * (1 + Math.sin(t * 4) * 0.06), Math.max(1.5, S(1.6)), col.target);
  r.ring(X(T.x), Y(T.y), S(T.r * 0.55), Math.max(1, S(0.7)), col.target);
  if (L.portals) {
    for (const [p, c] of [[L.portals.a, hex(C.portalA)], [L.portals.b, hex(C.portalB)]] as const) {
      for (let k = 0; k < 3; k++) r.ring(X(p.x), Y(p.y), S(p.r - k * 1.4) * (0.9 + Math.sin(t * 5 + k) * 0.05), Math.max(1.2, S(1.1)), c, 0.9 - k * 0.25);
    }
  }
  ctl.placed.forEach((p) => {
    if (!p) return;
    const s = placementSegment(L, p);
    r.capsule(X(s.ax), Y(s.ay), X(s.bx), Y(s.by), S(s.r), col.plank);
    r.capsule(X(s.ax), Y(s.ay), X(s.bx), Y(s.by), S(s.r) * 0.35, [255, 255, 255], 0.8);
  });
  ctl.trails.forEach((tr) => tr.forEach(([x, y], k) => {
    const f = k / tr.length;
    r.circle(X(x), Y(y), S(3) * (0.3 + 0.7 * f), col.ballGlow, f * 0.5);
  }));
  const balls = ctl.sim ? ctl.sim.balls.filter((b) => !b.done) : L.balls;
  for (const b of balls) {
    r.glow(X(b.x), Y(b.y), S(b.r), col.ball, 0.4);
    r.circle(X(b.x), Y(b.y), S(b.r), col.ball);
    r.circle(X(b.x - b.r * 0.3), Y(b.y - b.r * 0.35), S(b.r * 0.32), [255, 255, 255], 0.7);
  }
  for (const p of ctl.particles) {
    const a = Math.max(0, p.life / p.max);
    const c = hex(p.color);
    if (p.kind === 'ring') r.ring(X(p.x), Y(p.y), S(p.size + (1 - a) * 22), Math.max(1, S(1.2)), c, a);
    else r.circle(X(p.x), Y(p.y), Math.max(0.8, S(p.size)), c, a);
  }
}

export interface GifOptions {
  /** output width in px (height follows the 9:16 world); default 216 keeps files small enough for chat apps */
  width?: number;
  fps?: number;
  onProgress?: (frac: number) => void;
  /** called between batches so a UI thread can breathe */
  yieldFn?: () => Promise<void>;
  /** safety cap on simulated stage seconds */
  maxSeconds?: number;
}

export interface GifResult { bytes: Uint8Array; width: number; height: number; frames: number; seconds: number }

/**
 * Renders the whole chain from stored inputs: each stage plays its recorded solution, labelled with the twist
 * that created it, then an end card. Pure TypeScript: identical output on device, server and in tests.
 */
export async function renderReplayGif(chain: Chain, opts: GifOptions = {}): Promise<GifResult | null> {
  const stages = replayStages(chain);
  if (!stages) return null;
  const W = Math.max(90, Math.round((opts.width ?? 216) / 2) * 2);
  const H = Math.round((W * 16) / 9);
  const fps = opts.fps ?? 20;
  const stepsPerFrame = Math.round(60 / fps);
  const topBand = Math.round(H * 0.075);
  const L0 = stages[0].level;
  const scale = Math.min((W - 8) / L0.w, (H - topBand - 8) / L0.h);
  const geo: Geo = { scale, ox: (W - L0.w * scale) / 2, oy: topBand + (H - topBand - L0.h * scale) / 2 };
  const textScale = Math.max(1, Math.round(W / 110));
  const maxSteps = Math.round((opts.maxSeconds ?? 90) * 60);

  const card = new Raster(W, H);
  card.gradient(col.top, col.bottom);
  card.textCentered('RULESHIFT', Math.round(H * 0.38), Math.max(2, Math.round(W / 36)), hex(C.accent));
  card.textCentered(`${chain.links.length} ${chain.links.length === 1 ? 'TWIST' : 'TWISTS'} DEEP`, Math.round(H * 0.5), textScale, hex(C.pink));
  card.textCentered('CAN YOU SOLVE IT?', Math.round(H * 0.58), textScale, col.text);

  /**
   * Streams frames through ONE reused buffer (constant memory, however long the chain is). The simulation is
   * deterministic, so it can simply be run twice: pass 1 samples colours for the palette, pass 2 encodes.
   * `draw(i)` lets pass 1 skip rendering most frames (stepping the sim is cheap, drawing is not).
   */
  const run = async (draw: (i: number) => boolean, onFrame: (r: Raster, i: number, last: boolean) => void) => {
    const replay = new ChainReplay(stages);
    replay.loop = false;
    const base = new Raster(W, H);
    const cur = new Raster(W, H);
    let lastIndex = -1, t = 0, steps = 0, i = 0;
    while (!(replay.index === stages.length - 1 && replay.state === 'hold' && replay.t > 1.3) && steps < maxSteps) {
      replay.advance(1 / 60);
      steps++;
      t += 1 / 60;
      if (replay.index !== lastIndex) { lastIndex = replay.index; if (draw(i)) drawStatic(base, geo, replay.ctl); else lastIndex = -1; }
      if (steps % stepsPerFrame !== 0) continue;
      if (draw(i)) {
        if (lastIndex < 0) { lastIndex = replay.index; drawStatic(base, geo, replay.ctl); }
        cur.copyFrom(base);
        drawDynamic(cur, geo, replay.ctl, t);
        let label = `${replay.index + 1}/${stages.length} ${replay.stage.label}`;
        if (cur.fitScale(label, textScale) < 2 && textScale >= 2) label = replay.stage.label;
        const ls = cur.fitScale(label, textScale);
        cur.textCentered(label, Math.round((topBand - 7 * ls) / 2), ls, replay.stage.rule ? hex(RULES[replay.stage.rule].color) : col.text);
        onFrame(cur, i, false);
      }
      i++;
      if (i % 20 === 0) await opts.yieldFn?.();
    }
    return { seconds: t, frames: i };
  };

  // Pass 1: palette from ~16 spread-out frames (+ the end card)
  const sample: number[] = [];
  const addSamples = (r: Raster) => { for (let k = 0; k < r.data.length; k += 15) sample.push(r.data[k], r.data[k + 1], r.data[k + 2]); };
  const first = await run(() => false, () => {}); // measure length cheaply
  const every = Math.max(1, Math.floor(first.frames / 16));
  await run((i) => i % every === 0, (r) => addSamples(r));
  addSamples(card);
  opts.onProgress?.(0.3);
  const palette = medianCut(new Uint8Array(sample), 255);
  const q = new Quantizer(palette);

  // Pass 2: stream-encode with transparent diffs; identical frames merge into a longer delay.
  const frames: GifFrame[] = [];
  let prev: Uint8Array | null = null;
  const delay = Math.round(100 / fps);
  const push = (r: Raster, hold: number) => {
    const d = r.data;
    const idx = new Uint8Array(W * H);
    for (let i = 0, p = 0; p < idx.length; i += 3, p++) idx[p] = q.index(d[i], d[i + 1], d[i + 2]);
    if (!prev) {
      frames.push({ x: 0, y: 0, w: W, h: H, indices: idx, delayCs: hold, transparent: false });
    } else {
      let x0 = W, y0 = H, x1 = -1, y1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (idx[y * W + x] !== prev[y * W + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) frames[frames.length - 1].delayCs += hold;
      else {
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const sub = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const a = idx[(y + y0) * W + x + x0];
          sub[y * w + x] = a === prev[(y + y0) * W + x + x0] ? TRANSPARENT_INDEX : a;
        }
        frames.push({ x: x0, y: y0, w, h, indices: sub, delayCs: hold, transparent: true });
      }
    }
    prev = idx;
  };
  let done = 0;
  const res = await run(() => true, (r) => { push(r, delay); done++; if (done % 15 === 0) opts.onProgress?.(0.3 + 0.7 * Math.min(1, done / Math.max(1, first.frames))); });
  push(card, 200);
  const bytes = encodeGif(W, H, palette, frames, 0);
  opts.onProgress?.(1);
  return { bytes, width: W, height: H, frames: frames.length, seconds: res.seconds };
}
