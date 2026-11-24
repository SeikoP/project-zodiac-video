"""Execute the workflow's PowerShell body with a failing P2 test process."""
import shutil
import subprocess
import unittest
from pathlib import Path


class StudioCITests(unittest.TestCase):
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
