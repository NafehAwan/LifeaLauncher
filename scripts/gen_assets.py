#!/usr/bin/env python3
"""
LifeaLauncher pixel-art asset generator.

Generates:
- 4 background scenes × 5 parallax layers (1280×720 PNGs with transparency)
- Character sprite: 4 animations × 4 frames = 16 PNGs (32×32)
- Pixel icons (SVG, hand-drawn pixel style)
- Default Steve-style skin PNG (64×64) for skinview3d
- App icon PNG (256×256, later converted to ICO/ICNS)

All scenes use the locked blood + ember palette from §5 of the brief.
"""
from PIL import Image, ImageDraw
import os
import random
import math

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC = os.path.join(ROOT, 'public')
BUILD = os.path.join(ROOT, 'build')

# Locked palette from §5
PAL = {
    'bg_app':        (20, 8, 10, 255),
    'bg_sidebar':    (28, 13, 15, 255),
    'bg_panel':      (33, 18, 21, 255),
    'bg_panel_2':    (43, 22, 26, 255),
    'bg_input':      (26, 10, 12, 255),
    'bg_terminal':   (10, 4, 5, 255),
    'accent':        (139, 0, 0, 255),       # blood
    'accent_bright': (183, 28, 28, 255),
    'accent_glow':   (239, 68, 68, 255),
    'accent_deep':   (93, 0, 0, 255),
    'ember':         (255, 69, 0, 255),
    'ember_bright':  (255, 107, 53, 255),
    'warm':          (255, 193, 7, 255),
    'text':          (245, 230, 230, 255),
    'text_muted':    (160, 133, 133, 255),
    'text_dim':      (107, 83, 83, 255),
    'transparent':   (0, 0, 0, 0),
}

W, H = 1280, 720  # scene size
CHAR = 32         # character sprite size


def lerp_color(a, b, t):
    """Linear interpolation between two RGBA colors."""
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(4))


def fill_sky(top, bottom):
    """Vertical gradient sky."""
    img = Image.new('RGBA', (W, H), PAL['transparent'])
    px = img.load()
    for y in range(H):
        t = y / H
        c = lerp_color(top, bottom, t)
        for x in range(W):
            px[x, y] = c
    return img


def draw_sun(img, cx, cy, r, color_core, color_halo):
    """Draw a pixel-art sun/disc with halo (concentric circles, no AA)."""
    d = ImageDraw.Draw(img)
    # Outer halo (3 rings of decreasing alpha)
    for i, alpha in enumerate([40, 80, 140]):
        ring_color = (*color_halo[:3], alpha)
        for angle in range(0, 360, 2):
            rad = math.radians(angle)
            for rr in range(r + 4 + i * 4, r + 8 + i * 4):
                x = int(cx + rr * math.cos(rad))
                y = int(cy + rr * math.sin(rad))
                if 0 <= x < W and 0 <= y < H:
                    img.putpixel((x, y), ring_color)
    # Solid disc
    for y in range(-r, r + 1):
        for x in range(-r, r + 1):
            if x * x + y * y <= r * r:
                xx, yy = cx + x, cy + y
                if 0 <= xx < W and 0 <= yy < H:
                    # Subtle gradient: brighter in center
                    t = math.sqrt(x * x + y * y) / r
                    c = lerp_color(color_core, color_halo, t * 0.6)
                    img.putpixel((xx, yy), c)


def draw_dunes(img, base_y, amplitude, color_top, color_bottom, seed=0):
    """Draw a band of dune silhouettes from base_y downward."""
    rng = random.Random(seed)
    # Generate dune heights via layered sine waves for natural look.
    px = img.load()
    for x in range(W):
        # Layered sines for dune profile
        y = base_y + int(
            amplitude * math.sin(x * 0.008 + seed) * 0.6
            + amplitude * 0.4 * math.sin(x * 0.021 + seed * 1.7)
            + amplitude * 0.25 * math.sin(x * 0.045 + seed * 0.3)
        )
        # Fill downward
        for yy in range(y, H):
            t = (yy - y) / max(1, H - y)
            c = lerp_color(color_top, color_bottom, t)
            px[x, yy] = c
    return img


def draw_cacti(img, color, count=8, seed=42):
    """Draw pixel-art saguaro cactus silhouettes along the bottom."""
    rng = random.Random(seed)
    d = ImageDraw.Draw(img)
    base_y = H - 40
    for _ in range(count):
        x = rng.randint(20, W - 40)
        h = rng.randint(40, 90)
        w = 8
        # Trunk
        for yy in range(base_y - h, base_y):
            for xx in range(x, x + w):
                if 0 <= xx < W and 0 <= yy < H:
                    img.putpixel((xx, yy), color)
        # Arms (left + right)
        arm_h = h // 2
        arm_w = 10
        for xx in range(x - arm_w, x):
            for yy in range(base_y - h + arm_h, base_y - h + arm_h + 20):
                if 0 <= xx < W and 0 <= yy < H:
                    img.putpixel((xx, yy), color)
        for xx in range(x + w, x + w + arm_w):
            for yy in range(base_y - h + arm_h + 10, base_y - h + arm_h + 30):
                if 0 <= xx < W and 0 <= yy < H:
                    img.putpixel((xx, yy), color)


def draw_clouds(img, count=4, seed=1, color=(80, 40, 40, 180)):
    """Draw a few pixel cloud blobs in the upper area."""
    rng = random.Random(seed)
    for _ in range(count):
        cx = rng.randint(0, W)
        cy = rng.randint(60, 220)
        cw = rng.randint(80, 160)
        ch = rng.randint(20, 36)
        # Cloud = rectangle with bumpy top
        for y in range(cy, cy + ch):
            for x in range(cx, cx + cw):
                if 0 <= x < W and 0 <= y < H:
                    # Bumpy top edge
                    if y < cy + 4 and (x % 12) < 6:
                        continue
                    img.putpixel((x, y), color)


def draw_embers(img, count=80, seed=2, color=(255, 107, 53, 200)):
    """Floating ember particles."""
    rng = random.Random(seed)
    for _ in range(count):
        x = rng.randint(0, W - 1)
        y = rng.randint(0, H - 1)
        size = rng.choice([1, 1, 1, 2])
        for dy in range(size):
            for dx in range(size):
                xx, yy = x + dx, y + dy
                if 0 <= xx < W and 0 <= yy < H:
                    a = rng.randint(80, 220)
                    img.putpixel((xx, yy), (*color[:3], a))


def draw_sandstorm(img, count=400, seed=3, color=(139, 0, 0, 100)):
    """Heavy diagonal sand streaks."""
    rng = random.Random(seed)
    for _ in range(count):
        x = rng.randint(0, W - 1)
        y = rng.randint(0, H - 1)
        length = rng.randint(20, 80)
        for i in range(length):
            xx = x + i
            yy = y + i // 3
            if 0 <= xx < W and 0 <= yy < H:
                a = rng.randint(40, 120)
                img.putpixel((xx, yy), (*color[:3], a))


# ============================================================
# SCENE GENERATORS
# ============================================================

def gen_blood_dunes():
    """Blood Dunes: dark red sky, blood-orange sun, deep red dunes, cacti silhouettes."""
    out = os.path.join(PUBLIC, 'scenes', 'blood_dunes')
    os.makedirs(out, exist_ok=True)

    # Layer 1: sky + sun
    sky = fill_sky(PAL['bg_app'], PAL['accent_deep'])
    draw_sun(sky, cx=900, cy=180, r=60,
             color_core=PAL['ember_bright'], color_halo=PAL['ember'])
    sky.save(os.path.join(out, 'sky.png'))

    # Layer 2: clouds
    clouds = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_clouds(clouds, count=5, seed=11, color=(60, 30, 30, 160))
    clouds.save(os.path.join(out, 'clouds.png'))

    # Layer 3: far dunes
    far = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_dunes(far, base_y=420, amplitude=30,
               color_top=PAL['accent_deep'], color_bottom=PAL['bg_app'], seed=1)
    far.save(os.path.join(out, 'dunes_far.png'))

    # Layer 4: near dunes
    near = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_dunes(near, base_y=520, amplitude=50,
               color_top=PAL['accent'], color_bottom=PAL['accent_deep'], seed=2)
    near.save(os.path.join(out, 'dunes_near.png'))

    # Layer 5: cacti
    cacti = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_cacti(cacti, color=PAL['bg_terminal'], count=10, seed=42)
    cacti.save(os.path.join(out, 'cacti.png'))

    # Composite for placeholder-bg.png (used by Home route)
    composite = Image.new('RGBA', (W, H), PAL['transparent'])
    for layer in ['sky.png', 'clouds.png', 'dunes_far.png', 'dunes_near.png', 'cacti.png']:
        composite = Image.alpha_composite(composite, Image.open(os.path.join(out, layer)).convert('RGBA'))
    composite.save(os.path.join(PUBLIC, 'scenes', 'placeholder-bg.png'))
    print('✓ blood_dunes (5 layers + composite)')


def gen_ember_night():
    """Ember Night: very dark sky, glowing ember moon, floating embers."""
    out = os.path.join(PUBLIC, 'scenes', 'ember_night')
    os.makedirs(out, exist_ok=True)

    sky = fill_sky((8, 4, 6, 255), (40, 14, 16, 255))
    draw_sun(sky, cx=300, cy=150, r=45,
             color_core=PAL['ember_bright'], color_halo=PAL['ember'])
    sky.save(os.path.join(out, 'sky.png'))

    clouds = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_clouds(clouds, count=3, seed=22, color=(30, 12, 14, 180))
    clouds.save(os.path.join(out, 'clouds.png'))

    far = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_dunes(far, base_y=480, amplitude=20,
               color_top=(60, 16, 18, 255), color_bottom=(10, 4, 6, 255), seed=3)
    far.save(os.path.join(out, 'dunes_far.png'))

    near = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_dunes(near, base_y=560, amplitude=40,
               color_top=PAL['accent_deep'], color_bottom=(20, 8, 10, 255), seed=4)
    near.save(os.path.join(out, 'dunes_near.png'))

    embers = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_embers(embers, count=120, seed=33)
    embers.save(os.path.join(out, 'embers.png'))

    # Replace cacti layer with embers for this theme
    # (BackgroundCanvas will fall back to embers.png if cacti.png missing)
    print('✓ ember_night (5 layers: sky, clouds, far, near, embers)')


def gen_ash_oasis():
    """Ash Oasis: muted grey-red, glowing red pool in foreground."""
    out = os.path.join(PUBLIC, 'scenes', 'ash_oasis')
    os.makedirs(out, exist_ok=True)

    sky = fill_sky((40, 30, 32, 255), (60, 35, 38, 255))
    sky.save(os.path.join(out, 'sky.png'))

    clouds = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_clouds(clouds, count=6, seed=44, color=(50, 38, 40, 180))
    clouds.save(os.path.join(out, 'clouds.png'))

    far = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_dunes(far, base_y=460, amplitude=25,
               color_top=(80, 55, 58, 255), color_bottom=(40, 28, 30, 255), seed=5)
    far.save(os.path.join(out, 'dunes_far.png'))

    # Glowing red pool as near layer
    near = Image.new('RGBA', (W, H), PAL['transparent'])
    d = ImageDraw.Draw(near)
    # Pool: ellipse at bottom center
    for y in range(540, H):
        for x in range(280, W - 280):
            # Distance from pool center (640, 640)
            dx = (x - 640) / 360
            dy = (y - 640) / 80
            d_norm = math.sqrt(dx * dx + dy * dy)
            if d_norm < 1:
                t = d_norm
                c = lerp_color(PAL['ember'], PAL['accent_deep'], t)
                near.putpixel((x, y), c)
    near.save(os.path.join(out, 'dunes_near.png'))

    # Cacti as 5th layer
    cacti = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_cacti(cacti, color=(50, 35, 38, 255), count=6, seed=55)
    cacti.save(os.path.join(out, 'cacti.png'))

    print('✓ ash_oasis (5 layers)')


def gen_emberstorm():
    """Emberstorm: heavy red sandstorm over dark dunes."""
    out = os.path.join(PUBLIC, 'scenes', 'emberstorm')
    os.makedirs(out, exist_ok=True)

    sky = fill_sky((20, 8, 10, 255), PAL['accent_deep'])
    sky.save(os.path.join(out, 'sky.png'))

    # Clouds replaced by storm streaks
    storm1 = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_sandstorm(storm1, count=300, seed=66, color=PAL['accent'])
    storm1.save(os.path.join(out, 'clouds.png'))

    far = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_dunes(far, base_y=440, amplitude=30,
               color_top=PAL['accent_deep'], color_bottom=(20, 8, 10, 255), seed=7)
    far.save(os.path.join(out, 'dunes_far.png'))

    near = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_dunes(near, base_y=540, amplitude=50,
               color_top=PAL['accent'], color_bottom=PAL['accent_deep'], seed=8)
    near.save(os.path.join(out, 'dunes_near.png'))

    # Heavy storm streaks as 5th layer
    storm2 = Image.new('RGBA', (W, H), PAL['transparent'])
    draw_sandstorm(storm2, count=500, seed=77, color=PAL['ember'])
    storm2.save(os.path.join(out, 'cacti.png'))

    print('✓ emberstorm (5 layers)')


# ============================================================
# CHARACTER SPRITE
# ============================================================

def draw_character_blocky(img, frame, anim, ox=0, oy=0, color_body=(60, 110, 200, 255),
                          color_head=(220, 180, 140, 255), color_shirt=(110, 50, 50, 255),
                          color_pants=(50, 50, 90, 255), color_shoes=(30, 20, 20, 255)):
    """
    Draw a 32×32 blocky character (Minecraft Steve-like, blue shirt for contrast).
    anim: 'idle' | 'walk' | 'wave' | 'dance'
    frame: 0..3
    ox, oy: pixel offset within the 32×32 frame
    """
    px = img.load()
    # Body parts (Minecraft proportions):
    # Head: 8×8×8 in 3D, but we render 2D — 12 wide × 12 tall
    # Body: 8 wide × 12 tall
    # Arms: 4 wide × 12 tall (one on each side)
    # Legs: 4 wide × 12 tall (two)

    # Layout (origin top-left of character, character fills 16..28 horizontal, 4..28 vertical):
    cx = 8  # character x offset within 32px frame
    cy = 4  # character y offset

    # Animation offsets
    bob = 0
    arm_offset = 0
    leg_offset = 0
    arm_raise = 0

    if anim == 'idle':
        # Subtle breathing
        bob = -1 if frame in (0, 2) else 0
    elif anim == 'walk':
        # Legs swing, slight bob
        bob = -1 if frame in (0, 2) else 0
        leg_offset = 2 if frame in (0, 1) else -2
        arm_offset = -2 if frame in (0, 1) else 2
    elif anim == 'wave':
        # Right arm raises up
        arm_raise = -6 + (frame * 2) % 8
        bob = -1 if frame == 1 else 0
    elif anim == 'dance':
        # Hips sway, arms up
        bob = -2 + (frame % 2) * 2
        arm_raise = -8 + (frame % 2) * 4

    # HEAD (12×12)
    for y in range(12):
        for x in range(12):
            xx = cx + x + ox
            yy = cy + y + oy + bob
            if 0 <= xx < 32 and 0 <= yy < 32:
                # Face features: eyes at (3, 5) and (7, 5), mouth at (4..7, 8)
                if (x, y) in [(3, 5), (4, 5), (7, 5), (8, 5)]:
                    px[xx, yy] = (30, 20, 20, 255)  # eyes
                elif 4 <= x <= 7 and y == 8:
                    px[xx, yy] = (140, 80, 60, 255)  # mouth
                elif x == 0 or x == 11 or y == 0 or y == 11:
                    px[xx, yy] = lerp_color(color_head, (0, 0, 0, 255), 0.3)  # outline
                else:
                    px[xx, yy] = color_head

    # BODY / SHIRT (8×12, centered below head)
    body_y = cy + 12 + bob
    for y in range(12):
        for x in range(8):
            xx = cx + 2 + x + ox
            yy = body_y + y + oy
            if 0 <= xx < 32 and 0 <= yy < 32:
                if x == 0 or x == 7 or y == 0 or y == 11:
                    px[xx, yy] = lerp_color(color_shirt, (0, 0, 0, 255), 0.4)
                else:
                    px[xx, yy] = color_shirt

    # ARMS (4×12, one on each side of body)
    arm_y = cy + 12 + bob
    # Left arm
    for y in range(12):
        for x in range(4):
            xx = cx - 2 + x + ox
            yy = arm_y + y + oy + (arm_offset if anim == 'walk' else 0)
            if 0 <= xx < 32 and 0 <= yy < 32:
                px[xx, yy] = color_shirt if y < 8 else color_head  # hand at bottom
    # Right arm
    for y in range(12):
        for x in range(4):
            xx = cx + 10 + x + ox
            yy = arm_y + y + oy + arm_raise + (-arm_offset if anim == 'walk' else 0)
            if 0 <= xx < 32 and 0 <= yy < 32:
                px[xx, yy] = color_shirt if y < 8 else color_head

    # LEGS (4×12, two, below body)
    leg_y = cy + 24 + bob
    # Left leg
    for y in range(8):
        for x in range(4):
            xx = cx + 2 + x + ox
            yy = leg_y + y + oy + (leg_offset if anim == 'walk' else 0)
            if 0 <= xx < 32 and 0 <= yy < 32:
                px[xx, yy] = color_pants
    # Right leg
    for y in range(8):
        for x in range(4):
            xx = cx + 6 + x + ox
            yy = leg_y + y + oy + (-leg_offset if anim == 'walk' else 0)
            if 0 <= xx < 32 and 0 <= yy < 32:
                px[xx, yy] = color_pants
    # Shoes (1px at bottom of each leg)
    for x in range(4):
        xx1 = cx + 2 + x + ox
        xx2 = cx + 6 + x + ox
        yy = leg_y + 8 + oy + (leg_offset if anim == 'walk' else 0)
        if 0 <= xx1 < 32 and 0 <= yy < 32:
            px[xx1, yy] = color_shoes
        yy = leg_y + 8 + oy + (-leg_offset if anim == 'walk' else 0)
        if 0 <= xx2 < 32 and 0 <= yy < 32:
            px[xx2, yy] = color_shoes


def gen_character():
    out = os.path.join(PUBLIC, 'sprites', 'character')
    os.makedirs(out, exist_ok=True)
    for anim in ['idle', 'walk', 'wave', 'dance']:
        for frame in range(4):
            img = Image.new('RGBA', (CHAR, CHAR), PAL['transparent'])
            draw_character_blocky(img, frame=frame, anim=anim)
            img.save(os.path.join(out, f'{anim}_{frame}.png'))
    print(f'✓ character sprites (4 anims × 4 frames = 16 PNGs)')


# ============================================================
# DEFAULT SKIN (for skinview3d)
# ============================================================

def gen_default_skin():
    """64×64 Minecraft skin PNG (Steve-like, blue shirt for red-theme contrast)."""
    img = Image.new('RGBA', (64, 64), PAL['transparent'])
    px = img.load()

    # Minecraft skin layout (since 1.8):
    # Head: (0,0) 8×8 front, (8,8) overlay
    # Body: (16,16) 8×12 front
    # Right arm: (40,16) 8×12 (top), (44,20) 4×12 front
    # Left arm: (32,48) 8×12 (top), (36,52) 4×12 front
    # Right leg: (0,16) 8×12 (top), (4,20) 4×12 front
    # Left leg: (16,48) 8×12 (top), (20,52) 4×12 front

    skin = (220, 180, 140, 255)    # skin tone
    shirt = (70, 100, 200, 255)    # blue shirt
    pants = (50, 50, 100, 255)     # blue pants
    shoes = (40, 25, 25, 255)
    hair = (60, 40, 30, 255)
    eye = (30, 20, 20, 255)

    # Helper to fill a rectangle
    def fill(rx, ry, rw, rh, color):
        for y in range(rh):
            for x in range(rw):
                px[rx + x, ry + y] = color

    # Head (front: 8,8 to 16,16)
    fill(8, 8, 8, 8, skin)
    # Hair top
    fill(8, 8, 8, 2, hair)
    fill(8, 8, 2, 8, hair)
    fill(14, 8, 2, 8, hair)
    # Eyes
    px[10, 11] = eye
    px[11, 11] = eye
    px[13, 11] = eye
    px[14, 11] = eye
    # Mouth
    fill(10, 13, 4, 1, (140, 80, 60, 255))

    # Body (front: 20, 20 to 28, 32)
    fill(20, 20, 8, 12, shirt)

    # Right arm (front: 44, 20 to 48, 32)
    fill(44, 20, 4, 12, shirt)
    fill(44, 28, 4, 4, skin)  # hand

    # Left arm (front: 36, 52 to 40, 64)
    fill(36, 52, 4, 12, shirt)
    fill(36, 60, 4, 4, skin)

    # Right leg (front: 4, 20 to 8, 32)
    fill(4, 20, 4, 12, pants)
    fill(4, 28, 4, 4, shoes)

    # Left leg (front: 20, 52 to 24, 64)
    fill(20, 52, 4, 12, pants)
    fill(20, 60, 4, 4, shoes)

    img.save(os.path.join(PUBLIC, 'skins', 'default.png'))
    print('✓ default skin (64×64)')


# ============================================================
# PIXEL ICONS (SVG, hand-drawn pixel style)
# ============================================================

def gen_icons():
    out = os.path.join(PUBLIC, 'icons')
    os.makedirs(out, exist_ok=True)

    # logo.svg — pixel shield with crossed sword + pickaxe
    logo = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect x="3" y="1" width="10" height="1" fill="#8b0000"/>
  <rect x="2" y="2" width="12" height="1" fill="#8b0000"/>
  <rect x="1" y="3" width="14" height="1" fill="#b71c1c"/>
  <rect x="1" y="4" width="14" height="1" fill="#b71c1c"/>
  <rect x="1" y="5" width="14" height="6" fill="#5d0000"/>
  <rect x="2" y="11" width="12" height="1" fill="#5d0000"/>
  <rect x="3" y="12" width="10" height="1" fill="#5d0000"/>
  <rect x="4" y="13" width="8" height="1" fill="#5d0000"/>
  <rect x="6" y="14" width="4" height="1" fill="#5d0000"/>
  <!-- Sword (crossed, white blade) -->
  <rect x="7" y="3" width="2" height="8" fill="#f5e6e6"/>
  <rect x="5" y="10" width="6" height="1" fill="#ffc107"/>
  <rect x="7" y="11" width="2" height="2" fill="#8b0000"/>
  <!-- Pickaxe (crossed) -->
  <rect x="3" y="6" width="10" height="1" fill="#a08585"/>
  <rect x="3" y="5" width="1" height="1" fill="#a08585"/>
  <rect x="12" y="5" width="1" height="1" fill="#a08585"/>
</svg>'''
    with open(os.path.join(out, 'logo.svg'), 'w') as f:
        f.write(logo)

    # instance-default.svg — pixel diamond
    instance_default = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="5" y="1" width="2" height="1" fill="#ef4444"/>
  <rect x="4" y="2" width="4" height="1" fill="#b71c1c"/>
  <rect x="3" y="3" width="6" height="1" fill="#8b0000"/>
  <rect x="2" y="4" width="8" height="1" fill="#8b0000"/>
  <rect x="3" y="5" width="6" height="1" fill="#8b0000"/>
  <rect x="2" y="6" width="8" height="1" fill="#5d0000"/>
  <rect x="1" y="7" width="10" height="1" fill="#5d0000"/>
  <rect x="2" y="8" width="8" height="1" fill="#3d2226"/>
  <rect x="3" y="9" width="6" height="1" fill="#3d2226"/>
  <rect x="4" y="10" width="4" height="1" fill="#3d2226"/>
  <rect x="5" y="11" width="2" height="1" fill="#3d2226"/>
</svg>'''
    with open(os.path.join(out, 'instance-default.svg'), 'w') as f:
        f.write(instance_default)

    # instance-fabric.svg — pixel fabric logo (stylized)
    instance_fabric = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="2" y="2" width="8" height="8" fill="#8b0000"/>
  <rect x="3" y="3" width="6" height="6" fill="#5d0000"/>
  <rect x="4" y="4" width="4" height="4" fill="#b71c1c"/>
  <rect x="5" y="5" width="2" height="2" fill="#ef4444"/>
</svg>'''
    with open(os.path.join(out, 'instance-fabric.svg'), 'w') as f:
        f.write(instance_fabric)

    # cactus-empty.svg — green pixel cactus
    cactus = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="5" y="1" width="2" height="9" fill="#4ade80"/>
  <rect x="2" y="4" width="1" height="3" fill="#4ade80"/>
  <rect x="2" y="6" width="3" height="1" fill="#4ade80"/>
  <rect x="9" y="3" width="1" height="3" fill="#4ade80"/>
  <rect x="7" y="5" width="3" height="1" fill="#4ade80"/>
  <rect x="3" y="10" width="6" height="1" fill="#6b5353"/>
  <rect x="4" y="11" width="4" height="1" fill="#3d2226"/>
</svg>'''
    with open(os.path.join(out, 'cactus-empty.svg'), 'w') as f:
        f.write(cactus)

    # Mod logos: sodium, lithium, iris (simple pixel badges)
    sodium = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="2" y="2" width="8" height="8" fill="#8b0000"/>
  <rect x="3" y="3" width="6" height="6" fill="#b71c1c"/>
  <rect x="4" y="4" width="4" height="4" fill="#ef4444"/>
  <text x="6" y="8" font-family="monospace" font-size="3" fill="#f5e6e6" text-anchor="middle">Na</text>
</svg>'''
    with open(os.path.join(out, 'sodium.svg'), 'w') as f:
        f.write(sodium)

    lithium = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="2" y="2" width="8" height="8" fill="#5d0000"/>
  <rect x="3" y="3" width="6" height="6" fill="#8b0000"/>
  <rect x="4" y="4" width="4" height="4" fill="#b71c1c"/>
  <text x="6" y="8" font-family="monospace" font-size="3" fill="#f5e6e6" text-anchor="middle">Li</text>
</svg>'''
    with open(os.path.join(out, 'lithium.svg'), 'w') as f:
        f.write(lithium)

    iris = '''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="2" y="2" width="8" height="8" fill="#ff4500"/>
  <rect x="3" y="3" width="6" height="6" fill="#8b0000"/>
  <rect x="4" y="4" width="4" height="4" fill="#ff6b35"/>
  <rect x="5" y="5" width="2" height="2" fill="#ffc107"/>
</svg>'''
    with open(os.path.join(out, 'iris.svg'), 'w') as f:
        f.write(iris)

    # Stat icons (ram, cpu, heap, gc) — pixel badges
    for name, label, color in [
        ('ram', 'RAM', PAL['accent']),
        ('cpu', 'CPU', PAL['ember']),
        ('heap', 'HEP', PAL['accent_bright']),
        ('gc',  'GC',  PAL['warm']),
    ]:
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="2" y="3" width="8" height="6" fill="{color}"/>
  <rect x="3" y="2" width="1" height="1" fill="{color}"/>
  <rect x="5" y="2" width="1" height="1" fill="{color}"/>
  <rect x="7" y="2" width="1" height="1" fill="{color}"/>
  <rect x="9" y="2" width="1" height="1" fill="{color}"/>
</svg>'''
        with open(os.path.join(out, f'{name}.svg'), 'w') as f:
            f.write(svg)

    # Wardrobe placeholders
    for kind in ['cape-default', 'skin-default']:
        svg = f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 12 12" shape-rendering="crispEdges">
  <rect x="2" y="2" width="8" height="8" fill="#2b161a"/>
  <rect x="3" y="3" width="6" height="6" fill="#8b0000"/>
  <rect x="4" y="4" width="4" height="4" fill="#5d0000"/>
</svg>'''
        with open(os.path.join(out, f'{kind}.svg'), 'w') as f:
            f.write(svg)

    print(f'✓ pixel icons ({len(os.listdir(out))} SVGs)')


# ============================================================
# APP ICON (256×256 PNG, later converted to ICO/ICNS)
# ============================================================

def gen_app_icon():
    """Generate 256×256 app icon (logo on dark bg)."""
    size = 256
    img = Image.new('RGBA', (size, size), PAL['bg_app'])
    # Scale up the logo concept: red shield + sword
    d = ImageDraw.Draw(img)
    # Shield shape (pixel blocks)
    scale = 16  # 256/16
    # Background fill
    for y in range(size):
        for x in range(size):
            img.putpixel((x, y), PAL['bg_app'])

    # Shield outline
    shield_pixels = [
        (3, 1), (4, 1), (5, 1), (6, 1), (7, 1), (8, 1), (9, 1), (10, 1), (11, 1), (12, 1),
        (2, 2), (3, 2), (4, 2), (5, 2), (6, 2), (7, 2), (8, 2), (9, 2), (10, 2), (11, 2), (12, 2), (13, 2),
        (1, 3), (2, 3), (3, 3), (4, 3), (5, 3), (6, 3), (7, 3), (8, 3), (9, 3), (10, 3), (11, 3), (12, 3), (13, 3), (14, 3),
        (1, 4), (2, 4), (3, 4), (4, 4), (5, 4), (6, 4), (7, 4), (8, 4), (9, 4), (10, 4), (11, 4), (12, 4), (13, 4), (14, 4),
    ]
    for y in range(5, 11):
        for x in range(1, 15):
            shield_pixels.append((x, y))
    for x, y in [(2, 11), (3, 11), (4, 11), (5, 11), (6, 11), (7, 11), (8, 11), (9, 11), (10, 11), (11, 11), (12, 11), (13, 11)]:
        shield_pixels.append((x, y))
    for x, y in [(3, 12), (4, 12), (5, 12), (6, 12), (7, 12), (8, 12), (9, 12), (10, 12), (11, 12), (12, 12)]:
        shield_pixels.append((x, y))
    for x, y in [(4, 13), (5, 13), (6, 13), (7, 13), (8, 13), (9, 13), (10, 13), (11, 13)]:
        shield_pixels.append((x, y))
    for x, y in [(5, 14), (6, 14), (7, 14), (8, 14), (9, 14), (10, 14)]:
        shield_pixels.append((x, y))
    for x, y in [(6, 15), (7, 15), (8, 15), (9, 15)]:
        shield_pixels.append((x, y))
    for x, y in [(7, 16), (8, 16)]:
        shield_pixels.append((x, y))

    # Fill shield with blood red gradient
    for x, y in shield_pixels:
        # Use accent_deep on edges, accent in middle
        c = PAL['accent']
        if x in (1, 14) or y in (1, 16):
            c = PAL['accent_deep']
        elif x in (2, 13) or y in (2, 15):
            c = lerp_color(PAL['accent'], PAL['accent_deep'], 0.5)
        # Draw scale×scale block
        for dy in range(scale):
            for dx in range(scale):
                xx = x * scale + dx
                yy = y * scale + dy
                if 0 <= xx < size and 0 <= yy < size:
                    img.putpixel((xx, yy), c)

    # White sword blade vertical center
    sword_x = 7  # 8-wide center column
    for y in range(3, 13):
        for dy in range(scale):
            for dx in range(scale // 2):
                xx = sword_x * scale + dx + scale // 4
                yy = y * scale + dy
                if 0 <= xx < size and 0 <= yy < size:
                    img.putpixel((xx, yy), PAL['text'])

    # Gold crossguard
    for x in range(5, 10):
        for dy in range(scale):
            for dx in range(scale):
                xx = x * scale + dx
                yy = 10 * scale + dy
                if 0 <= xx < size and 0 <= yy < size:
                    img.putpixel((xx, yy), PAL['warm'])

    # Red handle
    for y in range(11, 13):
        for dy in range(scale):
            for dx in range(scale // 2):
                xx = sword_x * scale + dx + scale // 4
                yy = y * scale + dy
                if 0 <= xx < size and 0 <= yy < size:
                    img.putpixel((xx, yy), PAL['accent_bright'])

    img.save(os.path.join(BUILD, 'icon.png'))

    # Generate .ico (multi-resolution) using PIL
    ico_sizes = [16, 32, 48, 64, 128, 256]
    ico_images = []
    for s in ico_sizes:
        ico_images.append(img.resize((s, s), Image.NEAREST))
    ico_images[0].save(os.path.join(BUILD, 'icon.ico'), format='ICO',
                       sizes=[(s, s) for s in ico_sizes],
                       append_images=ico_images[1:])
    print('✓ app icon (PNG 256×256 + ICO multi-res)')


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    print('Generating pixel-art assets for LifeaLauncher...')
    gen_blood_dunes()
    gen_ember_night()
    gen_ash_oasis()
    gen_emberstorm()
    gen_character()
    gen_default_skin()
    gen_icons()
    gen_app_icon()
    print('\nAll assets generated.')
