"""Usage is a read-only build projection, never a human review receipt."""
import copy
import json
import hashlib
import subprocess
from dataclasses import replace
import unittest
from unittest.mock import patch

from tests import test_studio_p34_visual as fixtures
from tools.studio_project.service import StudioProjectService
from tools.studio_project.rpc_stdio import dispatch


class UsageTests(unittest.TestCase):
    setUp = fixtures.VisualWorkspaceTests.setUp
    state = fixtures.VisualWorkspaceTests.state
    command = fixtures.VisualWorkspaceTests.command
    authored = fixtures.VisualWorkspaceTests.authored
    wait = fixtures.VisualWorkspaceTests.wait
    built = fixtures.VisualWorkspaceTests.built

    def test_verified_usage_survives_reopen_and_keeps_source_aliases_out(self):
        state = self.built()
        before = (self.handle.workspace / '.runtime/visual-workspace/state.json').read_bytes()
        history = self.visual.usage_history('another-project')
        self.assertEqual(history['records'][0]['project_id'], self.project)
        record = history['records'][0]
        self.assertEqual(record['review_status'], 'NOT_REVIEWED')
        self.assertEqual(record['build_id'], state['build']['id'])
        phone = next(row for row in record['assets'] if row['source_sha256'] == state['build']['assets']['phone']['sha256'])
        self.assertEqual(phone['scene_ids'], ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08'])
        self.assertNotIn('asset_ids', record)
        self.assertEqual(self.visual.usage_history(self.project)['records'], [])
        reopened = StudioProjectService(self.root / 'projects')
        self.addCleanup(reopened.close)
        self.assertEqual(reopened.visual.usage_history('another-project'), history)
        self.assertEqual((self.handle.workspace / '.runtime/visual-workspace/state.json').read_bytes(), before)

    def test_tampered_or_stale_evidence_never_contributes_usage(self):
        state = self.built()
        build = self.handle.workspace / '.runtime/visual-workspace/builds' / state['build']['id']
        files = [build / 'manifest.json', build / 's01.html', build / 'assets' / (state['build']['assets']['phone']['sha256'] + '.svg'), self.handle.workspace / '.authoring/visual-intent.json', self.handle.workspace / 'narration.txt']
        for file in files:
            before = file.read_bytes()
            with self.subTest(file=file.name):
                try:
                    file.write_bytes(b'corrupted')
                    self.assertEqual(self.visual.usage_history('another-project')['records'], [])
                finally:
                    file.write_bytes(before)
        self.command('theme.select', {'theme': 'dark'})
        self.assertEqual(self.visual.usage_history('another-project')['records'], [])

    def test_history_paginates_registry_and_reports_scan_limit(self):
        self.built()
        broken = copy.copy(self.handle)
        calls = []
        def page(*, limit, after_project_id=None):
            calls.append(after_project_id)
            return [broken] * limit if after_project_id is None else []
        with patch.object(self.service.registry, 'list_projects', side_effect=page):
            history = self.visual.usage_history(self.project)
        self.assertEqual(len(calls), 2)
        self.assertEqual(history['records'], [])
        with patch.object(self.service.registry, 'list_projects', return_value=[self.handle] * 100) as listing:
            history = self.visual.usage_history(self.project)
        self.assertEqual(listing.call_count, 5)
        self.assertTrue(history['coverage']['truncated'])
        self.assertEqual(history['coverage']['projects_scanned'], 500)

    def test_one_missing_project_and_nonobject_documents_do_not_hide_valid_history(self):
        self.built()
        with patch.object(self.service.registry, 'list_projects', return_value=[replace(self.handle, project_id='missing'), self.handle]):
            self.assertEqual(len(self.visual.usage_history('another-project')['records']), 1)
        file = self.handle.workspace / '.runtime/visual-workspace/state.json'
        before = file.read_bytes()
        try:
            file.write_bytes(b'[]')
            self.assertEqual(self.visual.usage_history('another-project')['records'], [])
        finally:
            file.write_bytes(before)

    def test_symlinked_build_asset_does_not_count(self):
        state = self.built()
        file = self.handle.workspace / '.runtime/visual-workspace/builds' / state['build']['id'] / 'assets' / (state['build']['assets']['phone']['sha256'] + '.svg')
        before = file.read_bytes()
        outside = self.root / 'outside.svg'
        outside.write_bytes(before)
        file.unlink()
        try:
            try:
                file.symlink_to(outside)
            except OSError as error:
                self.skipTest(str(error))
            self.assertEqual(self.visual.usage_history('another-project')['records'], [])
        finally:
            file.unlink(missing_ok=True)
            file.write_bytes(before)

    def test_malformed_event_payload_cannot_break_other_project_queries(self):
        self.built()
        file = self.handle.workspace / '.runtime/visual-workspace/state.json'
        state = json.loads(file.read_text('utf8'))
        ready = next(e for e in state['events'] if e['kind'] == 'episode.build_ready')
        ready['payload'] = []
        file.write_text(json.dumps(state), encoding='utf8')
        self.assertEqual(self.visual.usage_history('another-project')['records'], [])

    def test_gallery_and_candidates_receive_the_same_verified_history(self):
        self.authored()
        history = {'format': 'zodiac-asset-usage@1', 'records': [], 'not_an_approval': True}
        with patch.object(self.visual, 'usage_history', return_value=history) as usage, patch.object(self.visual, '_node', return_value={}) as node:
            self.visual.gallery(self.project)
            gallery_payload = node.call_args.args[1]
            self.visual.candidates(self.project, 's01', {})
            candidate_payload = node.call_args.args[1]
        self.assertEqual(gallery_payload['usage'], history)
        self.assertEqual(candidate_payload['usage'], history)
        self.assertEqual(usage.call_count, 2)

    def test_actual_rpc_projects_share_verified_prop_history_without_approval(self):
        self.built()
        text = fixtures.TEXT + '\n'
        narration = self.root / 'second-narration.txt'
        narration.write_bytes(text.encode('utf8'))
        capsule = self.root / 'second.zip'
        subprocess.run(['node', str(fixtures.ROOT / 'tests/studio_phase1_synthetic_fixture.mjs'), str(capsule), 'valid', str(narration)], cwd=fixtures.ROOT, capture_output=True, check=True)
        current = self.service.import_capsule(capsule)['project_id']
        intent = copy.deepcopy(self.intent)
        intent['narration_sha256'] = hashlib.sha256(text.encode('utf8')).hexdigest()
        intent['scenes'][-1]['narration_range'][1] += 1
        self.visual.command(current, 'second-source', 0, 'source.replace', {'intent': intent})
        gallery = dispatch(self.service, 'assets.gallery', {'project_id': current})
        phone = next(row for row in gallery['items'] if row['id'] == 'phone')
        self.assertEqual(phone['usage'][0]['project_id'], self.project)
        candidates = dispatch(self.service, 'assets.find_candidates', {'project_id': current, 'scene_id': 's01', 'requirement': {'asset_id': 'phone'}})
        self.assertEqual(candidates['bundles'][0]['usage'], phone['usage'])
        self.assertEqual(candidates['bundles'][0]['warnings'], [])
        self.assertEqual(self.service.project(self.project)['status']['visual'], 'UNKNOWN')
        self.assertEqual(self.service.project(current)['status']['visual'], 'UNKNOWN')
