"""Whole P2 slice: synthetic approval fixtures never certify human listening."""
import array
import base64
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import MagicMock, patch
import wave

from tools.studio.artifacts import VoiceArtifactStore, VoiceIdentity, file_sha256
from tools.studio_project.models import StudioError
from tools.studio_project.rpc_stdio import handle_line
from tools.studio_project.service import StudioProjectService
from tools.studio_project.voice_lab import speech_units, speech_input, voice_evidence
from tools.runner.process import run_managed_subprocess

ROOT = Path(__file__).resolve().parents[1]
TEXT = "Kim Ngưu không hề chậm.\r\nHọ chỉ đọc kỹ điều khoản trước khi bắt đầu!\n"


def pcm(path, frequency=330, duration=.8):
    path.parent.mkdir(parents=True, exist_ok=True)
    samples = array.array("h", [int(12000*math.sin(2*math.pi*frequency*i/16000)) for i in range(round(16000*duration))])
    with wave.open(str(path), "wb") as output:
        output.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
        output.writeframes(samples.tobytes())


class VoiceLabTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory(prefix="zodiac-p2-")
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        text = self.root / "source.txt"
        text.write_bytes(TEXT.encode("utf8"))
        capsule = self.root/"source.zip"
        subprocess.run(["node", str(ROOT/"tests/studio_phase1_synthetic_fixture.mjs"), str(capsule), "valid", str(text)],
                       cwd=ROOT, capture_output=True, check=True)
        self.service = StudioProjectService(self.root/"projects")
        self.addCleanup(self.service.close)
        self.project = self.service.import_capsule(capsule)["project_id"]
        self.lab = self.service.voice
        self.handle = self.service.registry.get(self.project)
        self.calls = []
        self.engine = patch("tools.studio_project.voice_lab.run_tts_batch", side_effect=self.generate)
        self.engine.start()
        self.addCleanup(self.engine.stop)

    def generate(self, runtime, rows, **settings):
        self.calls.append([dict(row) for row in rows])
        for row in rows:
            pcm(runtime/"tts-scenes"/(row["scene_id"]+".wav"), 300+len(self.calls)*100)

    def state(self):
        return self.lab.snapshot(self.project)

    def wait(self):
        deadline = time.monotonic()+12
        while time.monotonic() < deadline:
            state = self.state()
            if state["job"]["status"] != "RUNNING":
                return state
            time.sleep(.02)
        self.fail("Voice job did not finish")

    def create(self, ids=None):
        state = self.state()
        self.lab.start(self.project, "generate", ids or [], "Hải Đăng", "NORMAL", {}, state["revision"])
        state = self.wait()
        self.assertEqual(state["job"]["status"], "COMPLETED", state["job"])
        return state

    def listened(self, unit_id, take_id):
        token = self.lab.playback(self.project, unit_id, take_id)["playback_id"]
        state = self.state()
        with patch("tools.studio_project.voice_lab.time.time", return_value=time.time()+10):
            return self.lab.confirm(self.project, unit_id, take_id, token, True, state["revision"])

    def test_semantic_plan_preserves_utf8_and_crlf_without_scene_boundaries(self):
        units = speech_units(TEXT.encode("utf8"))
        self.assertEqual("".join(u["text"] for u in units), TEXT)
        self.assertEqual(len(units), 2)
        for unit in units:
            a,b=unit["source_range"]
            self.assertEqual(TEXT.encode("utf8")[a:b].decode("utf8"), unit["text"])
        self.assertEqual(units, speech_units(TEXT.encode("utf8")))

    def test_saved_user_voices_are_listed_and_selected_preset_reaches_tts(self):
        home = self.root/"vieneu"
        home.mkdir()
        catalog = home/"user_voices_v3_turbo.json"
        catalog.write_text(json.dumps({"presets": {"cuongdepzai": {}, "cuongdepzaiver2": {}}}), encoding="utf8")
        with patch.dict(os.environ, {"VIENEU_HOME": str(home)}):
            state = self.state()
            self.assertEqual(state["voices"], ["cuongdepzai", "cuongdepzaiver2"])
            self.assertEqual(state["voice"], "cuongdepzai")
            with patch("tools.studio_project.voice_lab.run_tts_batch", side_effect=self.generate) as engine:
                self.lab.start(self.project, "generate", [], "cuongdepzaiver2", "NORMAL", {}, state["revision"])
                state = self.wait()
            self.assertEqual(engine.call_args.kwargs["voice"], "cuongdepzaiver2")
            self.assertEqual(state["voice"], "cuongdepzaiver2")
            self.assertTrue(all(u["takes"][0]["details"]["voice"] == "cuongdepzaiver2" for u in state["units"]))
            catalog.write_text(json.dumps({"presets": {"cuongdepzai": {}, "cuongdepzaiver2": {}, "Giọng mới": {}}}), encoding="utf8")
            self.assertIn("Giọng mới", self.state()["voices"])

    def test_voice_catalog_fallback_preserves_existing_take_identity(self):
        state = self.create()
        before = state["units"][0]["takes"][0]["wav_sha256"]
        with patch.dict(os.environ, {"VIENEU_HOME": str(self.root/"missing-vieneu")}):
            state = self.state()
            self.assertEqual(state["voices"], ["Hải Đăng"])
            self.assertEqual(state["units"][0]["takes"][0]["wav_sha256"], before)

    def test_pronunciation_maps_spoken_words_back_to_original_bytes(self):
        raw="Deadline à?".encode("utf8")
        unit=speech_units(raw)[0]
        text, spans=speech_input(unit,{"Deadline":"đét lai"})
        self.assertEqual(text,"đét lai à?")
        self.assertEqual(spans[0],spans[1])
        self.assertEqual(raw[slice(*spans[0])].decode("utf8"),"Deadline")
        self.assertEqual(unit["text"],"Deadline à?")

    def test_generated_audio_is_technical_not_listening_approval(self):
        state=self.create()
        self.assertEqual(state["status"],"TECHNICAL_VALID")
        self.assertEqual(self.service.project(self.project)["status"]["voice"],"TECHNICAL_VALID")
        self.assertTrue(all(u["takes"][0]["status"]=="TECH_VALID" and not u["listened"] for u in state["units"]))
        self.assertTrue(all(u["takes"][0]["peaks"] for u in state["units"]))
        self.assertFalse(any(u["takes"][0]["details"]["prosody_verified"] for u in state["units"]))

    def test_immutable_retakes_preserve_other_units_and_current_assembly_until_selected(self):
        state=self.create()
        before={u["id"]:u["takes"][0]["wav_sha256"] for u in state["units"]}
        state=self.lab.assemble(self.project,state["revision"])
        assembly_hash=state["assembly"]["wav_sha256"]
        first=state["units"][0]
        state=self.create([first["id"]])
        self.assertEqual(state["assembly"]["wav_sha256"],assembly_hash)
        self.assertEqual([r["scene_id"] for r in self.calls[-1]],[first["id"]])
        target=state["units"][0]
        self.assertEqual(len(target["takes"]),2)
        self.assertEqual(target["selected_take"],first["selected_take"])
        other=state["units"][1]
        self.assertEqual(other["takes"][0]["wav_sha256"],before[other["id"]])
        state=self.lab.select(self.project,target["id"],target["takes"][-1]["take_id"],state["revision"],0)
        self.assertIsNone(state["assembly"])
        self.assertIsNone(state["timing"])
        self.assertFalse(state["invalidated"]["svg_assets_invalidated"])
        self.assertEqual(target["takes"][0]["wav_sha256"],before[target["id"]])

    def test_stale_revision_unknown_take_and_unsafe_pause_rejected(self):
        state=self.create();unit=state["units"][0]
        for take,revision,gap in ((unit["selected_take"],-1,0),("../../outside",state["revision"],0),
                                  (unit["selected_take"],state["revision"],float("nan"))):
            with self.subTest(take=take,revision=revision,gap=gap),self.assertRaises(StudioError):
                self.lab.select(self.project,unit["id"],take,revision,gap)

    def test_playback_then_explicit_unit_and_assembled_listening_are_distinct(self):
        state=self.create();unit=state["units"][0]
        token=self.lab.playback(self.project,unit["id"],unit["selected_take"])["playback_id"]
        for confirmed in (False,"true",True):
            with self.subTest(confirmed=confirmed),self.assertRaises(StudioError):
                self.lab.confirm(self.project,unit["id"],unit["selected_take"],token,confirmed,state["revision"])
        for unit in state["units"]:
            state=self.listened(unit["id"],unit["selected_take"])
        state=self.lab.assemble(self.project,state["revision"])
        self.assertEqual(state["status"],"TECHNICAL_VALID")
        state=self.listened("episode",state["assembly"]["take_id"])
        self.assertEqual(state["status"],"USER_LISTENED_APPROVED")
        restored=StudioProjectService(self.root/"projects")
        self.assertEqual(restored.project(self.project)["status"]["voice"],"USER_LISTENED_APPROVED")
        self.assertEqual(restored.voice.snapshot(self.project)["units"][0]["selected_take"],state["units"][0]["selected_take"])

    def test_voice_proof_cannot_omit_an_unheard_source_unit(self):
        self.create()
        state=self.lab._read(self.handle)
        state["units"].pop()
        self.lab._save(self.handle,state)
        self.assertEqual(voice_evidence(self.handle.workspace,self.handle.imported_source_sha256),"BLOCKED")

    def test_audio_transport_returns_verified_bounded_real_wav_bytes(self):
        state=self.create();unit=state["units"][0]
        chunks=[];offset=0
        while True:
            part=self.lab.audio(self.project,unit["id"],unit["selected_take"],offset)
            chunk=base64.b64decode(part["data"])
            self.assertLessEqual(len(chunk),512*1024)
            chunks.append(chunk);offset+=len(chunk)
            if offset>=part["total"]:break
        self.assertEqual(b"".join(chunks)[:4],b"RIFF")
        with self.assertRaises(StudioError):
            self.lab.audio(self.project,"../../outside",unit["selected_take"],0)

    def test_join_controls_change_measured_audio_without_changing_takes_or_source(self):
        state=self.create();unit=state["units"][0]
        state=self.lab.select(self.project,unit["id"],unit["selected_take"],state["revision"],250)
        state=self.lab.assemble(self.project,state["revision"])
        self.assertAlmostEqual(state["assembly"]["duration_seconds"],1.85,places=3)
        self.assertEqual(self.service.project(self.project)["status"]["content"],"APPROVED")
        self.assertEqual(state["units"][1]["source_range"],speech_units(TEXT.encode("utf8"))[1]["source_range"])

    def test_asr_measured_anchors_and_failed_alignment_leave_source_unchanged(self):
        state=self.create();state=self.lab.assemble(self.project,state["revision"])
        before=state["narration_sha256"]
        def align(args,**_):
            manifest=json.loads(Path(args[4]).read_text(encoding="utf8"))
            result={}
            for unit in manifest["units"]:
                text=unit["tts_text"].split()
                result[unit["id"]]=[{"text":word,"startMs":800*i/len(text),"endMs":800*(i+1)/len(text),"confidence":.95} for i,word in enumerate(text)]
            Path(args[5]).write_text(json.dumps(result),encoding="utf8")
        with patch("tools.studio_project.voice_lab.run_managed_subprocess",side_effect=align):
            self.lab.start(self.project,"align",[],"Hải Đăng","NORMAL",{},state["revision"])
            state=self.wait()
        self.assertEqual(state["job"]["status"],"COMPLETED",state["job"])
        self.assertEqual(state["timing"]["source"],"measured_asr")
        self.assertTrue(all(word["endMs"]>word["startMs"] and word["source_range"] for word in state["timing"]["words"]))
        with patch("tools.studio_project.voice_lab.run_managed_subprocess",side_effect=RuntimeError("ASR words missing")):
            self.lab.start(self.project,"align",[],"Hải Đăng","NORMAL",{},state["revision"])
            state=self.wait()
        self.assertEqual(state["job"]["status"],"REVIEW")
        self.assertEqual(state["narration_sha256"],before)

    def test_cancel_preserves_completed_audio_and_does_not_publish_stale_work(self):
        entered,release=threading.Event(),threading.Event()
        def waiting(*args,**kwargs):
            entered.set();release.wait(4);self.generate(*args,**kwargs)
        state=self.state()
        with patch("tools.studio_project.voice_lab.run_tts_batch",side_effect=waiting):
            self.lab.start(self.project,"generate",[],"Hải Đăng","NORMAL",{},state["revision"])
            self.assertTrue(entered.wait(3))
            cancelled=self.lab.cancel(self.project)
            self.assertEqual(cancelled["job"]["status"],"CANCELLED")
            release.set()
            self.lab.close()
        self.assertTrue(all(not u["selected_take"] for u in self.state()["units"]))

    def test_partial_tts_failure_keeps_completed_take_and_retries_only_missing_units(self):
        before = self.state()
        first = before["units"][0]["id"]
        progress = []
        def partial(runtime, rows, **settings):
            self.generate(runtime, rows[:1], **settings)
            run_managed_subprocess([sys.executable, "-c", "print('VieNeu DONE: ' + " + repr(first) + ")"], text=True, check=True)
            progress.append(self.state()["job"]["completed"])
            (runtime/"tts-scenes"/(rows[1]["scene_id"]+".wav")).write_bytes(b"RIFF")
            raise RuntimeError("second unit failed")
        with patch("tools.studio_project.voice_lab.run_tts_batch", side_effect=partial):
            self.lab.start(self.project, "generate", [], "Hải Đăng", "NORMAL", {}, before["revision"])
            state = self.wait()
        self.assertEqual(state["job"]["status"], "REVIEW")
        self.assertEqual(progress, [1])
        self.assertEqual(state["job"]["completed"], 1)
        self.assertIsNotNone(state["units"][0]["selected_take"])
        self.assertIsNone(state["units"][0]["listened"])
        recovered = state["units"][0]["selected_take"]
        self.create()
        self.assertNotIn(first, [row["scene_id"] for row in self.calls[-1]])
        self.assertEqual(self.state()["units"][0]["selected_take"], recovered)

    def test_shared_store_legacy_approved_api_keeps_original_behavior(self):
        audio=self.root/"legacy.wav";pcm(audio)
        store=VoiceArtifactStore(self.root/"legacy")
        identity=VoiceIdentity("text","voice","generation")
        record=store.register_approved("S01",audio,identity=identity,approval_source="studio-v2-compatibility",migrated_from_checkpoint=True)
        candidate=store.register_candidate("S02",audio,identity=identity)
        self.assertEqual(record["status"],"APPROVED")
        self.assertEqual(store.active_take("S01")["take_id"],record["take_id"])
        self.assertEqual(candidate["status"],"TECH_VALID")
        self.assertIsNone(store.active_take("S02"))
        self.assertTrue(store.restore_approved("S01",self.root/"restored.wav",text_hash="text",voice_profile_hash="voice",generation_profile_hash="generation"))

    def test_rpc_rejects_extra_parameters_and_agent_cannot_grant_voice_approval(self):
        for method,params in (("voice.open",{"project_id":self.project,"path":"../../outside"}),
                              ("projects.command",{"request":{"project_id":self.project,"command_id":"bad","base_revision":0,"kind":"voice.confirm","payload":{}}})):
            response=handle_line(self.service,json.dumps({"id":"check","method":method,"params":params}).encode())
            self.assertFalse(response["ok"])

    def test_atomic_state_replacement_retries_a_transient_windows_reader(self):
        target=self.root/"readers/state.json"
        VoiceArtifactStore._atomic_write(target,{"revision":1})
        original=os.replace
        attempts=[]
        def replace(source,destination):
            attempts.append(1)
            if len(attempts)==1:
                self.assertEqual(json.loads(target.read_text()),{"revision":1})
                raise PermissionError("reader still has old JSON open")
            return original(source,destination)
        with patch("tools.studio.artifacts.os.replace",side_effect=replace):
            VoiceArtifactStore._atomic_write(target,{"revision":2})
        self.assertEqual(json.loads(target.read_text()),{"revision":2})
        self.assertEqual(len(attempts),2)

    def test_cancel_still_kills_owned_process_after_source_drift(self):
        state=self.create()
        source=next(p for p in (self.handle.workspace/".authoring/narration.txt",self.handle.workspace/"narration.txt") if p.exists())
        source.write_text("Changed after approval",encoding="utf8")
        process=MagicMock();process.poll.return_value=None
        self.lab._processes[self.project]=process
        with self.assertRaises(StudioError):
            self.lab.cancel(self.project)
        process.kill.assert_called_once()

    def test_corrupt_candidate_is_visible_for_repair_and_cannot_be_approved(self):
        state=self.create();unit=state["units"][0]
        take=VoiceArtifactStore(self.handle.workspace).takes(unit["id"])[0]
        (self.handle.workspace/take["path"]).write_bytes(b"broken")
        state=self.state()
        self.assertFalse(state["units"][0]["takes"][0]["valid"])
        self.assertEqual(state["status"],"BLOCKED")
        with self.assertRaises((StudioError,RuntimeError)):
            self.lab.playback(self.project,unit["id"],take["take_id"])


if __name__=="__main__":
    unittest.main()
