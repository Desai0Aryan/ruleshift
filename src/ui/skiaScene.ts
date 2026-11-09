import {
  PaintStyle, Skia, StrokeCap, TileMode, type SkCanvas, type SkColor, type SkPicture,
} from '@shopify/react-native-skia';
import { ANGLE_TABLE } from '../game/angles';
import { POS_Q } from '../game/constants';
import type { PlayController } from '../game/controller';
import { placementSegment } from '../game/placement';
import type { Level } from '../game/types';
import { C } from './theme';
import type { View } from './view';

/**
 * Imperative Skia renderer. One frame = one recorded SkPicture (a single React node), which is far
 * cheaper than hundreds of declarative nodes at 60 fps. Static scenery is cached per level+size.
 */
const colors = new Map<string, SkColor>();
const col = (hex: string): SkColor => {
  let c = colors.get(hex);
  if (!c) { c = Skia.Color(hex); colors.set(hex, c); }
  return c;
};

const paint = Skia.Paint();
paint.setAntiAlias(true);

function fill(hex: string, a = 1) {
  paint.setShader(null); paint.setPathEffect(null);
  paint.setStyle(PaintStyle.Fill); paint.setColor(col(hex)); paint.setAlphaf(a);
}
function stroke(hex: string, w: number, a = 1) {
  paint.setShader(null); paint.setPathEffect(null);
  paint.setStyle(PaintStyle.Stroke); paint.setStrokeCap(StrokeCap.Round);
  paint.setStrokeWidth(w); paint.setColor(col(hex)); paint.setAlphaf(a);
}
/** soft glow = a few stacked translucent discs (no shader churn per frame) */
function glow(c: SkCanvas, x: number, y: number, r: number, hex: string, a: number) {
  for (let k = 3; k >= 1; k--) { fill(hex, (a * (4 - k)) / 6); c.drawCircle(x, y, r * (0.7 + k * 0.45), paint); }
}

const staticCache = new Map<string, { key: string; pic: SkPicture }>();

function levelKey(l: Level) { return `${l.id}|${l.rules.map((r) => `${r.id}${r.seed}`).join(',')}|${l.balls.length}`; }

function buildStatic(l: Level, v: View): SkPicture {
  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, v.w, v.h));
  const shader = Skia.Shader.MakeLinearGradient({ x: 0, y: 0 }, { x: 0, y: v.h }, [col(C.bgTop), col(C.bgBottom)], null, TileMode.Clamp);
  paint.setStyle(PaintStyle.Fill); paint.setShader(shader); paint.setAlphaf(1);
  c.drawRect(Skia.XYWHRect(0, 0, v.w, v.h), paint);
  paint.setShader(null);
  c.save();
  c.translate(v.ox, v.oy);
  c.scale(v.scale, v.scale);
  for (let x = 0; x <= l.w; x += 10) for (let y = 0; y <= l.h; y += 10) { fill('#8c96ff', 0.12); c.drawCircle(x, y, 0.35, paint); }
  stroke('#7a84e6', 1.2, 0.35);
  c.drawRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, l.w, l.h), 3, 3), paint);
  for (const s of l.segments) {
    stroke(C.wall, s.r * 2); c.drawLine(s.ax, s.ay, s.bx, s.by, paint);
    stroke(s.e >= 0.85 ? '#ff9f5a' : C.wallEdge, s.r * 0.8); c.drawLine(s.ax, s.ay, s.bx, s.by, paint);
  }
  if (l.gravity.x !== 0) {
    // wind streaks: faint arrows showing which way the world is being pushed
    const dir = l.gravity.x > 0 ? 1 : -1;
    for (let y = 28; y < l.h - 10; y += 24) {
      for (let x = 14 + ((y / 24) % 2) * 14; x < l.w - 10; x += 28) {
        stroke('#9be7ff', 0.7, 0.28);
        c.drawLine(x, y, x + dir * 9, y, paint);
        c.drawLine(x + dir * 9, y, x + dir * 6.5, y - 2, paint);
        c.drawLine(x + dir * 9, y, x + dir * 6.5, y + 2, paint);
      }
    }
  }
  for (const d of l.discs) {
    glow(c, d.x, d.y, d.r, C.bumper, 0.35);
    fill(C.bumper); c.drawCircle(d.x, d.y, d.r, paint);
    fill('#ffffff', 0.45); c.drawCircle(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.35, paint);
  }
  c.restore();
  return rec.finishRecordingAsPicture();
}

export function renderScene(ctl: PlayController, v: View, time: number, selected: number | null, showZone: boolean, previewWall?: [number, number, number, number] | null): SkPicture {
  const L = ctl.level;
  if (staticCache.size > 30) staticCache.clear(); // editor creates a new level id on every edit
  const key = `${levelKey(L)}|${v.w}x${v.h}@${v.scale.toFixed(3)}`;
  let cached = staticCache.get(L.id);
  if (!cached || cached.key !== key) {
    cached = { key, pic: buildStatic(L, v) };
    staticCache.set(L.id, cached);
  }

  const rec = Skia.PictureRecorder();
  const c = rec.beginRecording(Skia.XYWHRect(0, 0, v.w, v.h));
  c.drawPicture(cached.pic);
  c.save();
  c.translate(v.ox + Math.sin(time * 90) * ctl.shake * 3, v.oy + Math.cos(time * 77) * ctl.shake * 3);
  c.scale(v.scale, v.scale);

  if (showZone && ctl.phase === 'edit') {
    const z = L.zone;
    paint.setStyle(PaintStyle.Stroke); paint.setStrokeWidth(0.7); paint.setColor(col(C.mint)); paint.setAlphaf(0.28);
    paint.setPathEffect(Skia.PathEffect.MakeDash([2.5, 2.5], 0));
    c.drawRRect(Skia.RRectXY(Skia.XYWHRect(z.x, z.y, z.w, z.h), 3, 3), paint);
    paint.setPathEffect(null);
  }

  // editor: wall being drawn (half units)
  if (previewWall) {
    paint.setStyle(PaintStyle.Stroke); paint.setStrokeCap(StrokeCap.Round); paint.setStrokeWidth(2.4);
    paint.setColor(col(C.mint)); paint.setAlphaf(0.8);
    c.drawLine(previewWall[0] / 2, previewWall[1] / 2, previewWall[2] / 2, previewWall[3] / 2, paint);
  }

  // target
  const T = L.target;
  glow(c, T.x, T.y, T.r, C.target, 0.5);
  stroke(C.target, 1.6); c.drawCircle(T.x, T.y, T.r * (1 + Math.sin(time * 4) * 0.06), paint);
  stroke(C.target, 0.7); c.drawCircle(T.x, T.y, T.r * 0.55, paint);

  // portals
  if (L.portals) {
    ([[L.portals.a, C.portalA], [L.portals.b, C.portalB]] as const).forEach(([p, hex], n) => {
      for (let k = 0; k < 3; k++) {
        const rx = p.r - k * 1.4;
        const ry = rx * (0.75 + Math.sin(time * 5 + k + n) * 0.08);
        c.save();
        c.rotate(((time * (k % 2 ? 57 : -57)) % 360), p.x, p.y);
        stroke(hex, 1.2, 0.9 - k * 0.25);
        c.drawOval(Skia.XYWHRect(p.x - rx, p.y - ry, rx * 2, ry * 2), paint);
        c.restore();
      }
    });
  }

  // hint ghost
  if (ctl.ghost) {
    const s = placementSegment(L, ctl.ghost);
    paint.setStyle(PaintStyle.Stroke); paint.setStrokeCap(StrokeCap.Round); paint.setStrokeWidth(s.r * 2);
    paint.setColor(col(C.mint)); paint.setAlphaf(0.55);
    paint.setPathEffect(Skia.PathEffect.MakeDash([3, 2.4], 0));
    c.drawLine(s.ax, s.ay, s.bx, s.by, paint);
    paint.setPathEffect(null);
  }

  // pieces
  ctl.placed.forEach((p, i) => {
    if (!p) return;
    const s = placementSegment(L, p);
    stroke(ctl.invalid(i) ? C.plankBad : C.plank, s.r * 2); c.drawLine(s.ax, s.ay, s.bx, s.by, paint);
    stroke('#ffffff', s.r * 0.7, 0.8); c.drawLine(s.ax, s.ay, s.bx, s.by, paint);
    if (selected === i && ctl.phase === 'edit') {
      const [cs, sn] = ANGLE_TABLE[p.a];
      const half = L.inventory[p.i].len / 2;
      stroke(C.mint, 0.9); c.drawCircle(p.x / POS_Q + cs * half, p.y / POS_Q + sn * half, 3.4, paint);
      fill(C.mint); c.drawCircle(p.x / POS_Q, p.y / POS_Q, 1.5, paint);
    }
  });

  // trails + balls
  ctl.trails.forEach((tr) => tr.forEach(([x, y], k) => {
    const f = k / tr.length;
    fill(C.ballGlow, f * 0.5); c.drawCircle(x, y, 3 * (0.3 + 0.7 * f), paint);
  }));
  const balls = ctl.sim ? ctl.sim.balls.filter((b) => !b.done) : L.balls;
  for (const b of balls) {
    glow(c, b.x, b.y, b.r, C.ball, 0.4);
    fill(C.ball); c.drawCircle(b.x, b.y, b.r, paint);
    fill('#ffffff', 0.7); c.drawCircle(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.32, paint);
  }

  // particles
  for (const p of ctl.particles) {
    const a = Math.max(0, p.life / p.max);
    if (p.kind === 'ring') { stroke(p.color, 1.2, a); c.drawCircle(p.x, p.y, p.size + (1 - a) * 22, paint); }
    else { fill(p.color, a); c.drawCircle(p.x, p.y, p.size, paint); }
  }
  c.restore();
  return rec.finishRecordingAsPicture();
}
