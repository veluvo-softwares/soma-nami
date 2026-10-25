#!/usr/bin/env python3
"""Draws the Soma Nami app icon at every size the app needs.

The symbol is a medicine label (pharmacy cross and two lines of text) with
sound waves coming off it: "this label, read aloud". Yellow on near-black,
the app's own primary and background (src/theme/tokens.ts), so it is the
highest-contrast pair we have and matches the first screen. No words: it has
to work for someone who can't read small print, down to a 48 px favicon.

Run from mobile/: python3 scripts/icons/generate.py (needs Pillow).
Writes assets/icon.png, adaptive-icon.png, adaptive-icon-monochrome.png,
splash-icon.png and favicon.png.
"""
from math import cos, radians, sin
from pathlib import Path

from PIL import Image, ImageDraw

YELLOW = (255, 214, 10, 255)  # theme primary #FFD60A
BLACK = (14, 14, 14, 255)  # theme background #0E0E0E
WHITE = (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

SUPERSAMPLE = 4
ASSETS = Path(__file__).resolve().parents[2] / "assets"

# The symbol in its own units: label 0..450 wide, waves to the right.
LABEL = (0, 0, 450, 424)
LABEL_RADIUS = 60
WAVE_CENTER = (470, 212)
WAVE_RADII = (110, 200, 290)
WAVE_WIDTH = 54
WAVE_SPAN = 42  # degrees above and below the horizontal
SYMBOL_W = WAVE_CENTER[0] + WAVE_RADII[-1] + WAVE_WIDTH / 2
SYMBOL_H = LABEL[3]


def draw_symbol(img, width, fg, cutout):
    """Draws the symbol centred in `img`, `width` px wide. `cutout` is the colour of the marks on the label."""
    d = ImageDraw.Draw(img)
    s = width / SYMBOL_W
    ox = (img.width - SYMBOL_W * s) / 2
    oy = (img.height - SYMBOL_H * s) / 2

    def p(x, y):
        return ox + x * s, oy + y * s

    def rect(x1, y1, x2, y2, r, fill):
        d.rounded_rectangle([*p(x1, y1), *p(x2, y2)], radius=r * s, fill=fill)

    rect(*LABEL, LABEL_RADIUS, fg)
    # Pharmacy cross, top left of the label.
    cx, cy, arm, bar = 120, 125, 62, 44
    rect(cx - arm, cy - bar / 2, cx + arm, cy + bar / 2, 8, cutout)
    rect(cx - bar / 2, cy - arm, cx + bar / 2, cy + arm, 8, cutout)
    # Two lines of label text.
    rect(58, 252, 392, 296, 22, cutout)
    rect(58, 330, 300, 374, 22, cutout)

    # Sound waves: each is a filled ring segment with round ends. A thick
    # polyline leaves gaps at its joins on the tight inner arc.
    wx, wy = WAVE_CENTER
    half = WAVE_WIDTH / 2
    for r in WAVE_RADII:
        steps = 96
        angles = [radians(-WAVE_SPAN + 2 * WAVE_SPAN * i / steps) for i in range(steps + 1)]
        outer = [p(wx + (r + half) * cos(a), wy + (r + half) * sin(a)) for a in angles]
        inner = [p(wx + (r - half) * cos(a), wy + (r - half) * sin(a)) for a in reversed(angles)]
        d.polygon(outer + inner, fill=fg)
        for a in (angles[0], angles[-1]):
            x, y = p(wx + r * cos(a), wy + r * sin(a))
            d.ellipse([x - half * s, y - half * s, x + half * s, y + half * s], fill=fg)


def render(size, background, symbol_width, fg=YELLOW, cutout=BLACK):
    big = size * SUPERSAMPLE
    img = Image.new("RGBA", (big, big), background)
    draw_symbol(img, symbol_width * SUPERSAMPLE, fg, cutout)
    return img.resize((size, size), Image.LANCZOS)


def save(img, name, opaque=False):
    if opaque:
        img = img.convert("RGB")  # iOS rejects an app icon with an alpha channel
    img.save(ASSETS / name, optimize=True)
    print(f"{name} {img.size[0]}x{img.size[1]}")


def main():
    # iOS and the store: full bleed, no transparency. iOS rounds the corners itself.
    save(render(1024, BLACK, 780), "icon.png", opaque=True)
    # Android adaptive foreground: only the centre 66% is safe from launcher masks.
    save(render(1024, CLEAR, 560), "adaptive-icon.png")
    # Android 13+ themed icons: one colour on transparent; the launcher tints it.
    # The marks on the label are cut out so they survive tinting.
    save(render(1024, CLEAR, 560, fg=WHITE, cutout=CLEAR), "adaptive-icon-monochrome.png")
    # Splash: the symbol alone on the splash background colour (app.json).
    save(render(1024, CLEAR, 640), "splash-icon.png")
    # Web: small, so the symbol fills more of the square.
    save(render(48, BLACK, 42), "favicon.png", opaque=True)


if __name__ == "__main__":
    main()
