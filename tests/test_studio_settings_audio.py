import copy
import json
import math
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
import wave

from tools.studio_project.models import StudioError
from tools.studio_project.settings import StudioSettings
from tools.studio_project.audio_mix import plan_mix, render_mix


def tone(path, frequency, seconds=1.2, gain=.15):
    with wave.open(str(path), 'wb') as out:
        out.setparams((1, 2, 48000, 0, 'NONE', 'not compressed'))
        out.writeframes(b''.join(struct.pack('<h', int(gain*32767*math.sin(2*math.pi*frequency*i/48000))) for i in range(int(seconds*48000))))


class SettingsAudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.music = self.root/'music'; self.music.mkdir()
        self.sfx = self.root/'sfx'; self.sfx.mkdir()
        tone(self.root/'voice.wav', 440)
        tone(self.music/'test.wav', 220, .3)
        tone(self.sfx/'whoosh.wav', 880, .1)
        self.settings = StudioSettings(self.root/'projects')
        self.addCleanup(self.settings.close)
        snapshot = self.settings.snapshot()
        value = copy.deepcopy(snapshot['values'])
        value['libraries'] = {'music_dir': str(self.music), 'sfx_dir': str(self.sfx)}
        value['audio'].update(music_id='', sfx_id='')
        self.settings.update(snapshot['revision'], value)
        rows = self.settings.catalog()['items']
        value['audio'].update(music_id=next(x['id'] for x in rows if x['kind']=='music'), sfx_id=next(x['id'] for x in rows if x['kind']=='sfx'))
        self.settings.update(1, value)
        self.manifest = {'scenes':[{'id':'s1','start_ms':0},{'id':'s2','start_ms':600}]}

    def test_settings_persist_validate_and_reject_stale_writes(self):
        snapshot = self.settings.snapshot()
        other = StudioSettings(self.root/'projects'); self.addCleanup(other.close)
        self.assertEqual(other.snapshot()['values'], snapshot['values'])
        bad = copy.deepcopy(snapshot['values']); bad['audio']['music_volume']=float('nan')
        with self.assertRaises(StudioError): self.settings.update(snapshot['revision'], bad)
        with self.assertRaises(StudioError): self.settings.update(0, snapshot['values'])
        self.assertEqual(other.snapshot()['revision'], snapshot['revision'])

    def test_plan_has_sparse_timed_sfx_and_content_fingerprint(self):
        plan = plan_mix(self.settings, self.manifest, 1.2)
        self.assertEqual(plan['cues_ms'], [600])
        first = plan['fingerprint']
        snapshot = self.settings.snapshot(); snapshot['values']['audio']['music_volume'] = .05
        self.settings.update(snapshot['revision'], snapshot['values'])
        second = plan_mix(self.settings, self.manifest, 1.2)['fingerprint']
        self.assertNotEqual(second, first)
        tone(self.music/'test.wav', 221, .3)
        self.assertNotEqual(plan_mix(self.settings, self.manifest, 1.2)['fingerprint'], second)

    def test_muting_layers_keeps_a_voice_only_mix(self):
        if not shutil.which('ffmpeg'): self.skipTest('ffmpeg unavailable')
        snapshot = self.settings.snapshot()
        snapshot['values']['audio'].update(music_enabled=False, sfx_enabled=False)
        self.settings.update(snapshot['revision'], snapshot['values'])
        plan = plan_mix(self.settings, self.manifest, 1.2)
        self.assertIsNone(plan['music']); self.assertIsNone(plan['sfx'])
        contract = render_mix(self.root/'voice.wav', plan, self.root/'voice-only.wav')
        self.assertEqual((contract['music_tracks'], contract['sfx_tracks']), (0, 0))

    def test_rpc_and_agent_preferences_use_saved_settings_without_exposing_credentials(self):
        from unittest.mock import patch
        from tools.studio_project.service import StudioProjectService
        from tools.studio_project.rpc_stdio import dispatch
        service = StudioProjectService(self.root/'rpc-projects'); self.addCleanup(service.close)
        current = dispatch(service, 'settings.get', {})
        current['values']['agents']['creative'] = {'model': 'saved-model', 'effort': 'low'}
        dispatch(service, 'settings.update', {'base_revision':current['revision'], 'values':current['values']})
        with patch.dict('os.environ', {'ZODIAC_STUDIO_CREATIVE_MODEL':'', 'ZODIAC_STUDIO_AGENT_MODEL':'', 'ZODIAC_STUDIO_CREATIVE_EFFORT':'', 'ZODIAC_STUDIO_AGENT_EFFORT':''}):
            health = service.agent.health()
            self.assertEqual(health['model'], 'saved-model')
            self.assertEqual(health['roles']['creative']['effort'], 'low')
        with self.assertRaises(StudioError): dispatch(service, 'settings.update', {'base_revision':1, 'values':current['values'], 'credential':'no'})
        self.assertNotIn('credential', json.dumps(dispatch(service, 'settings.get', {})))

    def test_real_mix_keeps_voice_and_contains_music_and_sfx(self):
        if not shutil.which('ffmpeg'): self.skipTest('ffmpeg unavailable')
        plan = plan_mix(self.settings, self.manifest, 1.2)
        result = render_mix(self.root/'voice.wav', plan, self.root/'mix.wav')
        self.assertEqual(result['music_tracks'], 1)
        self.assertEqual(result['sfx_tracks'], 1)
        self.assertEqual(result['sfx_cues'], 1)
        with wave.open(str(self.root/'mix.wav')) as reader:
            self.assertEqual(reader.getnchannels(), 2)
            self.assertAlmostEqual(reader.getnframes()/reader.getframerate(), 1.2, places=2)
            samples=struct.unpack('<'+'h'*(reader.getnframes()*2),reader.readframes(reader.getnframes()))[::2]
        def energy(hz, start=0, stop=.25):
            part=samples[int(start*48000):int(stop*48000)]
            return abs(sum(x*complex(math.cos(2*math.pi*hz*i/48000),math.sin(2*math.pi*hz*i/48000)) for i,x in enumerate(part))) / len(part)
        self.assertGreater(energy(440), 1500, 'voice remains audible')
        self.assertGreater(energy(220), 5, 'ducked music is present')
        self.assertLess(energy(220), energy(440)/5, 'voice dominates the music')
        self.assertGreater(energy(880,.6,.68), energy(880,0,.08)+20, 'SFX occurs at its cue')
        self.assertLess(max(abs(x) for x in samples), 32767, 'mix does not clip')

    def test_missing_selection_and_asset_drift_are_errors(self):
        plan = plan_mix(self.settings, self.manifest, 1.2)
        (self.music/'test.wav').unlink()
        with self.assertRaises(StudioError): render_mix(self.root/'voice.wav', plan, self.root/'bad.wav')


if __name__ == '__main__': unittest.main()
