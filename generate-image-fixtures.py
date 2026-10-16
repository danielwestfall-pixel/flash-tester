"""Deterministic static PNG test inputs; never plays an animation."""
from pathlib import Path
import json
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent / 'dist' / 'fixture-images'
root.mkdir(exist_ok=True)
colors = {'black': '#000000', 'white': '#FFFFFF', 'red': '#FF0000',
          'blue': '#0000FF', 'gray-b0': '#B0B0B0', 'gray-b8': '#B8B8B8', 'gray-e0': '#E0E0E0'}
for name, color in colors.items():
    Image.new('RGB', (1024, 768), color).save(root / f'{name}.png')
small = Image.new('RGB', (1024, 768), '#000000')
ImageDraw.Draw(small).rectangle((480, 352, 543, 415), fill='#FFFFFF')
small.save(root / 'small-white.png')
manifest = {'size': [1024, 768], 'files': [f'{n}.png' for n in [*colors, 'small-white']],
            'pairExpectations': [
                {'images': ['black', 'white'], 'changesPerSecond': 20, 'reference': 'failure'},
                {'images': ['black', 'white'], 'changesPerSecond': 4, 'reference': 'frequency pass'},
                {'images': ['gray-b0', 'gray-b8'], 'changesPerSecond': 20, 'reference': 'low-delta pass'},
                {'images': ['gray-b0', 'gray-e0'], 'changesPerSecond': 20, 'reference': 'failure'},
                {'images': ['black', 'small-white'], 'changesPerSecond': 20,
                 'reference': 'area pass ONLY at unscaled reference geometry; app still flags candidates'},
                {'images': ['red', 'blue'], 'changesPerSecond': 20, 'reference': 'general and red failure'}],
            'note': 'Static fixtures only. Expectations assume alternating pairs at the stated rate, size and reference geometry; not arbitrary sequences.'}
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Wrote {len(manifest["files"])} static PNG inputs to {root}')
