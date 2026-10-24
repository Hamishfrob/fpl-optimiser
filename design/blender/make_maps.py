"""Seamless pattern maps for the stadium textures: mown grass, steel truss, red seats.
Pattern comes from code (so it certainly repeats), light and shadow come from Blender (render_tiles.py).
Run: python design/blender/make_maps.py      Output: design/blender/maps/*.png (colour 8-bit, height 16-bit)
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "maps")
os.makedirs(OUT, exist_ok=True)


def band_noise(h, w, seed, fx_scale, fy_scale):
    """Periodic noise (wraps at the edges) with separate smoothness in x and y, scaled 0..1."""
    n = np.random.default_rng(seed).standard_normal((h, w))
    f = np.fft.fft2(n)
    fx = np.fft.fftfreq(w)[None, :]
    fy = np.fft.fftfreq(h)[:, None]
    filt = np.exp(-(fx / fx_scale) ** 2 - (fy / fy_scale) ** 2)
    out = np.real(np.fft.ifft2(f * filt))
    return (out - out.min()) / (out.max() - out.min())


def save_colour(name, rgb01):
    Image.fromarray((np.clip(rgb01, 0, 1) * 255).astype(np.uint8)).save(os.path.join(OUT, f"{name}_colour.png"))


def save_height(name, h01):
    Image.fromarray((np.clip(h01, 0, 1) * 65535).astype(np.uint16)).save(os.path.join(OUT, f"{name}_height.png"))


def lerp(a, b, t):
    return a + (b - a) * t[..., None]


# ---------- grass: one light and one dark mown stripe per tile (whole cycle vertically)
def grass(size=512):
    h = w = size
    y = np.arange(h)[:, None] / h
    stripe = 0.5 + 0.5 * np.tanh(5.0 * np.sin(2 * np.pi * y)) * np.ones((1, w))   # soft-edged bands
    streak = band_noise(h, w, 1, 0.20, 0.025)          # long blades-in-a-row streaks along y
    fine = band_noise(h, w, 2, 0.30, 0.30)
    light, dark = np.array([92, 156, 66]) / 255, np.array([48, 104, 44]) / 255
    col = lerp(dark, light, stripe)
    col = col * (0.80 + 0.40 * streak[..., None]) * (0.94 + 0.12 * fine[..., None])
    save_colour("grass", col)
    save_height("grass", 0.55 * streak + 0.45 * fine)


# ---------- steel truss: a diagonal X in every bay, chords top and bottom, rivets at the crossings
def steel(w=512, h=256):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    ang = np.arctan2(h, w)

    def dist_diag(sign):
        # distance to the family of lines y = sign*(h/w)*x + k*h, wrap-aware
        v = (yy - sign * (h / w) * xx) % h
        v = np.minimum(v, h - v)
        return v * np.cos(ang)

    bar_w = 13.0
    d = np.minimum(dist_diag(1), dist_diag(-1))
    chord = np.minimum(yy % h, h - (yy % h))            # chords at the tile's top and bottom edge
    d = np.minimum(d, chord * 0.62)                     # chord drawn a little thicker than the braces
    bar = np.clip(1 - (d - bar_w * 0.35) / (bar_w * 0.65), 0, 1)
    bar = bar * bar * (3 - 2 * bar)                     # rounded profile
    brush = band_noise(h, w, 3, 0.012, 0.22)           # brushed along x
    grain = band_noise(h, w, 4, 0.35, 0.35)
    rivet = np.zeros((h, w))
    for cx, cy in [(0, 0), (w, 0), (0, h), (w, h), (w / 2, h / 2)]:
        for ox in (-w, 0, w):
            for oy in (-h, 0, h):
                r = np.hypot(xx - (cx + ox), yy - (cy + oy))
                rivet = np.maximum(rivet, np.clip(1 - (r - 9) / 5, 0, 1))
    plate = np.array([58, 70, 88]) / 255
    metal = np.array([172, 182, 196]) / 255
    col = lerp(plate, metal, np.clip(bar + 0.55 * rivet, 0, 1))
    col = col * (0.86 + 0.20 * brush[..., None]) * (0.96 + 0.08 * grain[..., None])
    save_colour("steel", col)
    save_height("steel", np.clip(0.18 * brush + 0.62 * bar + 0.5 * rivet + 0.04 * grain, 0, 1))


# ---------- seats: 4 x 4 red moulded seats, backrest and fold-up base, gaps between
def seats(size=512, n=4):
    h = w = size
    cell = size // n
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    u = (xx % cell) / cell
    v = (yy % cell) / cell

    def rounded(u0, u1, v0, v1, r):
        cx, cy = (u0 + u1) / 2, (v0 + v1) / 2
        qx, qy = np.abs(u - cx) - (u1 - u0) / 2 + r, np.abs(v - cy) - (v1 - v0) / 2 + r
        sd = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
        return np.clip(-sd / 0.07, 0, 1)                # 0 outside, rising to 1 well inside

    back = rounded(0.20, 0.80, 0.04, 0.64, 0.14)
    base = rounded(0.14, 0.86, 0.69, 0.91, 0.10)
    height = 0.80 * np.sqrt(back) + 0.55 * np.sqrt(base)
    ci, cj = (xx // cell).astype(int), (yy // cell).astype(int)
    r = np.random.default_rng(5)
    tint = r.uniform(0.90, 1.08, (n, n))[cj, ci]
    red = np.array([176, 24, 34]) / 255
    gap = np.array([10, 4, 6]) / 255
    mask = np.clip(back + base, 0, 1)
    col = lerp(gap, red, mask) * np.where(mask > 0, tint, 1)[..., None]
    col = col * (0.96 + 0.08 * band_noise(h, w, 6, 0.3, 0.3)[..., None])
    save_colour("seats", col)
    save_height("seats", np.clip(height, 0, 1))


if __name__ == "__main__":
    grass(); steel(); seats()
    print("maps written to", OUT)
