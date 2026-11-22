"""Export keeps approved inputs and last healthy media intact."""
import unittest
import locale
import sys
import json
import hashlib
import tempfile
from pathlib import Path
from contextlib import contextmanager
import threading
import urllib.request
import urllib.error
from unittest.mock import patch, MagicMock

from tests import test_studio_p34_visual as fixtures
from tools.studio_project.models import StudioError
from tools.studio_project.rpc_stdio import dispatch
from tools.runner.process import observe_subprocess_output, run_managed_subprocess
from tools.studio_project.visual_server import PreviewServer
from tools.studio_project.importer import _exclusive_source_lock
from tools.studio_project.status import _video_status
from tools.studio.artifacts import canonical_hash


class ExportLogTests(unittest.TestCase):
    def test_utf8_render_logs_survive_windows_legacy_locale(self):
        lines = []
        with patch.object(locale, 'getencoding', return_value='cp1252'), observe_subprocess_output(lambda line, **_: lines.append(line)):
            result = run_managed_subprocess([sys.executable, '-c', "import os;os.write(1,bytes.fromhex('42e1bb8d2043e1baa170'))"], text=True, capture_output=True, check=True)
        self.assertEqual(result.stdout, 'Bọ Cạp')
        self.assertEqual(lines, ['Bọ Cạp'])

    def test_private_video_ranges_and_invalid_ranges(self):
        server = PreviewServer(lambda *_: (b'0123456789', 'video/mp4'))
        self.addCleanup(server.close)
        url = server.video_url('p1', 'a' * 32)
        for requested, expected in [('bytes=2-5', b'2345'), ('bytes=-3', b'789'), ('bytes=8-', b'89')]:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': requested})) as response:
                self.assertEqual(response.status, 206)
                self.assertEqual(response.read(), expected)
                self.assertEqual(response.headers['Content-Type'], 'video/mp4')
        for requested in ['bytes=99-', 'bytes=5-2', 'bytes=0-1,4-5']:
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(urllib.request.Request(url, headers={'Range': requested}))


class ExportTests(unittest.TestCase):
    setUp = fixtures.VisualWorkspaceTests.setUp
    state = fixtures.VisualWorkspaceTests.state
    command = fixtures.VisualWorkspaceTests.command
    authored = fixtures.VisualWorkspaceTests.authored
    wait = fixtures.VisualWorkspaceTests.wait
    built = fixtures.VisualWorkspaceTests.built

    def test_export_requires_a_current_verified_build_and_exact_rpc(self):
        self.authored()
        with self.assertRaises(StudioError):
            dispatch(self.service, 'video.export', {'project_id': self.project, 'base_revision': self.state()['revision']})
        with self.assertRaises(StudioError):
            dispatch(self.service, 'video.export', {'project_id': self.project, 'base_revision': self.state()['revision'], 'output': 'outside.mp4'})
        before = self.state()
        with self.assertRaises(StudioError):
            self.visual.export(self.project, before['revision'] - 1)
        self.assertIsNone(self.state()['job'])

    def test_failed_or_cancelled_export_preserves_previous_media(self):
        self.authored()
        before = self.state()
        with patch.object(self.visual, '_export_inputs', return_value={}), patch.object(self.visual, '_render_export', side_effect=RuntimeError('test render failure')):
            self.visual.export(self.project, before['revision'])
            state = self.wait()
        self.assertEqual(state['job']['status'], 'BLOCKED')
        self.assertEqual(state['intent'], before['intent'])
        self.assertEqual(state.get('export'), before.get('export'))

    def test_source_change_during_export_blocks_commit(self):
        before = self.authored()
        with patch.object(self.visual, '_export_inputs', side_effect=[{'binding': 'first'}, {'binding': 'changed'}]), patch.object(self.visual, '_render_export', return_value={'sha256': 'a' * 64}):
            self.visual.export(self.project, before['revision'])
            state = self.wait()
        self.assertEqual(state['job']['status'], 'BLOCKED')
        self.assertIsNone(state.get('export'))
        self.assertEqual(state['intent'], before['intent'])

    def test_cancel_never_publishes_a_late_export_result(self):
        before = self.authored()
        entered, release = threading.Event(), threading.Event()
        def render(*_):
            entered.set();release.wait(3)
            return {'sha256': 'a' * 64}
        with patch.object(self.visual, '_export_inputs', return_value={}), patch.object(self.visual, '_render_export', side_effect=render):
            self.visual.export(self.project, before['revision'])
            self.assertTrue(entered.wait(2))
            cancelled = self.visual.cancel(self.project)
            release.set();self.visual.close()
        self.assertEqual(cancelled['job']['status'], 'CANCELLED')
        self.assertIsNone(self.state().get('export'))

    def test_technical_video_export_never_grants_human_approval(self):
        self.authored()
        before = self.state()
        with patch.object(self.visual, '_export_inputs', return_value={}), patch.object(self.visual, '_render_export', return_value={'sha256': 'a' * 64, 'human_review': 'PENDING', 'approval_granted': False}):
            self.visual.export(self.project, before['revision'])
            state = self.wait()
        self.assertEqual(state['job']['status'], 'COMPLETED')
        self.assertFalse(state['export']['approval_granted'])
        self.assertEqual(state['revision'], before['revision'])
        self.assertEqual(state['intent'], before['intent'])

    def test_cancel_still_kills_owned_process_after_content_invalidation(self):
        self.authored()
        child = MagicMock();child.poll.return_value = None
        self.visual._processes[self.project] = child
        (self.handle.workspace / 'narration.txt').write_text('unapproved change', encoding='utf8')
        with self.assertRaises(StudioError):
            self.visual.cancel(self.project)
        child.kill.assert_called_once()

    def test_cancel_still_kills_owned_process_after_visual_source_drift(self):
        self.authored()
        child = MagicMock();child.poll.return_value = None
        self.visual._processes[self.project] = child
        (self.handle.workspace / '.authoring/visual-intent.json').write_text('{}', encoding='utf8')
        with self.assertRaises(StudioError):
            self.visual.cancel(self.project)
        child.kill.assert_called_once()

    def test_final_voice_check_and_publication_share_one_lock(self):
        before = self.authored();local = threading.local()
        original_save = self.visual._save
        @contextmanager
        def observe(root, purpose):
            with _exclusive_source_lock(root, purpose):
                local.held = getattr(local, 'held', []) + [purpose]
                try: yield
                finally: local.held.pop()
        def save(handle, state):
            if state.get('export'):
                self.assertIn('voice-state', getattr(local, 'held', []))
            original_save(handle, state)
        with patch('tools.studio_project.visual_workspace._exclusive_source_lock', observe), patch.object(self.visual, '_save', side_effect=save), patch.object(self.visual, '_export_inputs', return_value={}), patch.object(self.visual, '_render_export', return_value={'sha256':'a'*64}):
            self.visual.export(self.project, before['revision'])
            self.assertEqual(self.wait()['job']['status'], 'COMPLETED')


class ExportStatusTests(unittest.TestCase):
    def test_realign_and_rebuild_same_revision_never_revives_old_video(self):
        with tempfile.TemporaryDirectory(prefix='hf-status-') as temp:
            root = Path(temp)
            def write(rel, value):
                file=root/rel;file.parent.mkdir(parents=True,exist_ok=True)
                file.write_text(json.dumps(value),encoding='utf8');return file
            def sha(file): return hashlib.sha256(file.read_bytes()).hexdigest()
            source={'stable':'visual'};source_hash=canonical_hash(source)
            write('.authoring/visual-intent.json',source)
            wav=write('voice.wav',{'fixture':'bytes only, not media QA'})
            timing={'revision':1};build_id='a'*32;export_id='b'*32
            manifest=write(f'.runtime/visual-workspace/builds/{build_id}/manifest.json',{'version':1})
            prefix=f'.runtime/visual-workspace/exports/{export_id}/'
            video=write(prefix+'episode.mp4',{'fixture':'receipt freshness only'})
            receipt={'format':'zodiac-hyperframes-export@1','path':prefix+'episode.mp4','sha256':sha(video),'source_sha256':source_hash,'voice_sha256':sha(wav),'build_manifest_sha256':sha(manifest)}
            write(prefix+'receipt.json',receipt)
            state={'revision':1,'source_hash':source_hash,'export':{**receipt,'id':export_id,'revision':1},'build':{'id':build_id,'voice_timing_fingerprint':canonical_hash(timing)}}
            write('.runtime/visual-workspace/state.json',state)
            voice={'assembly':{'path':'voice.wav','wav_sha256':sha(wav)},'timing':timing};write('.runtime/voice-lab/state.json',voice)
            self.assertEqual(_video_status(root),'EXPORTED')
            voice['timing']={'revision':2};state['build']['voice_timing_fingerprint']=canonical_hash(voice['timing'])
            write('.runtime/voice-lab/state.json',voice);write('.runtime/visual-workspace/state.json',state)
            write(f'.runtime/visual-workspace/builds/{build_id}/manifest.json',{'version':2})
            self.assertEqual(_video_status(root),'STALE')
