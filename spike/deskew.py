#!/usr/bin/env python3
"""C4f deskew experiment: estimate the tilt of a label photo and straighten it.

Projection-profile method: binarise a small copy, rotate it through a range of
angles and keep the angle where the row sums are most "peaky" (text lines line
up, so rows are either full of ink or empty). No OCR pass, so it adds
milliseconds on the VPS instead of the ~50 s a second OCR pass costs on the
phone. Used by deskew_eval.mjs to see whether straightening helps OCR at all.

    python3 deskew.py <in.jpg> <out.jpg>     # prints the angle in degrees
    python3 deskew.py --estimate-only <in.jpg>
"""
import sys
import time

import numpy as np
from PIL import Image

MAX_ANGLE = 12.0
COARSE_STEP = 1.0
FINE_STEP = 0.25
WORK_SIDE = 400  # estimate on a small copy: it is cheap and tilt survives shrinking


def _ink(img):
    """Dark-text mask: pixels clearly darker than their neighbourhood-wide mean."""
    g = np.asarray(img.convert("L"), dtype=np.float32)
    # Local threshold via a coarse box blur (uneven lighting is the norm in photos).
    small = Image.fromarray(g.astype(np.uint8)).resize((max(4, g.shape[1] // 16), max(4, g.shape[0] // 16)), Image.BILINEAR)
    bg = np.asarray(small.resize((g.shape[1], g.shape[0]), Image.BILINEAR), dtype=np.float32)
    return ((bg - g) > 25).astype(np.float32)


def _score(mask_img, angle):
    rot = mask_img.rotate(angle, Image.BILINEAR, expand=False, fillcolor=0)
    rows = np.asarray(rot, dtype=np.float32).sum(axis=1)
    return float(np.sum(np.diff(rows) ** 2))


def estimate_angle(img):
    scale = WORK_SIDE / max(img.size)
    small = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.BILINEAR)
    mask = Image.fromarray((_ink(small) * 255).astype(np.uint8))
    coarse = np.arange(-MAX_ANGLE, MAX_ANGLE + 1e-6, COARSE_STEP)
    best = max(coarse, key=lambda a: _score(mask, a))
    fine = np.arange(best - COARSE_STEP, best + COARSE_STEP + 1e-6, FINE_STEP)
    return float(max(fine, key=lambda a: _score(mask, a)))


def deskew(img, angle):
    # Fill the corners with the photo's own edge colour so CRAFT sees no hard border.
    edge = np.asarray(img.convert("RGB"))[[0, -1], :, :].reshape(-1, 3).mean(axis=0)
    return img.rotate(angle, Image.BICUBIC, expand=False, fillcolor=tuple(int(c) for c in edge))


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--estimate-only":
        t0 = time.time()
        a = estimate_angle(Image.open(args[1]))
        print(f"{a:.2f} {int((time.time() - t0) * 1000)}ms")
    else:
        src, dst = args
        im = Image.open(src)
        t0 = time.time()
        a = estimate_angle(im)
        ms = int((time.time() - t0) * 1000)
        deskew(im, a).save(dst, quality=90)
        print(f"{a:.2f} {ms}ms")
