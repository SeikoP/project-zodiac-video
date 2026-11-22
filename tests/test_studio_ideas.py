"""Personal MP4 checklist; never a pipeline approval source."""
import tempfile
import unittest
import json
import subprocess
import sys
from unittest.mock import patch
from pathlib import Path

from tools.studio_project.models import StudioError
from tools.studio_project.models import ProjectHandle
from tools.studio_project.registry import EpisodeRegistry
from tools.studio_project.rpc_stdio import dispatch
from tools.studio_project.service import StudioProjectService


class IdeasTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.service = StudioProjectService(self.root)
        self.addCleanup(self.service.close)

    def test_catalog_before_import_and_no_fake_completion(self):
        board = dispatch(self.service, 'ideas.list', {})
        self.assertGreaterEqual(len(board['groups']), 3)
        self.assertEqual(len(board['signs']), 12)
        concepts = [c for g in board['groups'] for c in g['concepts']]
        self.assertGreaterEqual(len(concepts), 28)
        self.assertEqual(len({c['id'] for c in concepts}), len(concepts))
        self.assertEqual(board['progress'], [])
        self.assertEqual(self.service.registry.project_count(), 0)
        self.assertTrue(all(c['title'] and c['direction'] for c in concepts))

    def test_durable_progress_independent_cells_and_reset(self):
        board = dispatch(self.service, 'ideas.list', {})
        concept = board['groups'][0]['concepts'][0]['id']
        signs = board['signs']
        def update(sign, status):
            return dispatch(self.service, 'ideas.update', dict(concept_id=concept, sign=sign, status=status))
        update(signs[0], 'in_progress')
        row = update(signs[0], 'mp4_approved')
        self.assertEqual(row['status'], 'mp4_approved')
        self.assertGreater(row['updated_at'], 0)
        update(signs[1], 'in_progress')
        reopened = StudioProjectService(self.root)
        self.addCleanup(reopened.close)
        progress = dispatch(reopened, 'ideas.list', {})['progress']
        self.assertEqual({r['sign']: r['status'] for r in progress},
                         {signs[0]: 'mp4_approved', signs[1]: 'in_progress'})
        update(signs[0], 'not_started')
        progress = dispatch(reopened, 'ideas.list', {})['progress']
        self.assertEqual(len(progress), 1)
        self.assertEqual(progress[0]['sign'], signs[1])
        self.assertEqual(self.service.registry.project_count(), 0)

    def test_untrusted_updates_and_extra_params_are_rejected(self):
        board = dispatch(self.service, 'ideas.list', {})
        valid = dict(concept_id=board['groups'][0]['concepts'][0]['id'],
                     sign=board['signs'][0], status='in_progress')
        for field, bad in [('concept_id', '../../x'), ('sign', 'anything'),
                           ('status', 'APPROVED'), ('status', True), ('sign', []),
                           ('concept_id', None)]:
            with self.subTest(field=field, bad=bad), self.assertRaises(StudioError):
                dispatch(self.service, 'ideas.update', {**valid, field: bad})
        with self.assertRaises(StudioError):
            dispatch(self.service, 'ideas.update', {**valid, 'approve_episode': True})
        with self.assertRaises(StudioError):
            dispatch(self.service, 'ideas.list', {'project_id': 'anything'})
        self.assertEqual(dispatch(self.service, 'ideas.list', {})['progress'], [])

    def test_real_stdio_transport_and_desktop_allowlist(self):
        root = Path(__file__).resolve().parents[1]
        requests = [
            dict(id='1', method='ideas.list', params={}),
            dict(id='2', method='ideas.update', params=dict(
                concept_id='love-feeling', sign='Bạch Dương', status='mp4_approved')),
            dict(id='3', method='ideas.list', params={}),
        ]
        result = subprocess.run([sys.executable, '-m', 'tools.studio_project.rpc_stdio',
                                 '--projects-root', str(self.root)], cwd=root,
                                input=''.join(json.dumps(r) + '\n' for r in requests),
                                text=True, encoding='utf-8', capture_output=True, timeout=15, check=True)
        replies = [json.loads(line) for line in result.stdout.splitlines()]
        self.assertEqual([r['id'] for r in replies], ['1', '2', '3'])
        self.assertTrue(all(r['ok'] for r in replies), replies)
        self.assertEqual(replies[-1]['result']['progress'][0]['status'], 'mp4_approved')
        self.assertEqual(result.stderr, '')
        host = (root / 'apps/zodiac-studio/src-tauri/src/lib.rs').read_text(encoding='utf-8')
        for method in ('ideas.list', 'ideas.update'):
            self.assertIn('"' + method + '"', host)

    def test_existing_registry_projects_survive_additive_schema(self):
        root = self.root / 'existing-store'
        registry = EpisodeRegistry(root)
        project = ProjectHandle('ep-existing', root / 'episodes/existing', 'a' * 64, 'existing')
        registry.register(project, 'b' * 64)
        service = StudioProjectService(root)
        self.addCleanup(service.close)
        self.assertEqual(service.registry.get('ep-existing'), project)
        self.assertEqual(service.registry.project_count(), 1)
        self.assertEqual(dispatch(service, 'ideas.list', {})['progress'], [])

    def test_catalog_additions_reload_without_restart_or_losing_progress(self):
        board = dispatch(self.service, 'ideas.list', {})
        dispatch(self.service, 'ideas.update', dict(concept_id='love-feeling', sign='Bạch Dương', status='mp4_approved'))
        source = self.root / 'catalog.json'
        board['groups'][0]['concepts'].append(dict(id='love-added', title='Concept mới', direction='Triển khai tình huống mới.'))
        source.write_text(json.dumps(board), encoding='utf-8')
        with patch('tools.studio_project.ideas.CATALOG_PATH', source):
            updated = dispatch(self.service, 'ideas.list', {})
            self.assertIn('love-added', [c['id'] for c in updated['groups'][0]['concepts']])
            self.assertEqual(updated['progress'][0]['status'], 'mp4_approved')
            board['groups'][0]['concepts'].append(board['groups'][0]['concepts'][0])
            source.write_text(json.dumps(board), encoding='utf-8')
            with self.assertRaises(StudioError) as caught:
                dispatch(self.service, 'ideas.list', {})
            self.assertEqual(caught.exception.code, 'IDEA_CATALOG_INVALID')
        self.assertEqual(dispatch(self.service, 'ideas.list', {})['progress'][0]['status'], 'mp4_approved')
