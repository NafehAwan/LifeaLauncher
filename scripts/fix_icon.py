#!/usr/bin/env python3
"""Regenerate icon.ico with proper multi-resolution support (256×256 largest)."""
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(ROOT, 'build')

# Source: 256×256 PNG
src = Image.open(os.path.join(BUILD, 'icon.png')).convert('RGBA')
print(f'Source icon: {src.size}, mode={src.mode}')

# Generate .ico with all standard Windows sizes (largest first)
ico_sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)]
src.save(
    os.path.join(BUILD, 'icon.ico'),
    format='ICO',
    sizes=ico_sizes,
)
print(f'✓ icon.ico written with sizes: {[s[0] for s in ico_sizes]}')

# Verify
ico = Image.open(os.path.join(BUILD, 'icon.ico'))
print(f'✓ icon.ico opened: size={ico.size}')
