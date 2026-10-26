#!/usr/bin/env python3
"""Make two extra preprocessings of each synthetic handwriting image, for the
"second EasyOCR reader" variant of the handwriting spike.

  data/hand_var/crop/  tight crop around the ink + 25% margin, autocontrast
  data/hand_var/bin/   greyscale, autocontrast, sharpen, hard threshold, padded

Generated, not committed (see spike/.gitignore).
"""
import os

import numpy as np
from PIL import Image, ImageFilter, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "data", "hand")


def ink_bbox(grey):
    a = np.asarray(grey, dtype=np.float32)
    thr = a.mean() - 1.0 * a.std()
    ys, xs = np.where(a < thr)
    if len(xs) == 0:
        return (0, 0, grey.width, grey.height)
    return (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)


def make_crop(img):
    g = ImageOps.autocontrast(img.convert("L"))
    x0, y0, x1, y1 = ink_bbox(g)
    mw, mh = int((x1 - x0) * 0.25), int((y1 - y0) * 0.25)
    box = (max(0, x0 - mw), max(0, y0 - mh), min(g.width, x1 + mw), min(g.height, y1 + mh))
    return g.crop(box).convert("RGB")


def make_bin(img):
    g = ImageOps.autocontrast(img.convert("L"), cutoff=2)
    g = g.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=2))
    a = np.asarray(g, dtype=np.float32)
    thr = a.mean() - 0.6 * a.std()
    b = Image.fromarray(((a > thr) * 255).astype(np.uint8))
    b = ImageOps.expand(b, border=40, fill=255)
    return b.convert("RGB")


def main():
    for name, fn in (("crop", make_crop), ("bin", make_bin)):
        out = os.path.join(HERE, "data", "hand_var", name)
        os.makedirs(out, exist_ok=True)
        for f in sorted(os.listdir(SRC)):
            if f.endswith(".jpg"):
                fn(Image.open(os.path.join(SRC, f))).save(os.path.join(out, f), quality=95)
        print(name, len(os.listdir(out)))


if __name__ == "__main__":
    main()
