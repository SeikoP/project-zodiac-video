"""Execute the workflow's PowerShell body with a failing P2 test process."""
import shutil
import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path


class StudioCITests(unittest.TestCase):
    def test_windows_checkout_preserves_hash_bound_library_art(self):
        library = Path('plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4')
        catalog = json.loads((library / 'scene-set/accents/index.json').read_text(encoding='utf-8'))
        with tempfile.TemporaryDirectory() as temp:
            for asset in catalog['accents']:
                relative = library / 'scene-set' / asset['path']
                subprocess.run(['git', '-c', 'core.autocrlf=true', 'checkout-index',
                                '--prefix=' + Path(temp).as_posix() + '/', '--', relative.as_posix()],
                               check=True, capture_output=True)
                actual = hashlib.sha256((Path(temp) / relative).read_bytes()).hexdigest()
                self.assertEqual(actual, asset['asset_sha256'], asset['id'])

    @unittest.skipUnless(shutil.which('pwsh'), 'PowerShell required')
    def test_p2_failure_stops_before_later_suites(self):
        text = Path('.github/workflows/studio-v5-tauri-p1.yml').read_text(encoding='utf-8')
        block = text.split('name: Python P0/P1 contracts and integration', 1)[1]
        body = block.split('run: |\n', 1)[1].split('\n      - ', 1)[0]
        body = '\n'.join(line[10:] for line in body.splitlines())
        stub = '''
function python {
    Write-Output ($args -join ' ')
    $global:LASTEXITCODE = if (($args -join ' ') -like '*test_studio_p2_*') { 23 } else { 0 }
}
function node { $global:LASTEXITCODE = 0 }
'''
        result = subprocess.run(['pwsh', '-NoProfile', '-Command', stub + body],
                                capture_output=True, text=True, timeout=30)
        self.assertEqual(result.returncode, 23, result.stdout + result.stderr)
        self.assertNotIn('test_studio_voice_worker', result.stdout)
