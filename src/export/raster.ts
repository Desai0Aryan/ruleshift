/** Minimal anti-aliased software rasteriser (RGB, no dependencies) used for GIF export. */
export type RGB = [number, number, number];

export function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e], C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e], E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f], F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f], H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11], I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c], K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11], L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11], N: [0x11, 0x11, 0x19, 0x15, 0x13, 0x11, 0x11], O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10], Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d], R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e], T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04], U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04], W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x15, 0x0a], X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04], Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  '0': [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e], '1': [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e], '2': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  '3': [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e], '4': [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02], '5': [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  '6': [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e], '7': [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08], '8': [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  '9': [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  '+': [0x00, 0x04, 0x04, 0x1f, 0x04, 0x04, 0x00], '/': [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10], '-': [0x00, 0x00, 0x00, 0x1f, 0x00, 0x00, 0x00],
  '?': [0x0e, 0x11, 0x01, 0x02, 0x04, 0x00, 0x04], '.': [0x00, 0x00, 0x00, 0x00, 0x00, 0x0c, 0x0c], '!': [0x04, 0x04, 0x04, 0x04, 0x04, 0x00, 0x04],
  ' ': [0, 0, 0, 0, 0, 0, 0],
};

export class Raster {
  readonly data: Uint8Array;
  constructor(readonly w: number, readonly h: number) { this.data = new Uint8Array(w * h * 3); }

  copyFrom(o: Raster) { this.data.set(o.data); }

  gradient(top: RGB, bottom: RGB) {
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1);
      const r = top[0] + (bottom[0] - top[0]) * t, g = top[1] + (bottom[1] - top[1]) * t, b = top[2] + (bottom[2] - top[2]) * t;
      for (let x = 0; x < this.w; x++) { const i = (y * this.w + x) * 3; this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; }
    }
  }

  private px(x: number, y: number, c: RGB, a: number) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3, d = this.data;
    d[i] += (c[0] - d[i]) * a; d[i + 1] += (c[1] - d[i + 1]) * a; d[i + 2] += (c[2] - d[i + 2]) * a;
  }

  circle(cx: number, cy: number, r: number, c: RGB, alpha = 1) {
    const x0 = Math.floor(cx - r - 1), x1 = Math.ceil(cx + r + 1), y0 = Math.floor(cy - r - 1), y1 = Math.ceil(cy + r + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const d = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
      this.px(x, y, c, Math.min(1, Math.max(0, r + 0.5 - d)) * alpha);
    }
  }

  ring(cx: number, cy: number, r: number, width: number, c: RGB, alpha = 1) {
    const o = r + width / 2 + 1;
    for (let y = Math.floor(cy - o); y <= Math.ceil(cy + o); y++) for (let x = Math.floor(cx - o); x <= Math.ceil(cx + o); x++) {
      const d = Math.abs(Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2) - r);
      this.px(x, y, c, Math.min(1, Math.max(0, width / 2 + 0.5 - d)) * alpha);
    }
  }

  capsule(ax: number, ay: number, bx: number, by: number, hw: number, c: RGB, alpha = 1) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const x0 = Math.floor(Math.min(ax, bx) - hw - 1), x1 = Math.ceil(Math.max(ax, bx) + hw + 1);
    const y0 = Math.floor(Math.min(ay, by) - hw - 1), y1 = Math.ceil(Math.max(ay, by) + hw + 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const pxx = x + 0.5, pyy = y + 0.5;
      let t = l2 > 0 ? ((pxx - ax) * dx + (pyy - ay) * dy) / l2 : 0;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const d = Math.sqrt((pxx - ax - dx * t) ** 2 + (pyy - ay - dy * t) ** 2);
      this.px(x, y, c, Math.min(1, Math.max(0, hw + 0.5 - d)) * alpha);
    }
  }

  glow(cx: number, cy: number, r: number, c: RGB, a: number) {
    for (let k = 3; k >= 1; k--) this.circle(cx, cy, r * (0.7 + k * 0.45), c, (a * (4 - k)) / 6);
  }

  textWidth(s: string, scale: number) { return s.length * 6 * scale - scale; }

  text(s: string, x: number, y: number, scale: number, c: RGB, alpha = 1) {
    let cx = x;
    for (const ch of s.toUpperCase()) {
      const g = FONT[ch] ?? FONT['?'];
      for (let r = 0; r < 7; r++) for (let q = 0; q < 5; q++) {
        if (g[r] & (1 << (4 - q))) for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) this.px(cx + q * scale + sx, y + r * scale + sy, c, alpha);
      }
      cx += 6 * scale;
    }
  }
  /** largest integer scale (<= maxScale) at which the string fits inside `frac` of the width */
  fitScale(s: string, maxScale: number, frac = 0.92) {
    let k = maxScale;
    while (k > 1 && this.textWidth(s, k) > this.w * frac) k--;
    return k;
  }
  textCentered(s: string, cy: number, scale: number, c: RGB, alpha = 1) {
    scale = this.fitScale(s, scale);
    this.text(s, Math.round((this.w - this.textWidth(s, scale)) / 2), cy, scale, c, alpha);
  }
}
