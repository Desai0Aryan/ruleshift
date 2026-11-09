"""Generates the app icon/splash art (original RULESHIFT mark). Run: python3 scripts/make-icons.py"""
from PIL import Image, ImageDraw, ImageFilter
import math, os

OUT = os.path.join(os.path.dirname(__file__), '..', 'assets')
S = 4  # supersample

def vgrad(size, top, bottom):
    img = Image.new('RGB', (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        d.line([(0, y), (size, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img

def glow(base, xy, r, color, strength=0.55, blur=0.35):
    layer = Image.new('RGBA', base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([xy[0] - r, xy[1] - r, xy[0] + r, xy[1] + r], fill=color + (int(255 * strength),))
    layer = layer.filter(ImageFilter.GaussianBlur(r * blur * 2))
    base.alpha_composite(layer)

def mark(size, bg=None, scale=1.0, mono=False):
    """Draws the mark on a size x size canvas (content scaled about the centre)."""
    W = size * S
    img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    if bg is not None:
        img.paste(bg.resize((W, W), Image.LANCZOS).convert('RGBA'))
    c = W / 2
    u = W * scale / 100  # 100 units across
    P = lambda x, y: (c + (x - 50) * u, c + (y - 50) * u)
    white = (255, 255, 255, 255)
    ball, ring, plank, pink = (61, 165, 255), (255, 213, 74), (215, 220, 255), (255, 122, 217)

    if not mono:
        glow(img, P(66, 70), 15 * u, ring, 0.40)
        glow(img, P(30, 29), 12 * u, ball, 0.55)
    d = ImageDraw.Draw(img)

    # target ring (bottom right)
    cx, cy = P(68, 71)
    for rr, wd, col in ((11.5, 3.2, white if mono else ring), (5.2, 2.2, white if mono else ring)):
        d.ellipse([cx - rr * u, cy - rr * u, cx + rr * u, cy + rr * u], outline=col, width=int(wd * u))

    # plank: rounded capsule, tilted so the ball rolls to the ring
    ang = math.radians(28)
    L, T = 29, 4.6
    px, py = P(44, 51)
    dx, dy = math.cos(ang) * L * u / 2, math.sin(ang) * L * u / 2
    d.line([(px - dx, py - dy), (px + dx, py + dy)], fill=white if mono else plank, width=int(T * 2 * u))
    for sx, sy in ((px - dx, py - dy), (px + dx, py + dy)):
        d.ellipse([sx - T * u, sy - T * u, sx + T * u, sy + T * u], fill=white if mono else plank)

    # ball (top left) with a highlight
    bx, by = P(29, 27)
    br = 8.6 * u
    d.ellipse([bx - br, by - br, bx + br, by + br], fill=white if mono else ball)
    if not mono:
        hr = br * 0.34
        d.ellipse([bx - br * 0.45 - hr, by - br * 0.45 - hr, bx - br * 0.45 + hr, by - br * 0.45 + hr], fill=(190, 225, 255, 255))
        # pink bumper dot: the "shifted rule"
        qx, qy = P(76, 31)
        qr = 5.6 * u
        glow(img, (qx, qy), qr * 1.6, pink, 0.5)
        d = ImageDraw.Draw(img)
        d.ellipse([qx - qr, qy - qr, qx + qr, qy + qr], fill=pink + (255,))
    return img.resize((size, size), Image.LANCZOS)

def save(img, name, flatten=False):
    if flatten:
        bg = Image.new('RGB', img.size, (11, 14, 36)); bg.paste(img, mask=img.split()[3]); img = bg
    img.save(os.path.join(OUT, name), optimize=True)

bg = vgrad(256, (28, 31, 92), (9, 11, 30))
icon = mark(1024, bg=bg, scale=1.12)
save(icon.convert('RGB'), 'icon.png')                       # iOS: opaque, full-bleed
save(mark(1024, scale=0.66), 'android-icon-foreground.png')  # Android adaptive: keep inside the 66% safe zone
save(vgrad(256, (28, 31, 92), (9, 11, 30)).resize((1024, 1024)), 'android-icon-background.png')
save(mark(1024, scale=0.66, mono=True), 'android-icon-monochrome.png')
save(mark(1024, scale=0.8), 'splash-icon.png')
save(mark(96, bg=vgrad(96, (28, 31, 92), (9, 11, 30)), scale=1.0).convert('RGB'), 'favicon.png')
print('ok')
