import json
import tempfile
import unittest
from pathlib import Path
from tests.test_studio_v2_voice import ir_document, write_pcm
from tools.studio_v2.voice import ensure_voice_artifact
from tools.zodiac_local import tts_manifest_rows

class VoicePerformanceTests(unittest.TestCase):
    def test_speech_change_regenerates_only_affected_scene_and_forwards_context(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'narration.txt').write_text('xin chao\nbo cap\n')
            document=ir_document();calls=[]
            def generator(workspace, production, ids, profile, settings):
                calls.append((list(ids),production))
                for id in ids:write_pcm(workspace/'.runtime/tts-scenes'/f'{id}.wav')
            kwargs=dict(voice_profile='Hai Dang',tts_settings={},engine_version='test',generator=generator)
            ensure_voice_artifact(root,document,**kwargs)
            document['scenes'][0]['performance_context']={'pace':'slow','emotion':'quiet','energy':.3}
            ensure_voice_artifact(root,document,**kwargs)
            self.assertEqual(calls[-1][0],['S01'])
            self.assertEqual(calls[-1][1]['scenes'][0]['performance_context']['pace'],'slow')
            report=json.loads((root/'.runtime/voice-performance.json').read_text())
            self.assertEqual(report['status'],'REVIEW_REQUIRED')
            self.assertFalse(report['prosody_verified'])
            ensure_voice_artifact(root,document,**kwargs)
            self.assertEqual(len(calls),2)
            document['scenes'][0]['performance_context']['motion_duration_ms']=700
            ensure_voice_artifact(root,document,**kwargs)
            self.assertEqual(len(calls),2)
            document['scenes'][0]['performance_context']['pace']='fast'
            ensure_voice_artifact(root,document,**kwargs)
            self.assertEqual(len(calls),3)
            self.assertEqual(calls[-1][0],['S01'])

    def test_invalid_direction_blocks_before_generator_and_keeps_prior_voice(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'narration.txt').write_text('xin chao\nbo cap\n')
            document=ir_document();calls=[]
            def generator(workspace, production, ids, profile, settings):
                calls.append(list(ids))
                for id in ids:write_pcm(workspace/'.runtime/tts-scenes'/f'{id}.wav')
            kwargs=dict(voice_profile='test',tts_settings={},engine_version='test',generator=generator)
            artifact=ensure_voice_artifact(root,document,**kwargs);before=artifact.path.read_bytes()
            for invalid in ({'energy':float('nan')}, [], None):
                document['scenes'][0]['performance_context']=invalid
                with self.assertRaisesRegex(Exception,'invalid speech energy|performance_context must be an object'):
                    ensure_voice_artifact(root,document,**kwargs)
            self.assertEqual(len(calls),1)
            self.assertEqual(artifact.path.read_bytes(),before)

    def test_tts_manifest_preserves_requested_direction_without_changing_text(self):
        document=ir_document();document['scenes'][0]['performance_context']={'pace':'slow','motion_duration_ms':600}
        row=tts_manifest_rows(document)[0]
        self.assertEqual(row['text'],'xin chao')
        self.assertEqual(row['performance_context'],{'pace':'slow'})

if __name__=='__main__':unittest.main()
