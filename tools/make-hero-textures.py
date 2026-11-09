"""Build the small textures used by the 3D floor sample in the home hero.

Run from the project folder:   python tools/make-hero-textures.py

Outputs (assets/images/hero/):
  flake.webp     512x512, made from a real flake swatch ("Outback", mirrored so it tiles without hard seams)
  concrete.webp  256x256, procedural concrete (fine grain + a few aggregate specks)

Change FLAKE to use another color from assets/images/1-home/mostPopular/.
Requires Pillow:  pip install pillow
"""
import random
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

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


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    flake_texture().save(OUT / "flake.webp", "WEBP", quality=82, method=6)
    concrete_texture().save(OUT / "concrete.webp", "WEBP", quality=80, method=6)
    for f in ("flake.webp", "concrete.webp"):
        print(f, (OUT / f).stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
