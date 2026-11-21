"""Generate ten original Lifea-themed, Minecraft-layout cape PNGs."""
from pathlib import Path
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / "resources" / "default-capes"
OUT.mkdir(parents=True, exist_ok=True)

DESIGNS = [
    ("nova", (24, 10, 18, 255), (255, 44, 65, 255), "star"),
    ("inferno", (71, 14, 12, 255), (255, 116, 37, 255), "flame"),
    ("nightfall", (14, 15, 27, 255), (113, 75, 186, 255), "moon"),
    ("royal", (48, 9, 21, 255), (255, 207, 78, 255), "crown"),
    ("venom", (12, 38, 30, 255), (83, 227, 144, 255), "chevron"),
    ("frost", (16, 31, 48, 255), (115, 220, 255, 255), "crystal"),
    ("eclipse", (20, 9, 15, 255), (224, 29, 63, 255), "eclipse"),
    ("pulse", (38, 8, 17, 255), (255, 73, 117, 255), "pulse"),
    ("runes", (30, 13, 37, 255), (198, 108, 255, 255), "runes"),
    ("solar", (62, 26, 6, 255), (255, 203, 54, 255), "sun"),
]

def pattern(draw, kind, color):
    if kind == "star":
        for x, y in [(3, 3), (8, 7), (3, 12), (6, 5)]:
            draw.point((x, y), fill=color)
        draw.line((2, 8, 9, 8), fill=color)
    elif kind == "flame":
        for x, height in enumerate([4, 8, 6, 13, 10, 7, 12, 6, 9, 4], 1):
            draw.line((x, 16, x, 16 - height), fill=color)
    elif kind in ("moon", "eclipse", "sun"):
        draw.ellipse((2, 4, 9, 11), fill=color)
        if kind == "eclipse":
            draw.ellipse((5, 3, 10, 9), fill=(20, 9, 15, 255))
        if kind == "sun":
            for x, y in [(5, 1), (5, 14), (0, 7), (11, 7)]:
                draw.point((x, y), fill=color)
    elif kind == "crown":
        draw.rectangle((1, 10, 10, 13), fill=color)
        draw.polygon([(1, 10), (2, 4), (5, 8), (7, 2), (9, 8), (11, 4), (10, 10)], fill=color)
    elif kind == "chevron":
        draw.line([(1, 4), (5, 8), (9, 4)], fill=color, width=2)
        draw.line([(1, 10), (5, 14), (9, 10)], fill=color, width=2)
    elif kind == "crystal":
        draw.polygon([(5, 2), (9, 7), (5, 14), (1, 7)], outline=color)
        draw.line((5, 3, 5, 13), fill=color)
    elif kind == "pulse":
        draw.line([(1, 8), (3, 8), (5, 4), (7, 12), (9, 7), (11, 7)], fill=color, width=2)
        draw.line((1, 14, 10, 14), fill=color)
    elif kind == "runes":
        for x in (2, 5, 8):
            draw.line((x, 3, x, 12), fill=color)
            draw.line((x, 3, x + 2, 5), fill=color)
            draw.line((x, 8, x + 2, 10), fill=color)

for name, base, accent, motif in DESIGNS:
    image = Image.new("RGBA", (64, 32), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    # Standard Minecraft cape UV: 10x16 back/front panels plus opaque side strips.
    for y in range(1, 17):
        for x in range(1, 11):
            shade = -14 if (x + y) % 4 == 0 else 0
            color = tuple(max(0, min(255, channel + shade)) for channel in base[:3]) + (255,)
            image.putpixel((x, y), color)
            image.putpixel((x + 11, y), color)
    for x in (0, 11, 22):
        draw.line((x, 1, x, 16), fill=base)
    draw.line((1, 0, 10, 0), fill=base)
    draw.line((12, 0, 21, 0), fill=base)
    pattern(draw, motif, accent)
    # Repeat the motif on the reverse panel so both viewing directions are branded.
    crop = image.crop((1, 1, 11, 17))
    image.paste(crop, (12, 1))
    image.save(OUT / f"lifea-default-{name}.png", optimize=True)

print(f"Generated {len(DESIGNS)} original default capes in {OUT}")
