"""Adds marketing captions around the raw draft screenshots -> docs/appstore/screenshots/*.png (1290x2796, 6.9in iPhone)."""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os, glob
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, '..', 'docs', 'appstore', 'screenshots', 'raw')
OUT = os.path.join(HERE, '..', 'docs', 'appstore', 'screenshots')
FONT = next((p for p in glob.glob('/usr/share/fonts/**/*Bold.ttf', recursive=True) if 'DejaVuSans-Bold' in p or 'LiberationSans-Bold' in p), None)
SHOTS = [
  ('1-home.png', 'Solve it.\nChange it.\nPass it on.', True),
  ('2-build.png', 'Tiny physics puzzles.\nSolved in seconds.', False),
  ('3-roll.png', 'Instant retry.\nSatisfying every time.', False),
  ('4-twist.png', 'Now twist ONE rule\nfor your friend.', False),
  ('5-send.png', 'Send it.\nWatch it evolve.', False),
]
W, H = 1290, 2796
def grad():
    im = Image.new('RGB', (W, H)); d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        d.line([(0, y), (W, y)], fill=(int(40 - 25 * t), int(36 - 22 * t), int(110 - 70 * t)))
    return im
for name, cap, cover_footer in SHOTS:
    raw = Image.open(os.path.join(RAW, name)).convert('RGB')
    if cover_footer:  # remove the dev-only footer line from the browser preview
        d = ImageDraw.Draw(raw); d.rectangle([0, raw.height - 190, raw.width, raw.height], fill=(18, 21, 60))
    canvas = grad()
    d = ImageDraw.Draw(canvas)
    f = ImageFont.truetype(FONT, 118)
    y = 150
    for line in cap.split('\n'):
        w = d.textlength(line, font=f)
        d.text(((W - w) / 2, y), line, font=f, fill=(255, 255, 255))
        y += 140
    sw = 1060; sh = int(raw.height * sw / raw.width)
    shot = raw.resize((sw, sh), Image.LANCZOS)
    mask = Image.new('L', shot.size, 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, sw, sh + 200], radius=90, fill=255)
    x, top = (W - sw) // 2, 150 + 140 * len(cap.split('\n')) + 80
    sh_img = Image.new('RGBA', canvas.size, (0, 0, 0, 0)); ImageDraw.Draw(sh_img).rounded_rectangle([x, top, x + sw, top + sh + 200], radius=90, fill=(0, 0, 0, 150))
    canvas.paste(Image.alpha_composite(canvas.convert('RGBA'), sh_img.filter(ImageFilter.GaussianBlur(30))).convert('RGB'))
    ImageDraw.Draw(canvas).rounded_rectangle([x - 6, top - 6, x + sw + 6, top + sh + 206], radius=96, outline=(108, 123, 255), width=6)
    canvas.paste(shot, (x, top), mask)
    canvas.save(os.path.join(OUT, name.replace('.png', '-captioned.png').split('-', 1)[0] + '-' + name.split('-', 1)[1].replace('.png', '') + '.png'))
print('done')
