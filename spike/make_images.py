#!/usr/bin/env python3
"""Generate synthetic test images for the C2 OCR spike.

All content is invented: generic medicine names, fake company, fake batch
numbers, no people's names. Two sets:

  data/print/   printed packaging faces, each as a clean render and as a
                "phone photo" (perspective, shading, blur, noise, JPEG).
  data/hand/    handwriting-style dosing labels ("1x3", "2 bd" ...) drawn with
                OFL/Apache handwriting fonts plus per-glyph jitter, as photos.

Ground truth goes to data/truth.json. Deterministic (fixed seed).

Handwriting fonts are downloaded from github.com/google/fonts into
data/fonts/ (not committed). Real handwriting still has to be tested with a
phone photo; fonts are a stand-in.
"""
import json
import os
import random
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
FONTS = os.path.join(DATA, "fonts")
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANS_B = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SERIF = "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"
NARROW = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
NARROW_B = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"

HAND_FONTS = {
    # file name: google/fonts path (licence)
    "IndieFlower-Regular.ttf": "ofl/indieflower/IndieFlower-Regular.ttf",
    "ReenieBeanie.ttf": "ofl/reeniebeanie/ReenieBeanie.ttf",
    "ShadowsIntoLight.ttf": "ofl/shadowsintolight/ShadowsIntoLight.ttf",
    "HomemadeApple-Regular.ttf": "apache/homemadeapple/HomemadeApple-Regular.ttf",
}

rng = random.Random(42)
nrng = np.random.default_rng(42)

# ---------------------------------------------------------------------------
# Printed packaging. Each line: (text, size, bold). Dose lines are the ones the
# app must never misread.
PACKS = [
    {
        "id": "p1_paracetamol",
        "bg": (255, 255, 255), "accent": (0, 90, 170),
        "lines": [
            ("PARACETAMOL", 64, True),
            ("Tablets BP 500 mg", 40, False),
            ("100 Tablets", 34, True),
            ("Dosage: Adults and children over 12 years:", 26, False),
            ("1 to 2 tablets every 4 to 6 hours.", 26, False),
            ("Do not take more than 8 tablets in 24 hours.", 26, False),
            ("Store below 30°C. Keep out of reach of children.", 24, False),
            ("Batch No: PX2417  Exp: 08/2028", 24, False),
            ("Manufactured by: Generic Pharma Ltd", 22, False),
        ],
    },
    {
        "id": "p2_amoxicillin",
        "bg": (250, 248, 240), "accent": (180, 30, 30),
        "lines": [
            ("AMOXICILLIN", 60, True),
            ("Capsules BP 250 mg", 38, False),
            ("21 Capsules", 32, True),
            ("Take one capsule three times a day", 28, False),
            ("for 7 days, or as directed by the prescriber.", 26, False),
            ("Complete the full course.", 26, False),
            ("Prescription only medicine.", 24, False),
            ("Batch: AM0391  Mfg: 03/2026  Exp: 02/2028", 22, False),
        ],
    },
    {
        "id": "p3_metformin",
        "bg": (235, 245, 255), "accent": (20, 110, 60),
        "lines": [
            ("Metformin Hydrochloride", 50, True),
            ("Tablets 500 mg", 38, False),
            ("28 film-coated tablets", 30, False),
            ("Take 1 tablet twice daily with meals.", 28, False),
            ("Swallow whole with water.", 26, False),
            ("Read the leaflet before use.", 26, False),
            ("Batch No: MF5520  Exp: 11/2027", 24, False),
        ],
    },
    {
        "id": "p4_ors_sw",
        "bg": (255, 252, 230), "accent": (200, 100, 0),
        "lines": [
            ("ORAL REHYDRATION SALTS", 46, True),
            ("Chumvi ya Kurejesha Maji Mwilini", 32, False),
            ("Dissolve one sachet in 1 litre of clean water.", 26, False),
            ("Yeyusha pakiti moja katika lita 1 ya maji safi.", 26, False),
            ("Use within 24 hours.", 26, False),
            ("Tumia ndani ya saa 24.", 26, False),
            ("Batch: OR8812  Exp: 05/2028", 24, False),
        ],
    },
    {
        "id": "p5_ibuprofen_small",
        "bg": (255, 255, 255), "accent": (120, 0, 120),
        "lines": [
            ("IBUPROFEN 200 mg", 44, True),
            ("24 Tablets", 30, True),
            ("Adults: 1 or 2 tablets up to 3 times a day.", 20, False),
            ("Take with or after food.", 20, False),
            ("Leave at least 4 hours between doses.", 20, False),
            ("Do not exceed 6 tablets in 24 hours.", 20, False),
            ("Not for children under 12.", 20, False),
            ("Batch IB7734 Exp 01/2028", 18, False),
        ],
    },
]

HAND = [
    {"id": "h1_1x3", "lines": ["1x3"]},
    {"id": "h2_2bd", "lines": ["2 bd"]},
    {"id": "h3_1x3_5days", "lines": ["1 x 3", "x 5 days"]},
    {"id": "h4_2bd_7days", "lines": ["2 bd x 7/7"]},
    {"id": "h5_tds", "lines": ["Tab 1 tds", "after food"]},
    {"id": "h6_nocte", "lines": ["1 nocte"]},
]


def font(path, size):
    return ImageFont.truetype(path, size)


def render_pack(pack):
    w = 1000
    pad = 50
    fonts = []
    y = pad + 20
    for text, size, bold in pack["lines"]:
        f = font(SANS_B if bold else SANS, size)
        fonts.append((text, f, y))
        y += int(size * 1.45)
    h = y + pad
    img = Image.new("RGB", (w, h), pack["bg"])
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, w, 14], fill=pack["accent"])
    d.rectangle([0, h - 14, w, h], fill=pack["accent"])
    for i, (text, f, y) in enumerate(fonts):
        colour = pack["accent"] if i == 0 else (20, 20, 20)
        d.text((pad, y), text, font=f, fill=colour)
    return img


def perspective_coeffs(src, dst):
    a = []
    b = []
    for (x, y), (u, v) in zip(dst, src):
        a.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        a.append([0, 0, 0, x, y, 1, -v * x, -v * y])
        b += [u, v]
    return np.linalg.solve(np.array(a, float), np.array(b, float)).tolist()


def photoize(img, strength=1.0, seed=0):
    """Make a clean render look like a hand-held phone photo."""
    r = random.Random(seed)
    w, h = img.size
    # place on a table-ish background with margin
    m = int(0.12 * max(w, h))
    bg_col = tuple(int(c) for c in (r.randint(90, 140), r.randint(70, 110), r.randint(50, 80)))
    canvas = Image.new("RGB", (w + 2 * m, h + 2 * m), bg_col)
    canvas.paste(img, (m, m))
    W, H = canvas.size
    # perspective: jitter the four corners of the card
    j = int(0.05 * w * strength)
    src = [(m, m), (m + w, m), (m + w, m + h), (m, m + h)]
    dst = [(x + r.randint(-j, j), y + r.randint(-j, j)) for x, y in src]
    canvas = canvas.transform((W, H), Image.PERSPECTIVE, perspective_coeffs(src, dst), Image.BICUBIC, fillcolor=bg_col)
    canvas = canvas.rotate(r.uniform(-4, 4) * strength, Image.BICUBIC, expand=False, fillcolor=bg_col)
    arr = np.asarray(canvas).astype(np.float32)
    # uneven lighting: linear gradient + soft vignette
    yy, xx = np.mgrid[0:H, 0:W]
    gx = r.uniform(-0.25, 0.25) * strength
    gy = r.uniform(-0.25, 0.25) * strength
    light = 1.0 + gx * (xx / W - 0.5) + gy * (yy / H - 0.5)
    vig = 1.0 - 0.25 * strength * (((xx - W / 2) / W) ** 2 + ((yy - H / 2) / H) ** 2) * 2
    arr *= (light * vig)[..., None]
    # warm colour cast
    arr *= np.array([1.03, 1.0, 0.94])
    # sensor noise
    arr += nrng.normal(0, 6 * strength, arr.shape)
    arr = np.clip(arr, 0, 255).astype(np.uint8)
    out = Image.fromarray(arr)
    out = out.filter(ImageFilter.GaussianBlur(radius=0.8 * strength))
    # downscale like a phone crop, then JPEG round-trip
    scale = 0.85
    out = out.resize((int(W * scale), int(H * scale)), Image.BILINEAR)
    return out


def ensure_hand_fonts():
    os.makedirs(FONTS, exist_ok=True)
    for name, path in HAND_FONTS.items():
        dest = os.path.join(FONTS, name)
        if not os.path.exists(dest):
            url = "https://github.com/google/fonts/raw/main/" + path
            urllib.request.urlretrieve(url, dest)


def render_hand(lines, font_name, seed):
    r = random.Random(seed)
    f = font(os.path.join(FONTS, font_name), 120)
    w, h = 900, 240 + 170 * (len(lines) - 1)
    paper = Image.new("RGB", (w, h), (238, 230, 205))  # brown-ish envelope
    d = ImageDraw.Draw(paper)
    # faint printed envelope box like a pharmacy dispensing bag
    d.rectangle([20, 20, w - 20, h - 20], outline=(150, 140, 120), width=2)
    ink = r.choice([(20, 40, 140), (25, 25, 30), (10, 60, 120)])
    y = 50
    for line in lines:
        x = 60 + r.randint(0, 40)
        for ch in line:
            g = Image.new("RGBA", (180, 220), (0, 0, 0, 0))
            ImageDraw.Draw(g).text((30, 20), ch, font=f, fill=ink + (255,))
            g = g.rotate(r.uniform(-9, 9), Image.BICUBIC)
            paper.paste(g, (x - 30, y - 20 + r.randint(-8, 8)), g)
            adv = f.getlength(ch)
            x += int(adv * r.uniform(0.92, 1.12)) + (r.randint(4, 14) if ch == " " else 0)
        y += 170
    return paper


def main():
    os.makedirs(os.path.join(DATA, "print"), exist_ok=True)
    os.makedirs(os.path.join(DATA, "hand"), exist_ok=True)
    truth = {"print": {}, "hand": {}}
    for i, pack in enumerate(PACKS):
        clean = render_pack(pack)
        clean.save(os.path.join(DATA, "print", f"{pack['id']}_clean.png"))
        photo = photoize(clean, 1.0, seed=100 + i)
        photo.save(os.path.join(DATA, "print", f"{pack['id']}_photo.jpg"), quality=78)
        hard = photoize(clean, 1.8, seed=200 + i)
        hard.save(os.path.join(DATA, "print", f"{pack['id']}_hard.jpg"), quality=65)
        truth["print"][pack["id"]] = [t for t, _, _ in pack["lines"]]
    ensure_hand_fonts()
    names = list(HAND_FONTS)
    for i, item in enumerate(HAND):
        for k, fname in enumerate(names):
            img = render_hand(item["lines"], fname, seed=300 + 10 * i + k)
            img = photoize(img, 0.8, seed=400 + 10 * i + k)
            tag = fname.split("-")[0].split(".")[0].lower()
            img.save(os.path.join(DATA, "hand", f"{item['id']}_{tag}.jpg"), quality=80)
        truth["hand"][item["id"]] = item["lines"]
    with open(os.path.join(DATA, "truth.json"), "w") as fh:
        json.dump(truth, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print("wrote", sum(len(v) for v in truth["print"].values()), "print lines,",
          len(HAND) * len(names), "handwriting images")


if __name__ == "__main__":
    main()
