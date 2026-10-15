"""Draws the textures of the nature themes (Wood, Stone, Forest, Cork) into public/textures/.

Each texture is made here from noise, so nothing is downloaded, and tiles without a seam: the
noise is periodic (shaped in the frequency domain) and every drawn shape wraps around the edges.
The site's content policy keeps out images written into the CSS, so the app loads these files
from its own origin.

    python3 scripts/nature-textures.py          # needs numpy and Pillow
"""

from __future__ import annotations

import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "textures")


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def spectral(h: int, w: int, seed: int, shape) -> np.ndarray:
    """Periodic noise of size h×w whose spectrum is `shape(kx, ky)` (cycles per tile), std 1."""
    white = rng(seed).normal(size=(h, w))
    ky = np.fft.fftfreq(h) * h
    kx = np.fft.fftfreq(w) * w
    KX, KY = np.meshgrid(kx, ky)
    filt = shape(np.abs(KX), np.abs(KY))
    filt[0, 0] = 0
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * filt))
    return out / (out.std() + 1e-9)


def fbm(h: int, w: int, seed: int, beta: float, kmin: float = 1.0, kmax: float = 1e9):
    """Fractal noise: power falls as 1/k^beta between kmin and kmax cycles per tile."""

    def shape(kx, ky):
        k = np.sqrt(kx**2 + ky**2)
        k[0, 0] = 1
        return np.where((k >= kmin) & (k <= kmax), k ** (-beta / 2), 0)

    return spectral(h, w, seed, shape)


def streaks(h: int, w: int, seed: int, along: float, across: float):
    """Noise drawn out into streaks along x: wide in x frequency `along`, narrow `across`."""
    return spectral(h, w, seed, lambda kx, ky: np.exp(-((kx / along) ** 2) - (ky / across) ** 2))


def mix(a, b, t):
    """Colour between a and b (RGB tuples), t in [0, 1] per pixel."""
    a = np.array(a, dtype=float)
    b = np.array(b, dtype=float)
    t = np.clip(t, 0, 1)[..., None]
    return a + (b - a) * t


def hexrgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def save(name: str, rgb: np.ndarray, quality: int = 72):
    img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")
    path = os.path.join(OUT, f"{name}.webp")
    img.save(path, "WEBP", quality=quality, method=6)
    lum = luminance(np.asarray(img, dtype=float))
    print(
        f"{name}.webp {os.path.getsize(path) // 1024} KB, luminance p1 {np.percentile(lum, 1):.3f}"
        f" mean {lum.mean():.3f} p99 {np.percentile(lum, 99):.3f}"
    )


def luminance(rgb: np.ndarray) -> np.ndarray:
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * c[..., 0] + 0.7152 * c[..., 1] + 0.0722 * c[..., 2]


# ---------------------------------------------------------------------------------------------
# Wood: boards of oak (page) and one board of walnut (header), with growth rings bent by the
# figure of the tree, long fibres and fine pores.


def wood_grain(h: int, w: int, seed: int, rings: float, bend: float):
    """0 (earlywood, light) to 1 (latewood, dark) over a board running along x."""
    y = np.arange(h)[:, None] / h
    # The rings run along the board, bent slowly by the figure of the trunk.
    figure = spectral(h, w, seed, lambda kx, ky: np.exp(-((kx / 1.6) ** 2) - (ky / 0.9) ** 2))
    wobble = streaks(h, w, seed + 1, 4, 3) * 0.08
    phase = (y * rings + figure * bend + wobble) % 1.0
    # Each ring darkens slowly through the year, then ends in a thin dark line of latewood.
    band = 0.45 * phase**2 + 0.8 * np.exp(-(((phase - 0.9) / 0.07) ** 2))
    fibres = streaks(h, w, seed + 2, 1.5, 150)
    pores = np.clip(streaks(h, w, seed + 3, 6, 260) - 1.5, 0, None)
    return band * 0.65 + fibres * 0.1 + pores * 0.4


def wood_boards(size: int, boards: int, seed: int, light, dark, joint, tone=0.06):
    h = size // boards
    out = np.zeros((size, size, 3))
    r = rng(seed)
    for i in range(boards):
        grain = wood_grain(h, size, seed + 10 * i, rings=r.uniform(9, 14), bend=r.uniform(0.7, 1.4))
        board = mix(light, dark, grain)
        board *= 1 + r.uniform(-tone, tone)
        # The board's own joint, somewhere along it, and its long edges.
        x = int(r.uniform(0.15, 0.85) * size)
        board[:, x - 1 : x + 1] = board[:, x - 1 : x + 1] * 0.86
        board[:, x + 1] = board[:, x + 1] * 1.04
        board[0] = board[0] * 1.05
        board[-2] = board[-2] * 0.9
        board[-1] = board[-1] * 0.8
        board = np.roll(board, int(r.uniform(0, size)), axis=1)
        out[i * h : (i + 1) * h] = board
    gap = mix(joint, joint, np.zeros((size, size)))
    edges = np.zeros((size, size))
    for i in range(1, boards + 1):
        edges[(i * h) % size - 1] = 0.55
    return out * (1 - edges[..., None]) + gap * edges[..., None]


def make_wood():
    oak = wood_boards(512, 4, 11, hexrgb("#ecdcc0"), hexrgb("#b88e5e"), hexrgb("#8c6a45"))
    save("oak", oak)
    walnut = mix(
        hexrgb("#6a4429"),
        hexrgb("#2e1b10"),
        wood_grain(256, 1024, 23, rings=9, bend=0.45) + streaks(256, 1024, 24, 1.2, 8) * 0.12,
    )
    save("walnut", walnut)


# ---------------------------------------------------------------------------------------------
# Stone: pale limestone for the page, with soft clouds, specks of shell and faint veins, and a
# dark slate for the header, split in thin layers.


def make_stone():
    s = 512
    clouds = fbm(s, s, 31, 2.6, kmax=40)
    grain = fbm(s, s, 32, 0.6, kmin=60)
    vein_field = fbm(s, s, 33, 3.0, kmax=8) + 0.35 * fbm(s, s, 34, 2.0, kmax=30)
    veins = np.exp(-((vein_field / 0.05) ** 2))
    specks = np.clip(fbm(s, s, 35, 0.3, kmin=90) - 2.4, 0, None)
    light_specks = np.clip(fbm(s, s, 36, 0.3, kmin=90) - 2.5, 0, None)
    t = 0.5 + clouds * 0.13 + grain * 0.09 + veins * 0.25 + specks * 0.8 - light_specks * 0.5
    save("limestone", mix(hexrgb("#efede6"), hexrgb("#bdb8ac"), t))

    h, w = 256, 1024
    # Slate splits in thin sheets: broad steps where a sheet ends, each lit on one edge, over
    # long faint layers and a fine rough grain.
    warp = fbm(h, w, 44, 2.0, kmax=20) * 0.25
    terrace = fbm(h, w, 42, 3.4, kmax=5) * 2.2 + warp
    steps = np.floor(terrace) + np.clip((terrace % 1 - 0.92) / 0.08, 0, 1)
    lit = np.clip(np.roll(steps, 2, axis=0) - steps, -1, 1)
    layers = streaks(h, w, 41, 1.2, 40)
    fine = fbm(h, w, 43, 1.1, kmin=30)
    t = 0.55 + layers * 0.07 + steps * 0.06 - lit * 0.22 + fine * 0.07
    save("slate", mix(hexrgb("#4a5660"), hexrgb("#1f262b"), t))


# ---------------------------------------------------------------------------------------------
# Forest: dappled shade of leaves and ferns on moss (page), and a dense canopy (header).


def leaf_points(cx, cy, length, width, angle):
    pts = []
    for i in range(21):
        u = i / 20
        x = u * length
        y = math.sin(math.pi * u) ** 0.9 * width * (1 - 0.25 * u)
        pts.append((x, y))
    pts += [(x, -y) for x, y in reversed(pts)]
    ca, sa = math.cos(angle), math.sin(angle)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]


def fern_leaves(cx, cy, length, angle, r):
    """A fern frond as many little leaflets along a curved stem."""
    leaves = []
    curve = r.uniform(-0.5, 0.5)
    px, py = cx, cy
    steps = max(10, int(length / 9))
    for i in range(steps):
        u = i / steps
        a = angle + curve * u
        px += math.cos(a) * length / steps
        py += math.sin(a) * length / steps
        size = length * 0.17 * (1 - u) ** 0.8 + length * 0.025
        for side in (1, -1):
            leaves.append((px, py, size, size * 0.15, a + side * 1.0))
        # The stem: a run of thin slivers along the frond.
        leaves.append((px, py, length / steps * 1.2, 1.2, a))
    return leaves


def draw_wrapped(draw, size, poly, fill):
    for dx in (-size, 0, size):
        for dy in (-size, 0, size):
            draw.polygon([(x + dx, y + dy) for x, y in poly], fill=fill)


def shade_mask(size, seed, count, ferns, blur, scale=1.0):
    r = rng(seed)
    big = Image.new("L", (size * 3, size * 3), 0)
    d = ImageDraw.Draw(big)
    shapes = []
    for _ in range(count):
        shapes.append(
            (
                r.uniform(0, size),
                r.uniform(0, size),
                r.uniform(40, 90) * scale,
                r.uniform(12, 24) * scale,
                r.uniform(0, 2 * math.pi),
            )
        )
    for _ in range(ferns):
        shapes += fern_leaves(
            r.uniform(0, size), r.uniform(0, size), r.uniform(120, 200) * scale, r.uniform(0, 6.3), r
        )
    for cx, cy, length, width, angle in shapes:
        poly = leaf_points(cx + size, cy + size, length, width, angle)
        draw_wrapped(d, size, poly, int(r.uniform(150, 255)))
    big = big.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(big.crop((size, size, 2 * size, 2 * size)), dtype=float) / 255


def make_forest():
    s = 512
    shade = shade_mask(s, 51, 6, 9, 1.2, scale=0.8)
    far = shade_mask(s, 54, 14, 3, 7, scale=1.3)
    paper = fbm(s, s, 52, 1.2, kmin=20)
    light = np.clip(fbm(s, s, 53, 3.0, kmax=6), 0, None)
    t = 0.3 + shade * 0.32 + far * 0.18 + paper * 0.04 - light * 0.12
    save("moss", mix(hexrgb("#eef2e4"), hexrgb("#a9b893"), t))

    # Canopy: layers of leaves, the far ones dark and soft, the near ones brighter and sharp,
    # each leaf with its own green and a paler midrib.
    h, w = 256, 512
    r = rng(61)
    img = Image.new("RGB", (w, h), hexrgb("#10241a"))
    for layer, (count, lo, hi, blur, scale) in enumerate(
        [
            (70, "#173322", "#21452b", 2.0, 1.0),
            (55, "#1d3f27", "#2c5934", 1.0, 0.9),
            (40, "#25502f", "#3a6a3c", 0.0, 0.8),
        ]
    ):
        layer_img = Image.new("RGBA", (w * 3, h * 3), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer_img)
        lo_c, hi_c = np.array(hexrgb(lo)), np.array(hexrgb(hi))
        shapes = []
        for _ in range(count):
            shapes.append(
                (
                    r.uniform(0, w),
                    r.uniform(0, h),
                    r.uniform(40, 80) * scale,
                    r.uniform(11, 20) * scale,
                    r.uniform(0, 2 * math.pi),
                )
            )
        if layer == 1:
            for _ in range(4):
                shapes += fern_leaves(r.uniform(0, w), r.uniform(0, h), r.uniform(150, 220), r.uniform(0, 6.3), r)
        for cx, cy, length, width, angle in shapes:
            colour = tuple(int(v) for v in lo_c + (hi_c - lo_c) * r.uniform(0, 1)) + (255,)
            poly = leaf_points(cx + w, cy + h, length, width, angle)
            vein_end = poly[20]
            for dx in (-w, 0, w):
                for dy in (-h, 0, h):
                    d.polygon([(x + dx, y + dy) for x, y in poly], fill=colour)
                    if length > 30:
                        rib = tuple(min(255, int(v * 1.35)) for v in colour[:3]) + (255,)
                        d.line([(cx + w + dx, cy + h + dy), (vein_end[0] + dx, vein_end[1] + dy)], fill=rib, width=1)
        if blur:
            layer_img = layer_img.filter(ImageFilter.GaussianBlur(blur))
        img.paste(layer_img.crop((w, h, 2 * w, 2 * h)), (0, 0), layer_img.crop((w, h, 2 * w, 2 * h)))
    canopy = np.asarray(img, dtype=float)
    canopy *= (1 + fbm(h, w, 62, 2.5, kmax=8) * 0.08)[..., None]
    save("canopy", canopy)


# ---------------------------------------------------------------------------------------------
# Cork: granules of cork pressed together, each its own brown, with dark gaps and pores. Light
# natural cork for the page, dark expanded cork for the header.


def granules(h: int, w: int, seed: int, cell: int):
    """Per pixel: the granule's random tone (0..1) and how near its edge it is (0 edge..1)."""
    r = rng(seed)
    gh, gw = h // cell, w // cell
    jitter = r.uniform(0, 1, size=(gh, gw, 2))
    tone = r.uniform(0, 1, size=(gh, gw))
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    # Bent a little, so granules are rounded and uneven rather than straight-edged cells.
    yy = yy + fbm(h, w, seed + 1, 1.5, kmin=w / cell / 3, kmax=w / cell * 2) * cell * 0.35
    xx = xx + fbm(h, w, seed + 2, 1.5, kmin=w / cell / 3, kmax=w / cell * 2) * cell * 0.35
    cy, cx = (yy // cell).astype(int), (xx // cell).astype(int)
    d1 = np.full((h, w), 1e9)
    d2 = np.full((h, w), 1e9)
    best = np.zeros((h, w))
    for oy in (-1, 0, 1):
        for ox in (-1, 0, 1):
            ny, nx = (cy + oy) % gh, (cx + ox) % gw
            py = (cy + oy + jitter[ny, nx, 0]) * cell
            px = (cx + ox + jitter[ny, nx, 1]) * cell
            dist = np.hypot(yy - py, xx - px)
            closer = dist < d1
            d2 = np.where(closer, d1, np.minimum(d2, dist))
            best = np.where(closer, tone[ny, nx], best)
            d1 = np.where(closer, dist, d1)
    return best, np.clip((d2 - d1) / cell, 0, 1)


def make_cork():
    s = 512
    tone, edge = granules(s, s, 71, 8)
    small_tone, _ = granules(s, s, 72, 3)
    holes = fbm(s, s, 75, 1.0, kmin=20)
    # Gaps only here and there between granules, and pores: small dark holes.
    gap = np.exp(-((edge / 0.06) ** 2)) * np.clip(holes, 0, 1)
    pores = np.clip(fbm(s, s, 73, 0.2, kmin=100) - 2.0, 0, None)
    t = 0.42 + (tone - 0.5) * 0.3 + (small_tone - 0.5) * 0.18 + gap * 0.45 + pores * 0.55
    t += fbm(s, s, 74, 2.5, kmax=8) * 0.05 + fbm(s, s, 76, 0.5, kmin=80) * 0.05
    save("cork", mix(hexrgb("#f0dcbb"), hexrgb("#a67c52"), t))

    h, w = 256, 512
    tone, edge = granules(h, w, 81, 11)
    small_tone, _ = granules(h, w, 83, 4)
    holes = fbm(h, w, 84, 1.0, kmin=15)
    gap = np.exp(-((edge / 0.08) ** 2)) * np.clip(holes + 0.3, 0, 1)
    t = 0.45 + (tone - 0.5) * 0.45 + (small_tone - 0.5) * 0.2 + gap * 0.45
    t += fbm(h, w, 82, 0.5, kmin=60) * 0.06
    save("dark-cork", mix(hexrgb("#6e4a2f"), hexrgb("#22140b"), t))


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    wanted = sys.argv[1:] or ["wood", "stone", "forest", "cork"]
    for name in wanted:
        globals()[f"make_{name}"]()
