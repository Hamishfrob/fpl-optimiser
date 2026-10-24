"""Turn the Blender renders into small WebP tiles for the page, and check the seams with numbers.
Run: python design/blender/finish_tiles.py     Output: web/img/*.webp
"""
import os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC, DST = os.path.join(HERE, "renders"), os.path.join(HERE, "..", "..", "web", "img")
os.makedirs(DST, exist_ok=True)
total = 0
for name in ("grass", "steel", "seats"):
    im = Image.open(os.path.join(SRC, f"{name}.png")).convert("RGB")
    a = np.asarray(im).astype(float)
    print(f"{name} {im.size}: seam col {np.abs(a[:, 0] - a[:, -1]).mean():.1f} vs neighbour {np.abs(a[:, 0] - a[:, 1]).mean():.1f}; "
          f"seam row {np.abs(a[0] - a[-1]).mean():.1f} vs neighbour {np.abs(a[0] - a[1]).mean():.1f}")
    if name == "seats":  # gaps between seats catch reflected light and come out grey: darken everything that is not red
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        m = np.clip((r - 0.5 * (g + b) - 8) / 45, 0, 1)
        a = a * (0.28 + 0.72 * m)[..., None]
        im = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    path = os.path.join(DST, f"{name}.webp")
    im.save(path, "WEBP", quality=80, method=6)
    total += os.path.getsize(path)
    print(f"  -> {os.path.getsize(path) / 1024:.0f} KB")
print(f"total {total / 1024:.0f} KB")
