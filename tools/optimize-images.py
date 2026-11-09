"""Optimize the site's images.

Run from the project folder:   python tools/optimize-images.py

What it does, for every .jpg / .jpeg / .png inside assets/images
(except assets/images/og and assets/images/favicon):
  1. Resizes it so it fits inside MAX_SIZE pixels (blog images: BLOG_MAX_SIZE).
  2. Saves it as .webp (much smaller, supported by all current browsers).
  3. Updates every reference in the .html, .css and .js files.
  4. Deletes the original (it stays in the git history).

Images wider than 900px also get a 600px copy (photo-600.webp); tools/build.py
then adds srcset so phones download the small one.

Blog images (assets/images/4-blog/<name>.png) also get a 1200x630 JPG copy in
assets/images/og/blog-<name>.jpg, used as the preview picture when a post is
shared on WhatsApp/Facebook. Name the blog image after the post file
(blog-garage-maintenance.html -> 4-blog/garage-maintenance.png) for this to work.

Requires Pillow:  pip install pillow
"""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IMAGES = ROOT / "assets" / "images"
SKIP_DIRS = {"og", "favicon"}
MAX_SIZE = 1400
BLOG_MAX_SIZE = 1200
WEBP_QUALITY = 80
OG_SIZE = (1200, 630)
SMALL_WIDTH = 600


def make_og(src: Image.Image, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    og = ImageOps.fit(src.convert("RGB"), OG_SIZE, Image.LANCZOS)
    og.save(dest, "JPEG", quality=82, optimize=True, progressive=True)


def main() -> None:
    text_files = [p for p in ROOT.rglob("*") if p.suffix in {".html", ".css", ".js"} and ".git" not in p.parts]
    texts = {p: p.read_text(encoding="utf-8") for p in text_files}
    saved = 0

    for src in sorted(IMAGES.rglob("*")):
        if src.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            continue
        if SKIP_DIRS & set(src.relative_to(IMAGES).parts):
            continue

        image = Image.open(src)
        image = ImageOps.exif_transpose(image)
        is_blog = src.parent.name == "4-blog"
        limit = BLOG_MAX_SIZE if is_blog else MAX_SIZE
        if max(image.size) > limit:
            image.thumbnail((limit, limit), Image.LANCZOS)

        if is_blog:
            make_og(image, IMAGES / "og" / f"blog-{src.stem}.jpg")

        dest = src.with_suffix(".webp")
        mode = "RGBA" if image.mode in ("RGBA", "LA", "P") else "RGB"
        image.convert(mode).save(dest, "WEBP", quality=WEBP_QUALITY, method=6)

        old_ref = src.relative_to(ROOT).as_posix()
        new_ref = dest.relative_to(ROOT).as_posix()
        for path, text in texts.items():
            if old_ref in text:
                texts[path] = text.replace(old_ref, new_ref)

        before, after = src.stat().st_size, dest.stat().st_size
        saved += before - after
        print(f"{old_ref}: {before // 1024} KB -> {after // 1024} KB")
        src.unlink()

    for path, text in texts.items():
        path.write_text(text, encoding="utf-8", newline="\n")
    print(f"\nSaved {saved / 1024 / 1024:.1f} MB")
    make_small_copies()


def make_small_copies() -> None:
    """Create photo-600.webp next to every large .webp that doesn't have one yet."""
    for src in sorted(IMAGES.rglob("*.webp")):
        if src.stem.endswith(f"-{SMALL_WIDTH}") or SKIP_DIRS & set(src.relative_to(IMAGES).parts):
            continue
        small = src.with_name(f"{src.stem}-{SMALL_WIDTH}.webp")
        image = Image.open(src)
        if image.width <= 900 or small.exists():
            continue
        image.thumbnail((SMALL_WIDTH, SMALL_WIDTH * 4), Image.LANCZOS)
        image.save(small, "WEBP", quality=WEBP_QUALITY, method=6)
        print(f"small copy: {small.relative_to(ROOT).as_posix()} ({small.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
