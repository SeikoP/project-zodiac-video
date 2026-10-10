"""Episode identity uses Job5 unchanged; publish never fabricates a sign."""
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.package_validation import validate_job5_package_root
from tools.zodiac_local import _validate_publish_document, PipelineError

FIXTURE = Path(__file__).parent / 'fixtures/control-plane-v2/minimal'

class EpisodeJob5ImportTests(unittest.TestCase):
    def test_group_identity_and_performance_import_without_schema_upgrade(self):
        with tempfile.TemporaryDirectory() as tmp:
            pkg = Path(tmp) / 'job'
            shutil.copytree(FIXTURE, pkg)
            shutil.rmtree(pkg / '.runtime', ignore_errors=True)
            manifest = {'format':'zodiac-job@5','job':{'id':'fixture','revision':'1.0'},'contract':{'id':'zodiac-authoring-ir','version':'1.0.0','sha256':canonical_contract_hash('authoring-ir-v1')},'renderer':{'id':'zodiac-renderer','version':'2.0.1'},'producer':{'plugin':'zodiac-video-pipeline','version':'2.4.50'}}
            (pkg / 'publish').mkdir(exist_ok=True)
            (pkg / 'publish/publish.json').write_text(json.dumps({'format':'zodiac-publish@1','source':{'narration':'narration.txt','production':'production.ir.json'},'cover':{'identity':{'episode_id':'fire-triggers','label':'NHÓM LỬA','glyph':'🔥'}}}))
            (pkg / 'publish/publish-copy.txt').write_text('fixture')
            manifest['job']['id'] = 'zodiac-fire-triggers-khac-dong-co'
            (pkg / 'package-manifest.json').write_text(json.dumps(manifest))
            ir = json.loads((pkg / 'production.ir.json').read_text())
            ir['scenes'][0]['performance_context'] = {
                'delivery': 'conversational', 'energy': 0.65,
                'emotion': 'curious', 'pace': 'medium', 'emphasis': []}
            (pkg / 'production.ir.json').write_text(json.dumps(ir))
            (pkg / 'narration.txt').write_text('\n'.join(s['voice'] for s in ir['scenes']))
            result = validate_job5_package_root(pkg)
            self.assertIsNotNone(result)
            self.assertEqual(json.loads((pkg / 'production.ir.json').read_text())['scenes'][0]['performance_context']['energy'], .65)

    def _publish(self, identity):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'publish').mkdir()
            (root / 'publish/publish-copy.txt').write_text('COVER IDENTITY: NHÓM LỬA\nHOOK: Khác động cơ\nTIKTOK CAPTION: Ba cơ chế\nHASHTAGS: #NhomLua', encoding='utf-8')
            pub = {'version': '1.5', 'platform': 'tiktok', 'caption': 'Ba cơ chế', 'hashtags': ['#NhomLua'], 'source': {'narration': 'narration.txt', 'production': 'production.json'}, 'cover': {'layout': 'tilted_top_hook', 'identity': identity, 'hook': 'Khác động cơ', 'source_scene_id': 'S1', 'visuals': [{'entity_id': 'aries', 'state_id': 'idle'}]}}
            (root / 'publish/publish.json').write_text(json.dumps(pub), encoding='utf-8')
            prod = {'scenes': [{'id': 'S1', 'entities': [{'id': 'aries', 'states': {'idle': {}}}]}]}
            return _validate_publish_document(root, prod)

    def test_episode_cover_can_enter_local_runner(self):
        self.assertEqual(self._publish({'episode_id': 'fire-triggers', 'label': 'NHÓM LỬA', 'glyph': '🔥'})['cover']['identity']['episode_id'], 'fire-triggers')

    def test_ambiguous_or_missing_identity_blocks(self):
        for identity in ({'label':'NHÓM LỬA','glyph':'🔥'}, {'episode_id':'fire-triggers','sign_id':'aries','label':'NHÓM LỬA','glyph':'🔥'}):
            with self.assertRaises(PipelineError):
                self._publish(identity)
