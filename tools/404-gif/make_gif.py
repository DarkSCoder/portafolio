"""Animated 404 chase: the 404 bug chases the developer.

Story per loop (32 frames): both run (4 steps); midway the bug lunges and almost
catches him -> neon sign glitches, the developer startles ("!" + sweat), papers fly
off his desk-dash, then the bug falls back. Seamless loop.
"""
import math
import random
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC, OUT = sys.argv[1], sys.argv[2]
N = 32
DELAY = 80  # ms per frame (GIF stores 10 ms units)
LUNGE = (14, 26)  # frames where the bug surges forward

src = Image.open(SRC).convert("RGB")
W, H = src.size
A = np.asarray(src).astype(np.float32)
R, G, B = A[..., 0], A[..., 1], A[..., 2]
MAXC = A.max(axis=2)


def poly_mask(points, feather=0):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    if feather:
        m = m.filter(ImageFilter.GaussianBlur(feather))
    return m


def grow(mask_img, px):
    return mask_img.filter(ImageFilter.MaxFilter(px * 2 + 1)) if px else mask_img


def inpaint(arr, hole, iterations=700):
    """Diffusion fill of hole pixels from their surroundings (numpy Jacobi)."""
    out = arr.copy()
    hole_b = hole > 0
    known = ~hole_b
    mean = out[known].mean(axis=0)
    out[hole_b] = mean
    for _ in range(iterations):
        p = np.pad(out, ((1, 1), (1, 1), (0, 0)), mode="edge")
        avg = (p[:-2, 1:-1] + p[2:, 1:-1] + p[1:-1, :-2] + p[1:-1, 2:]) / 4
        out[hole_b] = avg[hole_b]
    return out


# --- Monster (404 bug) --------------------------------------------------------
monster_envelope = poly_mask([
    (232, 548), (258, 536), (268, 484), (300, 474), (470, 478), (480, 612),
    (446, 628), (446, 662), (266, 664), (258, 622), (228, 600),
])
env = np.asarray(monster_envelope) > 0
bright = (MAXC > 92) | ((R - B > 38) & (R > 80))
m_core = Image.fromarray(((env & bright) * 255).astype(np.uint8))
# close small gaps, then grow to include the glow halo
m_core = m_core.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(5))
m_core = Image.fromarray(((np.asarray(m_core) > 0) & env).astype(np.uint8) * 255)
monster_alpha = grow(m_core, 3).filter(ImageFilter.GaussianBlur(1.6))
mx0, my0, mx1, my1 = 222, 466, 490, 672
monster_sprite = src.crop((mx0, my0, mx1, my1)).convert("RGBA")
monster_sprite.putalpha(monster_alpha.crop((mx0, my0, mx1, my1)))

# Baked spark trail in front of the bug (wrong direction for a chase): remove it.
trail_box = np.zeros((H, W), bool)
trail_box[455:675, 440:665] = True
trail_box[455:675, 440:470] &= ~env[455:675, 440:470]
warm = (R - B > 28) & (R > 85)
trail = Image.fromarray(((trail_box & warm) * 255).astype(np.uint8))
trail = grow(trail, 3)

# --- Developer ----------------------------------------------------------------
dev_poly = [
    (750, 352), (756, 322), (772, 310), (794, 314), (808, 342), (826, 362), (866, 342),
    (858, 300), (860, 258), (890, 236), (942, 232), (978, 248), (994, 282),
    (998, 330), (990, 356), (1004, 362), (1044, 368), (1100, 376), (1142, 372),
    (1166, 398), (1154, 422), (1112, 428), (1062, 432), (1054, 470), (1062, 490),
    (1100, 498), (1122, 488), (1152, 498), (1170, 540), (1162, 564), (1120, 558),
    (1080, 548), (1040, 544), (1004, 562), (962, 584), (914, 612), (900, 652),
    (868, 660), (822, 644), (812, 610), (840, 594), (880, 588), (926, 540),
    (932, 500), (926, 470), (922, 432), (870, 402), (830, 390), (798, 388),
    (772, 378), (754, 368),
]
dev_mask_hard = poly_mask(dev_poly)
dev_alpha = grow(dev_mask_hard, 2).filter(ImageFilter.GaussianBlur(1.2))
dx0, dy0, dx1, dy1 = 740, 222, 1180, 672
dev_sprite = src.crop((dx0, dy0, dx1, dy1)).convert("RGBA")
dev_sprite.putalpha(dev_alpha.crop((dx0, dy0, dx1, dy1)))

# --- Clean plate ---------------------------------------------------------------
hole = np.maximum.reduce([
    np.asarray(grow(m_core, 6)),
    np.asarray(trail),
    np.asarray(grow(dev_mask_hard, 4)),
])
plate_arr = inpaint(A, hole)
# re-add subtle grain so filled areas match the textured art
rng = np.random.default_rng(7)
grain = rng.normal(0, 3.2, plate_arr.shape[:2])[..., None]
plate_arr = np.where((hole > 0)[..., None], plate_arr + grain, plate_arr)
plate = Image.fromarray(np.clip(plate_arr, 0, 255).astype(np.uint8))

# --- Neon / monitors helpers -------------------------------------------------
TITLE = (405, 32, 1005, 222)
RED_SIGNS = [(296, 104, 394, 156), (1020, 134, 1130, 176), (1180, 216, 1266, 286)]


def neon(img, f, factor, glitch):
    x0, y0, x1, y1 = TITLE
    region = np.asarray(img.crop(TITLE)).astype(np.float32)
    lum = region.max(axis=2, keepdims=True)
    lit = np.clip((lum - 60) / 80, 0, 1)  # only the glowing letters dim
    region = region * (1 - lit * (1 - factor))
    if glitch:
        rnd = random.Random(f)
        out = region.copy()
        for _ in range(4):
            yb = rnd.randrange(0, y1 - y0 - 14)
            hgt = rnd.randrange(6, 16)
            shift = rnd.choice([-14, -9, 9, 14])
            out[yb:yb + hgt] = np.roll(region[yb:yb + hgt], shift, axis=1)
        out[..., 0] = np.roll(out[..., 0], 5, axis=1)  # chromatic split
        out[..., 2] = np.roll(out[..., 2], -4, axis=1)
        region = out
    img.paste(Image.fromarray(np.clip(region, 0, 255).astype(np.uint8)), (x0, y0))


def red_sign(img, box, on):
    if on:
        return
    region = np.asarray(img.crop(box)).astype(np.float32)
    r, g, b = region[..., 0], region[..., 1], region[..., 2]
    red = np.clip((r - g - 35) / 60, 0, 1)[..., None]
    region = region * (1 - red * 0.6)
    img.paste(Image.fromarray(np.clip(region, 0, 255).astype(np.uint8)), box[:2])


# --- Drawn props ----------------------------------------------------------------
def star(draw, x, y, s, color):
    draw.rectangle([x - s, y - 1, x + s, y + 1], fill=color)
    draw.rectangle([x - 1, y - s, x + 1, y + s], fill=color)


def paper(layer, cx, cy, angle, alpha):
    w, h = 44, 34
    sheet = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(sheet)
    d.rectangle([0, 0, w - 1, h - 1], fill=(236, 232, 220, alpha), outline=(150, 150, 160, alpha))
    for ly in (8, 14, 20, 26):
        d.line([(6, ly), (w - 8 - (ly % 3) * 4, ly)], fill=(120, 128, 150, alpha), width=2)
    sheet = sheet.rotate(angle, resample=Image.NEAREST, expand=True)
    layer.alpha_composite(sheet, (int(cx - sheet.width / 2), int(cy - sheet.height / 2)))


def exclamation(draw, x, y, scale):
    s = scale
    outline, fill = (20, 16, 10, 255), (255, 214, 64, 255)
    draw.rectangle([x - 6 * s, y - 2, x + 6 * s, y + 26 * s + 2], fill=outline)
    draw.rectangle([x - 4 * s, y, x + 4 * s, y + 18 * s], fill=fill)
    draw.rectangle([x - 4 * s, y + 21 * s, x + 4 * s, y + 26 * s], fill=fill)


def lunge_amount(f):
    a, b = LUNGE
    if not a <= f <= b:
        return 0.0
    t = (f - a) / (b - a)
    return math.sin(math.pi * t) ** 1.4


papers = [
    {"phase": 0, "y": 430, "rise": -150, "spin": 21},
    {"phase": 11, "y": 470, "rise": -60, "spin": -27},
    {"phase": 22, "y": 400, "rise": -110, "spin": 33},
]
spark_seeds = [(random.Random(i).random(), random.Random(i * 7 + 3).random()) for i in range(14)]

frames = []
for f in range(N):
    t = f / N
    frame = plate.copy().convert("RGBA")
    lunge = lunge_amount(f)

    # Neon sign: mostly steady, stutters and glitches when the bug lunges.
    neon_factor = {15: 0.35, 16: 0.8, 17: 0.25, 18: 0.9, 20: 0.5}.get(f, 1.0)
    base_rgb = frame.convert("RGB")
    neon(base_rgb, f, neon_factor, glitch=f in (16, 17, 18))
    for i, box in enumerate(RED_SIGNS):
        red_sign(base_rgb, box, on=((f // 4 + i) % 3 != 0))
    frame = base_rgb.convert("RGBA")

    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    # Coffee steam rising from the DEBUG mug.
    for k in range(3):
        p = ((f / N) * 2 + k / 3) % 1
        sx = 150 + k * 11
        pts = []
        for j in range(7):
            yy = 418 - p * 40 - j * 6
            xx = sx + math.sin((j * 0.9) + (f / N) * 2 * math.pi * 2 + k) * 4
            pts.append((xx, yy))
        alpha = int(150 * (1 - p))
        od.line(pts, fill=(230, 236, 240, alpha), width=3)

    # Blinking cursor on a code monitor.
    if (f // 4) % 2 == 0:
        od.rectangle([706, 333, 714, 345], fill=(120, 230, 255, 230))

    # Monster motion: 4 running steps per loop + forward lunge.
    step = abs(math.sin(math.pi * f / 8))
    mdx = 6 * math.sin(2 * math.pi * f / 16) + 46 * lunge
    mdy = -9 * step - 16 * lunge
    tilt = -4 * math.sin(2 * math.pi * f / 16) - 5 * lunge

    # Floor shadow follows the bug and shrinks when it is airborne.
    shadow_w = 120 * (1 - 0.25 * lunge - 0.08 * step)
    scx = 346 + mdx
    od.ellipse([scx - shadow_w / 2, 668, scx + shadow_w / 2, 688], fill=(5, 8, 14, 90))

    # Spark trail behind the bug (to its left), drifting backwards.
    feet_x, feet_y = 280 + mdx, 640 + mdy * 0.4
    for i, (r1, r2) in enumerate(spark_seeds):
        life = ((f + i * 2.3) % 9) / 9
        x = feet_x - 15 - life * (70 + r1 * 90)
        y = feet_y - r2 * 70 - life * 25 + math.sin(life * 6 + i) * 4
        color = (255, 200 - int(80 * life), 80, int(255 * (1 - life)))
        star(od, x, y, 2 + (i % 3) + int(2 * (1 - life)), color)
    # Speed lines behind the body.
    for j, ly in enumerate((505, 528, 552, 578)):
        length = 22 + 18 * lunge + 10 * ((f + j) % 3)
        x_end = 262 + mdx - 6
        od.line([(x_end - length, ly + mdy), (x_end, ly + mdy)], fill=(255, 170, 70, 200), width=3)

    frame.alpha_composite(overlay)

    sprite = monster_sprite.rotate(tilt, resample=Image.BICUBIC, expand=True, center=None)
    ox = mx0 + int(round(mdx)) - (sprite.width - monster_sprite.width) // 2
    oy = my0 + int(round(mdy)) - (sprite.height - monster_sprite.height) // 2
    frame.alpha_composite(sprite, (ox, oy))

    # Developer: running bounce, plus a startled hop when the bug lunges.
    dev_step = abs(math.sin(math.pi * f / 8 + 0.9))
    startle = lunge_amount(f - 2)
    ddx = int(round(4 * math.sin(2 * math.pi * f / 16 + 0.9)))
    ddy = int(round(-5 * dev_step - 7 * startle))
    frame.alpha_composite(dev_sprite, (dx0 + ddx, dy0 + ddy))

    top = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(top)
    if startle > 0.15:
        exclamation(td, 1028 + ddx, int(226 + ddy - 12 * startle), 2 if startle < 0.6 else 2.3)
        for k in range(3):
            life = ((f - LUNGE[0]) / 6 + k * 0.33) % 1
            sx = 990 + ddx + 18 * k + life * 40
            sy = 268 + ddy - 20 * math.sin(life * math.pi) + life * 30
            td.ellipse([sx - 4, sy - 6, sx + 4, sy + 6], fill=(150, 220, 255, int(230 * (1 - life))))

    # Papers blown off by his dash, tumbling to the right and off-frame.
    for pinfo in papers:
        life = ((f + pinfo["phase"]) % N) / N
        px = 1060 + life * 380
        py = pinfo["y"] + pinfo["rise"] * life + 40 * math.sin(life * math.pi * 2) * 0.5
        alpha = int(255 * min(1, (1 - life) * 3, life * 6))
        if alpha > 10:
            paper(top, px, py, pinfo["spin"] * f, alpha)

    frame.alpha_composite(top)
    frames.append(frame.convert("RGB"))

# --- Export --------------------------------------------------------------------
OUT_W = 720
OUT_H = round(H * OUT_W / W)
small = [fr.resize((OUT_W, OUT_H), Image.LANCZOS) for fr in frames]

# One shared palette (built from several frames) keeps colors stable and the file small.
sample = Image.new("RGB", (OUT_W, OUT_H * 4))
for i, idx in enumerate((0, 9, 17, 24)):
    sample.paste(small[idx], (0, OUT_H * i))
palette = sample.quantize(colors=255, method=Image.Quantize.MEDIANCUT)
quantized = [fr.quantize(palette=palette, dither=Image.Dither.NONE) for fr in small]
TRANSPARENT = 255
gif_frames = [quantized[0]]
for prev, cur in zip(quantized, quantized[1:]):
    a, b = np.asarray(prev), np.asarray(cur).copy()
    b[a == b] = TRANSPARENT
    delta = Image.fromarray(b, mode="P")
    delta.putpalette(palette.getpalette())
    delta.info["transparency"] = TRANSPARENT
    gif_frames.append(delta)
gif_frames[0].save(
    f"{OUT}/404-chase.gif", save_all=True, append_images=gif_frames[1:],
    duration=DELAY, loop=0, disposal=1, optimize=False, transparency=TRANSPARENT,
)
small[0].save(
    f"{OUT}/404-chase.webp", save_all=True, append_images=small[1:],
    duration=DELAY, loop=0, quality=82, method=6,
)
# Static poster (reduced motion / no animation): the "almost caught" moment.
small[20].save(f"{OUT}/404-chase-still.jpg", quality=84, optimize=True, progressive=True)
# Debug contact sheet at full size for review.
for idx in (0, 8, 17, 20):
    frames[idx].save(f"{OUT}/debug-frame-{idx:02d}.png")
plate.save(f"{OUT}/debug-plate.png")
print("ok", OUT_W, OUT_H)
