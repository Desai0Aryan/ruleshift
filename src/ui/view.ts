/** Screen <-> world mapping shared by every renderer (pure maths, no UI imports). */
export interface View { w: number; h: number; scale: number; ox: number; oy: number }

export function fitView(cw: number, ch: number, ww: number, wh: number, pad = 10, top = 0): View {
  const scale = Math.max(0.01, Math.min((cw - pad * 2) / ww, (ch - top - pad) / wh));
  return { w: cw, h: ch, scale, ox: (cw - ww * scale) / 2, oy: top + (ch - top - wh * scale) / 2 };
}
export const toWorld = (v: View, sx: number, sy: number): [number, number] => [(sx - v.ox) / v.scale, (sy - v.oy) / v.scale];
