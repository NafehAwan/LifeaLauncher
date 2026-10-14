"""Generate the original Lifea cosmetic textures (red/ember pixel art) into server/assets/cosmetics.

Capes use the standard 64x32 Minecraft cape layout (front panel at x=1..10, y=1..16; back at x=12..21).
Wings/hats/bandanas/emotes are 32x32 textures consumed by the lifea-core renderer and used as previews.
"""
from PIL import Image, ImageDraw
import os, random

OUT = os.path.join(os.path.dirname(__file__), '..', 'server', 'assets', 'cosmetics')
os.makedirs(OUT, exist_ok=True)
random.seed(7)

def cape(name, base, accent, motif):
    im = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # edges/sides/top/bottom (keep the cape opaque on all faces)
    d.rectangle([0, 0, 22, 17], fill=base)
    for y in range(1, 17):
        for x in range(1, 11):
            shade = 0 if (x + y) % 5 else -18
            c = tuple(max(0, min(255, v + shade + random.randint(-6, 6))) for v in base[:3]) + (255,)
            im.putpixel((x, y), c)
            im.putpixel((x + 11, y), c)
    motif(d, accent)
    im.save(os.path.join(OUT, f'{name}.png'))

def stripe(d, a):
    for x in range(1, 11):
        d.point((x, 14), fill=a); d.point((x, 15), fill=a)
def moon(d, a):
    d.ellipse([3, 4, 8, 9], fill=a)
def flame(d, a):
    for x, h in zip(range(1, 11), [3, 5, 4, 7, 6, 8, 5, 6, 4, 3]):
        d.line([(x, 16), (x, 16 - h)], fill=a)
def lifea(d, a):
    for (x, y) in [(3,4),(3,5),(3,6),(3,7),(3,8),(4,8),(5,8),(7,4),(7,5),(7,6),(7,7),(7,8)]:
        d.point((x, y), fill=a)
    stripe(d, a)

cape('cape-crimson', (155, 15, 28, 255), (255, 59, 74, 255), stripe)
cape('cape-ember', (60, 18, 12, 255), (255, 106, 43, 255), flame)
cape('cape-bloodmoon', (20, 8, 10, 255), (225, 29, 46, 255), moon)
cape('cape-lifea', (110, 8, 18, 255), (255, 214, 102, 255), lifea)

def icon(name, draw):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    draw(ImageDraw.Draw(im))
    im.save(os.path.join(OUT, f'{name}.png'))

icon('wings-ember', lambda d: [d.polygon([(16, 14), (2, 4), (4, 20)], fill=(225, 29, 46, 255)), d.polygon([(16, 14), (30, 4), (28, 20)], fill=(225, 29, 46, 255)), d.line([(16, 14), (4, 8)], fill=(255, 106, 43, 255)), d.line([(16, 14), (28, 8)], fill=(255, 106, 43, 255))])
icon('hat-crown', lambda d: [d.rectangle([6, 18, 25, 24], fill=(225, 29, 46, 255)), d.polygon([(6, 18), (6, 8), (11, 14), (16, 6), (21, 14), (26, 8), (26, 18)], fill=(255, 196, 64, 255)), d.point((16, 12), fill=(225, 29, 46, 255))])
icon('bandana-red', lambda d: [d.rectangle([4, 12, 27, 18], fill=(200, 20, 36, 255)), d.polygon([(22, 18), (28, 26), (24, 18)], fill=(160, 12, 26, 255)), [d.point((x, 15), fill=(255, 255, 255, 255)) for x in range(6, 26, 4)]])
icon('emote-wave', lambda d: [d.rectangle([12, 6, 19, 25], fill=(255, 59, 74, 255)), d.rectangle([8, 10, 11, 14], fill=(255, 59, 74, 255))])
icon('emote-dance', lambda d: [d.ellipse([10, 4, 21, 15], fill=(255, 106, 43, 255)), d.line([(16, 15), (16, 24)], fill=(255, 106, 43, 255), width=3), d.line([(16, 24), (10, 30)], fill=(255, 106, 43, 255), width=2), d.line([(16, 24), (22, 30)], fill=(255, 106, 43, 255), width=2)])
print('wrote', sorted(os.listdir(OUT)))
