import { ANGLE_TABLE } from '../src/game/angles';
import { POS_Q } from '../src/game/constants';
import type { PlayController } from '../src/game/controller';
import { placementSegment } from '../src/game/placement';
import { C } from '../src/ui/theme';

import type { View } from '../src/ui/view';
export { fitView, toWorld } from '../src/ui/view';
export type { View };

function line(ctx: CanvasRenderingContext2D, v: View, ax: number, ay: number, bx: number, by: number, width: number, color: string) {
  ctx.strokeStyle = color; ctx.lineWidth = width * v.scale; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
}

/** Canvas2D renderer for the browser preview. The native app draws the same scene with Skia. */
export function drawScene(ctx: CanvasRenderingContext2D, v: View, ctl: PlayController, time: number, selected: number | null, showZone: boolean) {
  const L = ctl.level;
  ctx.save();
  const g = ctx.createLinearGradient(0, 0, 0, v.h);
  g.addColorStop(0, C.bgTop); g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, v.w, v.h);

  // dot grid
  ctx.fillStyle = 'rgba(140,150,255,0.10)';
  for (let x = 0; x <= L.w; x += 10) for (let y = 0; y <= L.h; y += 10) {
    ctx.beginPath(); ctx.arc(v.ox + x * v.scale, v.oy + y * v.scale, 1.1, 0, 7); ctx.fill();
  }
  const sh = ctl.shake;
  ctx.translate((Math.sin(time * 90) * sh * 3), (Math.cos(time * 77) * sh * 3));
  ctx.translate(v.ox, v.oy);
  ctx.scale(v.scale, v.scale);
  const px = 1 / v.scale;

  // world frame
  ctx.strokeStyle = 'rgba(122,132,230,0.35)'; ctx.lineWidth = 1.2 * px;
  roundRect(ctx, 0, 0, L.w, L.h, 3); ctx.stroke();

  if (showZone && ctl.phase === 'edit') {
    const z = L.zone;
    ctx.setLineDash([2.5, 2.5]); ctx.strokeStyle = 'rgba(122,255,196,0.28)'; ctx.lineWidth = 0.7;
    roundRect(ctx, z.x, z.y, z.w, z.h, 3); ctx.stroke(); ctx.setLineDash([]);
  }

  // target
  const T = L.target;
  const pulse = 1 + Math.sin(time * 4) * 0.06;
  const tg = ctx.createRadialGradient(T.x, T.y, 0, T.x, T.y, T.r * 2.4);
  tg.addColorStop(0, 'rgba(255,213,74,0.45)'); tg.addColorStop(1, 'rgba(255,213,74,0)');
  ctx.fillStyle = tg; ctx.beginPath(); ctx.arc(T.x, T.y, T.r * 2.4, 0, 7); ctx.fill();
  ctx.strokeStyle = C.target; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(T.x, T.y, T.r * pulse, 0, 7); ctx.stroke();
  ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(T.x, T.y, T.r * 0.55, 0, 7); ctx.stroke();

  // portals
  if (L.portals) {
    [[L.portals.a, C.portalA], [L.portals.b, C.portalB]].forEach(([p, col]) => {
      const pp = p as { x: number; y: number; r: number };
      for (let k = 0; k < 3; k++) {
        ctx.strokeStyle = col as string; ctx.globalAlpha = 0.9 - k * 0.25; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(pp.x, pp.y, pp.r - k * 1.4, (pp.r - k * 1.4) * (0.75 + Math.sin(time * 5 + k) * 0.08), time * (k % 2 ? 1 : -1), 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  // statics
  for (const s of L.segments) {
    line(ctx, { ...v, scale: 1 }, s.ax, s.ay, s.bx, s.by, s.r * 2, C.wall);
    line(ctx, { ...v, scale: 1 }, s.ax, s.ay, s.bx, s.by, s.r * 0.8, C.wallEdge);
  }
  for (const d of L.discs) {
    const bg = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 1.8);
    bg.addColorStop(0, 'rgba(255,122,217,0.35)'); bg.addColorStop(1, 'rgba(255,122,217,0)');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 1.8, 0, 7); ctx.fill();
    ctx.fillStyle = C.bumper; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.beginPath(); ctx.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.35, 0, 7); ctx.fill();
  }

  // ghost hint
  if (ctl.ghost) {
    const s = placementSegment(L, ctl.ghost);
    ctx.setLineDash([3, 2.4]);
    line(ctx, { ...v, scale: 1 }, s.ax, s.ay, s.bx, s.by, s.r * 2, 'rgba(122,255,196,0.55)');
    ctx.setLineDash([]);
  }

  // pieces
  ctl.placed.forEach((p, i) => {
    if (!p) return;
    const s = placementSegment(L, p);
    const bad = ctl.invalid(i);
    line(ctx, { ...v, scale: 1 }, s.ax, s.ay, s.bx, s.by, s.r * 2, bad ? C.plankBad : C.plank);
    line(ctx, { ...v, scale: 1 }, s.ax, s.ay, s.bx, s.by, s.r * 0.7, 'rgba(255,255,255,0.8)');
    if (selected === i && ctl.phase === 'edit') {
      const [c, sn] = ANGLE_TABLE[p.a];
      const half = L.inventory[p.i].len / 2;
      const hx = p.x / POS_Q + c * half, hy = p.y / POS_Q + sn * half;
      ctx.strokeStyle = C.mint; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x / POS_Q, p.y / POS_Q, 1.5, 0, 7); ctx.fillStyle = C.mint; ctx.fill();
    }
  });

  // trails + balls
  if (ctl.sim) {
    ctl.trails.forEach((tr) => {
      tr.forEach(([x, y], k) => {
        const a = (k / tr.length) * 0.5;
        ctx.fillStyle = `rgba(124,196,255,${a})`;
        ctx.beginPath(); ctx.arc(x, y, 3 * (0.3 + 0.7 * (k / tr.length)), 0, 7); ctx.fill();
      });
    });
    ctl.sim.balls.forEach((b) => {
      if (b.done) return;
      const bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3);
      bg.addColorStop(0, 'rgba(61,165,255,0.5)'); bg.addColorStop(1, 'rgba(61,165,255,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 3, 0, 7); ctx.fill();
      ctx.fillStyle = C.ball; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.32, 0, 7); ctx.fill();
    });
  } else {
    L.balls.forEach((b) => {
      const bg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 3);
      bg.addColorStop(0, 'rgba(61,165,255,0.5)'); bg.addColorStop(1, 'rgba(61,165,255,0)');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 3, 0, 7); ctx.fill();
      ctx.fillStyle = C.ball; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.35, b.r * 0.32, 0, 7); ctx.fill();
    });
  }

  // gravity arrow
  if (L.gravity.y < 0) {
    ctx.fillStyle = 'rgba(255,122,217,0.5)'; ctx.font = '8px system-ui'; ctx.textAlign = 'right';
    ctx.fillText('↑ gravity', L.w - 3, 8);
  }

  // particles
  for (const p of ctl.particles) {
    const a = Math.max(0, p.life / p.max);
    ctx.globalAlpha = a;
    if (p.kind === 'ring') {
      ctx.strokeStyle = p.color; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size + (1 - a) * 22, 0, 7); ctx.stroke();
    } else {
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
