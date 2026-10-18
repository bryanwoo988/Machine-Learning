#!/usr/bin/env python3
"""Generate icons, splash screens and link-preview images from icon.png.

Run:  python3 tools/make-icons.py   (needs Pillow and fonts-noto-cjk)
Idempotent: safe to re-run after replacing the source icon.

icon.png is 512 x 512. It is never drawn larger than that: an upscaled icon
looks soft on exactly the screens (splash, link previews) people see first.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "icon.png"
ICONS = ROOT / "icons"
SPLASH = ICONS / "splash"

# Palette sampled from icon.png, the robot (see css/app.css tokens).
SKY = (47, 99, 214, 255)        # #2f63d6 robot blue, the app's accent
CLOUD = (232, 240, 253, 255)    # #e8f0fd pale blue, behind maskable / iOS icons
LIGHT_BG = (246, 248, 252, 255) # app light background
DARK_BG = (14, 19, 31, 255)     # app dark background
INK = (30, 38, 56, 255)         # the robot's navy
INK_DARK = (228, 234, 246, 255)

MAX_ART = 512
FONT_LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_CJK = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
CJK_INDEX = 2   # Simplified Chinese face in the Noto CJK collection


def load_icon() -> Image.Image:
    icon = Image.open(SRC).convert("RGBA")
    bbox = icon.getbbox()
    return icon.crop(bbox) if bbox else icon


def fit(icon: Image.Image, box: int) -> Image.Image:
    w, h = icon.size
    scale = min(box, MAX_ART, max(w, h)) / max(w, h)
    return icon.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)


def compose(icon, size, bg, coverage, dy=0):
    canvas = Image.new("RGBA", size, bg)
    art = fit(icon, round(min(size) * coverage))
    canvas.alpha_composite(art, ((size[0] - art.width) // 2, (size[1] - art.height) // 2 + dy))
    return canvas, art


def save(img, path, opaque=True, quantize=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    if quantize:
        img = img.convert("RGB").quantize(colors=128, method=Image.MEDIANCUT, dither=Image.NONE)
    elif opaque:
        img = img.convert("RGB")
    img.save(path, "PNG", optimize=True)
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size // 1024} KB")


def centred_text(draw, cx, y, text, font, fill):
    w = draw.textlength(text, font=font)
    draw.text((cx - w / 2, y), text, font=font, fill=fill)


def og_image(icon, size, path):
    """Link preview: icon, then 机器学习 · Machine Learning, on the light background."""
    w, h = size
    canvas = Image.new("RGBA", size, LIGHT_BG)
    art = fit(icon, round(h * 0.52))
    top = round(h * 0.10)
    canvas.alpha_composite(art, ((w - art.width) // 2, top))
    d = ImageDraw.Draw(canvas)
    y = top + art.height + round(h * 0.05)
    cjk = ImageFont.truetype(FONT_CJK, round(h * 0.085), index=CJK_INDEX)
    lat = ImageFont.truetype(FONT_LATIN, round(h * 0.07))
    zh, sep, en = "机器学习", "  ·  ", "Machine Learning"
    total = d.textlength(zh, font=cjk) + d.textlength(sep, font=lat) + d.textlength(en, font=lat)
    x = (w - total) / 2
    d.text((x, y), zh, font=cjk, fill=INK)
    x += d.textlength(zh, font=cjk)
    d.text((x, y + round(h * 0.008)), sep, font=lat, fill=SKY)
    x += d.textlength(sep, font=lat)
    d.text((x, y + round(h * 0.008)), en, font=lat, fill=INK)
    save(canvas, path)


def main():
    icon = load_icon()
    print(f"source {SRC.name} trimmed to {icon.size}")

    print("\nmanifest icons")
    for s in (192, 512):
        save(compose(icon, (s, s), (0, 0, 0, 0), 1.0)[0], ICONS / f"icon-{s}.png", opaque=False)
    # Android can clip ~10% per edge of an adaptive icon: art at 66% on a solid safe area.
    for s in (192, 512):
        save(compose(icon, (s, s), CLOUD, 0.66)[0], ICONS / f"icon-maskable-{s}.png")

    print("\niOS / favicon")
    save(compose(icon, (180, 180), CLOUD, 0.80)[0], ICONS / "apple-touch-icon-180.png")
    save(compose(icon, (32, 32), (0, 0, 0, 0), 1.0)[0], ICONS / "favicon-32.png", opaque=False)
    compose(icon, (64, 64), (0, 0, 0, 0), 1.0)[0].save(ROOT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  favicon.ico")

    # apple-touch-startup-image must match the device's pixel size exactly.
    sizes = [
        (1290, 2796), (1179, 2556), (1284, 2778), (1170, 2532),
        (1125, 2436), (1242, 2688), (828, 1792), (750, 1334),
        (1536, 2048), (1668, 2388), (2048, 2732),
    ]
    print("\nsplash screens")
    for theme, bg, ink in (("light", LIGHT_BG, INK), ("dark", DARK_BG, INK_DARK)):
        for w, h in sizes:
            canvas, art = compose(icon, (w, h), bg, 0.38, dy=-round(h * 0.03))
            d = ImageDraw.Draw(canvas)
            y = (h + art.height) // 2 - round(h * 0.03) + round(w * 0.06)
            centred_text(d, w / 2, y, "机器学习", ImageFont.truetype(FONT_CJK, round(w * 0.075), index=CJK_INDEX), ink)
            centred_text(d, w / 2, y + round(w * 0.11), "Machine Learning",
                         ImageFont.truetype(FONT_LATIN, round(w * 0.055)), ink)
            save(canvas, SPLASH / f"{w}x{h}-{theme}.png", quantize=True)

    print("\nlink previews")
    og_image(icon, (1200, 630), ICONS / "og-image.png")
    og_image(icon, (600, 600), ICONS / "og-image-square.png")
    print("\ndone")


if __name__ == "__main__":
    main()
