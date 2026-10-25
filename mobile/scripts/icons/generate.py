#!/usr/bin/env python3
"""Draws the Soma Nami app icon at every size the app needs.

A yellow and white capsule with sound waves coming off it, on deep blue: "your
medicine, read aloud". Yellow is the theme primary (src/theme/tokens.ts). No
words or fine detail, so it reads at 40 px and for someone with low vision.

Run from mobile/: python3 scripts/icons/generate.py (needs Pillow).
Writes to assets/: icon.png (iOS and stores), adaptive-icon.png and
adaptive-icon-background.png (Android), adaptive-icon-monochrome.png
(Android 13 themed icons), splash-icon.png and favicon.png (web).
"""
from math import cos, radians, sin
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ASSETS = Path(__file__).resolve().parents[2] / "assets"
S = 2048  # working size; everything is drawn here and scaled down

YELLOW = (255, 214, 10)  # theme primary #FFD60A
GOLD = (255, 186, 0)
YELLOW_LIGHT = (255, 230, 80)
WHITE = (255, 255, 255)
WHITE_SHADE = (220, 226, 236)
SEAM = (150, 150, 160)
BLUE_CENTRE = (24, 46, 84)
BLUE_EDGE = (6, 12, 26)

CAPSULE = (300, 820, 1380, 1230)  # before rotation
TILT = 28  # degrees, rising to the right
WAVES = dict(cx=1240, cy=860, radii=(230, 370, 510), width=78, span=32, start=-28)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def gradient(fn, size=S):
    """A full-size RGBA image whose colour at (u, v) in 0..1 is fn(u, v). Computed small, scaled up."""
    small = 256
    img = Image.new("RGB", (small, small))
    px = img.load()
    for y in range(small):
        for x in range(small):
            px[x, y] = fn(x / small, y / small)
    return img.resize((size, size), Image.BICUBIC).convert("RGBA")


def vertical(top, bottom):
    return gradient(lambda u, v: lerp(top, bottom, v))


def background(size=S):
    """Deep blue, lighter towards the upper middle."""
    def fn(u, v):
        d = ((u - 0.5) ** 2 + (v - 0.35) ** 2) ** 0.5 / 0.85
        return lerp(BLUE_CENTRE, BLUE_EDGE, min(1, d))
    return gradient(fn, size)


def mask():
    return Image.new("L", (S, S), 0)


def paint(base, m, colour_or_image):
    layer = colour_or_image if isinstance(colour_or_image, Image.Image) else Image.new("RGBA", (S, S), colour_or_image + (255,))
    layer = layer.copy()
    layer.putalpha(ImageChops.multiply(layer.split()[3], m))
    base.alpha_composite(layer)


def soft(base, m, colour, blur, opacity, offset=(0, 0)):
    """A blurred copy of a shape: a drop shadow (black) or a glow (colour)."""
    a = m.point(lambda v: v * opacity // 255).filter(ImageFilter.GaussianBlur(blur))
    if offset != (0, 0):
        a = ImageChops.offset(a, *offset)
    layer = Image.new("RGBA", (S, S), colour + (0,))
    layer.putalpha(a)
    base.alpha_composite(layer)


def capsule_masks():
    """Returns (yellow half, white half, seam, whole), all rotated into place."""
    x1, y1, x2, y2 = CAPSULE
    mid = (x1 + x2) // 2
    whole = mask()
    ImageDraw.Draw(whole).rounded_rectangle(CAPSULE, radius=(y2 - y1) // 2, fill=255)
    right = mask()
    ImageDraw.Draw(right).rectangle([mid, 0, S, S], fill=255)
    white = ImageChops.multiply(right, whole)
    yellow = ImageChops.subtract(whole, white)
    seam = mask()
    ImageDraw.Draw(seam).rectangle([mid - 6, y1, mid + 6, y2], fill=255)
    seam = ImageChops.multiply(seam, whole)
    centre = ((x1 + x2) / 2, (y1 + y2) / 2)
    return [m.rotate(TILT, resample=Image.BICUBIC, center=centre) for m in (yellow, white, seam, whole)]


def waves_mask():
    m = mask()
    d = ImageDraw.Draw(m)
    w = WAVES
    half = w["width"] / 2
    for r in w["radii"]:
        angles = [radians(w["start"] - w["span"] + 2 * w["span"] * i / 96) for i in range(97)]
        outer = [(w["cx"] + (r + half) * cos(a), w["cy"] + (r + half) * sin(a)) for a in angles]
        inner = [(w["cx"] + (r - half) * cos(a), w["cy"] + (r - half) * sin(a)) for a in reversed(angles)]
        d.polygon(outer + inner, fill=255)
        for a in (angles[0], angles[-1]):
            x, y = w["cx"] + r * cos(a), w["cy"] + r * sin(a)
            d.ellipse([x - half, y - half, x + half, y + half], fill=255)
    return m


def highlight(m, strength):
    """White fading out from the top of a shape: the capsule's shine."""
    hl = Image.new("RGBA", (S, S), WHITE + (0,))
    ramp = vertical((255, 255, 255), (0, 0, 0)).convert("L").point(lambda v: max(0, v - 128) * strength // 128)
    hl.putalpha(ImageChops.multiply(ramp, m))
    return hl


def symbol(shadows=True):
    """The capsule and waves on transparent, in full colour."""
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    yellow, white, seam, whole = capsule_masks()
    waves = waves_mask()
    if shadows:
        soft(img, whole, (0, 0, 0), 50, 170, offset=(0, 40))
    paint(img, yellow, vertical(YELLOW_LIGHT, GOLD))
    paint(img, white, vertical(WHITE, WHITE_SHADE))
    img.alpha_composite(highlight(whole, 110))
    paint(img, seam, SEAM)
    if shadows:
        soft(img, waves, YELLOW, 50, 120)
    paint(img, waves, YELLOW)
    return img


def symbol_mono():
    """One colour on transparent for themed icons; the seam is cut out so the two halves still show."""
    yellow, white, seam, whole = capsule_masks()
    shape = ImageChops.add(whole, waves_mask())
    shape = ImageChops.subtract(shape, seam.filter(ImageFilter.MaxFilter(9)))
    img = Image.new("RGBA", (S, S), WHITE + (0,))
    img.putalpha(shape)
    return img


def place(sym, width, canvas=S):
    """Scales the symbol to `width` (on an S-sized canvas) and centres it by its visible shape."""
    x1, y1, x2, y2 = sym.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
    scale = width / (x2 - x1)
    # Move the visible shape's centre to the canvas centre. The whole layer is
    # kept, so the faint edges of the glow and shadow aren't cut off.
    big = sym.resize((round(S * scale), round(S * scale)), Image.LANCZOS)
    cx, cy = (x1 + x2) / 2 * scale, (y1 + y2) / 2 * scale
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(big, (round(canvas / 2 - cx), round(canvas / 2 - cy)))
    return out


def save(img, name, size, opaque=False):
    img = img.resize((size, size), Image.LANCZOS)
    if opaque:
        img = img.convert("RGB")  # iOS rejects an app icon with an alpha channel
    img.save(ASSETS / name, optimize=True)
    print(f"{name} {size}x{size}")


def main():
    colour = symbol()
    full = background()
    full.alpha_composite(place(colour, 1560))
    # iOS and the stores: full bleed and opaque. iOS rounds the corners itself.
    save(full, "icon.png", 1024, opaque=True)
    # Android adaptive: the launcher masks the centre 66%, so the symbol stays well inside it.
    save(background(), "adaptive-icon-background.png", 1024, opaque=True)
    save(place(colour, 1120), "adaptive-icon.png", 1024)
    # Android 13+ themed icons: the launcher tints this one colour.
    save(place(symbol_mono(), 1120), "adaptive-icon-monochrome.png", 1024)
    # Splash: on the app's near-black splash background (app.json), leading into the first screen.
    save(place(colour, 1300), "splash-icon.png", 1024)
    # Web favicon: the full icon, symbol a little larger so it holds up at 48 px.
    fav = background()
    fav.alpha_composite(place(colour, 1760))
    save(fav, "favicon.png", 48, opaque=True)


if __name__ == "__main__":
    main()
