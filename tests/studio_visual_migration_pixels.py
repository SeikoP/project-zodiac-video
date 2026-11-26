"""Compare actual Remotion/HF samples. Requires Pillow; no perceptual PASS from blank frames."""
import hashlib
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(sys.argv[1] if len(sys.argv) > 1 else '.runtime/visual-migration')
source = json.loads((root / 'samples.json').read_text('utf8'))
rows = []
for row in source['results']:
    with Image.open(root / row['remotion']) as reference, Image.open(root / row['candidate']) as candidate:
        assert reference.size == candidate.size == (1080, 1920)
        reference, candidate = reference.convert('RGB'), candidate.convert('RGB')
        assert sum(ImageStat.Stat(reference).var) > 100, 'Empty reference cannot establish parity'
        difference = ImageChops.difference(reference, candidate)
        mean = sum(ImageStat.Stat(difference).mean) / 3
        changed = sum(n for value, n in enumerate(difference.convert('L').histogram()) if value > 8)
        fraction = changed / (1080 * 1920)
        rows.append({**{k: row[k] for k in ('scene_id', 'frame', 'kind')},
                     'mean_channel_error': mean, 'changed_pixel_fraction_above_8': fraction,
                     'reference_sha256': hashlib.sha256((root / row['remotion']).read_bytes()).hexdigest(),
                     'candidate_sha256': hashlib.sha256((root / row['candidate']).read_bytes()).hexdigest()})
report = {'format': 'zodiac-renderer-parity-pixels@1', 'comparisons': len(rows),
          'max_mean_channel_error': max(r['mean_channel_error'] for r in rows),
          'max_changed_pixel_fraction_above_8': max(r['changed_pixel_fraction_above_8'] for r in rows),
          'limits': {'mean_channel_error': .1, 'changed_pixel_fraction_above_8': .001},
          'human_approval': 'PENDING', 'samples': rows}
(root / 'pixels.json').write_text(json.dumps(report, indent=2), encoding='utf8')
assert report['max_mean_channel_error'] <= .1, report['max_mean_channel_error']
assert report['max_changed_pixel_fraction_above_8'] <= .001, report['max_changed_pixel_fraction_above_8']
print(json.dumps({k: v for k, v in report.items() if k != 'samples'}))
