"""Build the small textures used by the 3D floor sample in the home hero.

Run from the project folder:   python tools/make-hero-textures.py

Outputs (assets/images/hero/):
  concrete.webp  256x256, procedural concrete (fine grain + a few aggregate specks)
  metallic.webp  1024x1024, metallic epoxy (graphite with pearl veins) for the showroom floor
  flake-floor.webp 512x512, seamless flake floor built from the swatch's colors
  plaster.webp   512x512, warm wall plaster
  polished.webp  512x512, polished concrete floor

Change FLAKE to use another color from assets/images/1-home/mostPopular/.
Requires Pillow:  pip install pillow
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets/images/hero"
FLAKE = ROOT / "assets/images/1-home/mostPopular/outback.webp"


def flake_texture() -> Image.Image:
    src = Image.open(FLAKE).convert("RGB")
    w, h = src.size
    side = min(w, h)
    tile = src.crop(((w - side) // 2, 0, (w - side) // 2 + side, side))
    # 2x2 mirrored tile: repeats seamlessly; with random flakes the symmetry is hard to see
    full = Image.new("RGB", (side * 2, side * 2))
    full.paste(tile, (0, 0))
    full.paste(ImageOps.mirror(tile), (side, 0))
    full.paste(ImageOps.flip(tile), (0, side))
    full.paste(ImageOps.flip(ImageOps.mirror(tile)), (side, side))
    return full.resize((512, 512), Image.LANCZOS)


def concrete_texture(size: int = 256) -> Image.Image:
    rnd = random.Random(7)
    base = Image.effect_noise((size, size), 22).convert("L")
    coarse = Image.effect_noise((size // 8, size // 8), 40).convert("L").resize((size, size), Image.BICUBIC)
    mix = Image.blend(base, coarse, 0.45).filter(ImageFilter.GaussianBlur(0.6))
    img = ImageOps.colorize(mix, black="#6f6d69", white="#b9b6b0").convert("RGB")
    px = img.load()
    for _ in range(size * 3):  # small dark/light aggregate specks
        x, y = rnd.randrange(size), rnd.randrange(size)
        tone = rnd.choice((92, 98, 186, 196))
        px[x, y] = (tone, tone - 2, tone - 5)
    return img


def smooth_noise(size: int, seed: int, octaves=(6, 12, 24, 48)) -> list:
    """Sum of upscaled random noise ("turbulence"), values 0..1, as a flat list."""
    random.seed(seed)
    total = None
    weight_sum = 0.0
    for i, cells in enumerate(octaves):
        small = Image.new("L", (cells, cells))
        small.putdata([random.randrange(256) for _ in range(cells * cells)])
        layer = small.resize((size, size), Image.BICUBIC).filter(ImageFilter.GaussianBlur(size / cells / 3))
        weight = 0.5 ** i
        data = [v * weight for v in layer.get_flattened_data()]
        total = data if total is None else [a + b for a, b in zip(total, data)]
        weight_sum += weight * 255
    return [v / weight_sum for v in total]


def metallic_texture(size: int = 1024) -> Image.Image:
    """Metallic epoxy look: broad, soft silver clouds flowing over graphite, with faint veins."""
    turb = smooth_noise(size, 11, octaves=(4, 8, 16, 32))
    tone = smooth_noise(size, 23, octaves=(2, 4, 8))
    dark, mid, silver = (30, 31, 35), (92, 94, 101), (214, 212, 206)
    pixels = []
    for i, (t, k) in enumerate(zip(turb, tone)):
        x, y = i % size, i // size
        flow = math.sin((x * 0.8 + y * 0.35) / size * 2 * math.pi * 1.1 + t * 7.5)
        band = (0.5 + 0.5 * flow) ** 2.2                 # broad soft bands
        vein = (1 - abs(flow)) ** 9 * 0.35                # faint thin veins
        light = min(1.0, band * (0.35 + k * 0.9) + vein)
        if light < 0.5:
            a = light / 0.5
            col = tuple(dark[c] + (mid[c] - dark[c]) * a for c in range(3))
        else:
            a = (light - 0.5) / 0.5
            col = tuple(mid[c] + (silver[c] - mid[c]) * a for c in range(3))
        pixels.append(tuple(int(v) for v in col))
    img = Image.new("RGB", (size, size))
    img.putdata(pixels)
    return img.filter(ImageFilter.GaussianBlur(1.2))


def flake_scatter_texture(size: int = 512, chips: int = 11000) -> Image.Image:
    """Seamless flake floor: random chips in the real swatch's colors (no mirroring)."""
    rnd = random.Random(3)
    swatch = Image.open(FLAKE).convert("RGB").quantize(6).convert("RGB")
    colors = [c for _, c in sorted(swatch.getcolors(1 << 16), reverse=True)]
    img = Image.new("RGB", (size, size), colors[0])
    draw = ImageDraw.Draw(img)
    for _ in range(chips):
        cx, cy = rnd.uniform(0, size), rnd.uniform(0, size)
        r = rnd.uniform(4, 10)
        color = colors[min(int(rnd.expovariate(0.9)), len(colors) - 1)]
        points = []
        for k in range(rnd.randint(4, 6)):
            ang = k / 5 * 2 * math.pi + rnd.uniform(-0.5, 0.5)
            rr = r * rnd.uniform(0.5, 1.1)
            points.append((math.cos(ang) * rr, math.sin(ang) * rr))
        for ox in (-size, 0, size):        # draw wrapped copies so the texture tiles
            for oy in (-size, 0, size):
                draw.polygon([(cx + px + ox, cy + py + oy) for px, py in points], fill=color)
    return img


def plaster_texture(size: int = 512) -> Image.Image:
    """Warm, quiet plaster for the showroom walls."""
    fine = Image.effect_noise((size, size), 10).convert("L").filter(ImageFilter.GaussianBlur(0.8))
    cloud = Image.effect_noise((size // 16, size // 16), 30).convert("L").resize((size, size), Image.BICUBIC)
    mix = Image.blend(fine, cloud, 0.3)
    return ImageOps.colorize(mix, black="#c4b49c", white="#dccfbd").convert("RGB")


def polished_texture(size: int = 512) -> Image.Image:
    """Polished concrete: light, mottled, with a few exposed aggregate specks."""
    rnd = random.Random(5)
    cloud = Image.effect_noise((size // 12, size // 12), 34).convert("L").resize((size, size), Image.BICUBIC)
    fine = Image.effect_noise((size, size), 14).convert("L")
    mix = Image.blend(cloud, fine, 0.25).filter(ImageFilter.GaussianBlur(0.6))
    img = ImageOps.colorize(mix, black="#8d877e", white="#cfc9bf").convert("RGB")
    px = img.load()
    for _ in range(size * 5):
        x, y = rnd.randrange(size), rnd.randrange(size)
        tone = rnd.choice((96, 110, 200, 214))
        px[x, y] = (tone, tone - 3, tone - 7)
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    flake_scatter_texture().save(OUT / "flake-floor.webp", "WEBP", quality=82, method=6)
    concrete_texture().save(OUT / "concrete.webp", "WEBP", quality=80, method=6)
    metallic_texture().save(OUT / "metallic.webp", "WEBP", quality=80, method=6)
    plaster_texture().save(OUT / "plaster.webp", "WEBP", quality=74, method=6)
    polished_texture().save(OUT / "polished.webp", "WEBP", quality=78, method=6)
    for f in ("flake-floor.webp", "concrete.webp", "metallic.webp", "plaster.webp", "polished.webp"):
        print(f, (OUT / f).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
