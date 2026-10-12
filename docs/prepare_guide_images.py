"""Crop genuine app captures for print, without resampling or upscaling."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / 'docs/images/retina'
OUT = RAW / 'processed'
OUT.mkdir(exist_ok=True)
# Crops retain the original pixels. Record-panel crops omit the personal
# computer path and focus on the relevant controls. No UI is reconstructed.
specs = {
 'workspace': ('workspace-native.png', (0, 78, 2400, 1958)),
 'cover': ('workspace-native.png', (330, 480, 2050, 1330)),
 'node-closeup': ('workspace-native.png', (940, 675, 1460, 1095)),
 'board-tools': ('workspace-native.png', (858, 1698, 1540, 1818)),
}
capture_metadata = {entry['name']: entry for entry in json.loads(
    (RAW / 'high-resolution/source-manifest.json').read_text())}
specs.update({name: ('high-resolution/' + name + '.png', None)
              for name in capture_metadata})
manifest = []
for name, (source, crop) in specs.items():
    im = Image.open(RAW / source).convert('RGB')
    original = im.size
    if crop:
        assert 0 <= crop[0] < crop[2] <= im.width and 0 <= crop[1] < crop[3] <= im.height, (name, im.size, crop)
        im = im.crop(crop)
    im.save(OUT / (name + '.png'))
    manifest.append({'name': name, 'source': source, 'sourcePixels': original, 'crop': crop,
                     'pixels': im.size, 'resampled': False,
                     **({'capture': capture_metadata[name]} if name in capture_metadata else {})})
(OUT / 'capture-manifest.json').write_text(json.dumps({'appVersion': '0.3.3', 'capturedAt': '2026-10-11', 'evidence': 'Fictional Harbor Tutorial only', 'images': manifest}, indent=2))
print(f'Prepared {len(manifest)} screenshots without resampling.')
