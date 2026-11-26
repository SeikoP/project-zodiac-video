"""Whole P3/P4 slice. Synthetic approval/timing never asserts creative acceptance."""
import copy
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
import threading
import time
import unittest
from unittest.mock import MagicMock, patch
import urllib.error
import urllib.request

from tools.studio.artifacts import VoiceArtifactStore, canonical_hash, file_sha256
from tools.studio_project.models import StudioError
from tools.studio_project.rpc_stdio import handle_line
from tools.studio_project.service import StudioProjectService
from tools.studio_project.importer import _exclusive_source_lock

ROOT=Path(__file__).resolve().parents[1]
TEXT="\n".join(f"Song Tử hỏi thêm câu {i+1}." for i in range(8))


class VisualWorkspaceTests(unittest.TestCase):
    def test_hyperframes_cover_uses_actual_first_frame_and_mux_rejects_tail(self):
        from tools.studio_project.visual_workspace import VisualWorkspace
        cmd = VisualWorkspace._cover_first_frame_command(Path('rendered.mp4'), Path('cover.png'))
        self.assertEqual(cmd[-1], 'cover.png')
        self.assertNotIn('-ss', cmd)
        self.assertIn('-frames:v', cmd)
        receipt = {'fps': 30, 'frames': 90, 'duration_seconds': 3}
        probe = {'streams': [
            {'codec_type': 'video', 'width': 1080, 'height': 1920, 'avg_frame_rate': '30/1', 'duration': '3', 'nb_frames': '90'},
            {'codec_type': 'audio', 'duration': '3.02'},
        ]}
        VisualWorkspace._verify_export_probe(probe, receipt, 3)
        for changed in (
            {'video_duration': '2.5'}, {'audio_duration': '3.5'},
            {'voice_duration': 3.6}, {'frames': '65'},
        ):
            bad = copy.deepcopy(probe)
            bad_receipt = copy.deepcopy(receipt)
            duration = changed.get('voice_duration', 3)
            bad['streams'][0]['duration'] = changed.get('video_duration', '3')
            bad['streams'][0]['nb_frames'] = changed.get('frames', '90')
            bad['streams'][1]['duration'] = changed.get('audio_duration', '3.02')
            with self.subTest(changed=changed), self.assertRaises(StudioError):
                VisualWorkspace._verify_export_probe(bad, bad_receipt, duration)

    def setUp(self):
        temp=tempfile.TemporaryDirectory(prefix="studio-p34-");self.addCleanup(temp.cleanup)
        self.root=Path(temp.name);text=self.root/"source.txt";text.write_bytes(TEXT.encode("utf8"))
        capsule=self.root/"source.zip"
        subprocess.run(["node",str(ROOT/"tests/studio_phase1_synthetic_fixture.mjs"),str(capsule),"valid",str(text)],cwd=ROOT,capture_output=True,check=True)
        source=self.root/"intent.json"
        subprocess.run(["node",str(ROOT/"tests/studio_p34_fixture.mjs"),str(source),str(text)],cwd=ROOT,capture_output=True,check=True)
        self.intent=json.loads(source.read_text(encoding="utf8"))
        self.service=StudioProjectService(self.root/"projects");self.addCleanup(self.service.close)
        self.project=self.service.import_capsule(capsule)["project_id"]
        self.handle=self.service.registry.get(self.project);self.visual=self.service.visual
        words=[{"text":m.group(),"startMs":i*250,"endMs":(i+1)*250,"source_range":[len(TEXT[:m.start()].encode("utf8")),len(TEXT[:m.end()].encode("utf8"))]} for i,m in enumerate(re.finditer(r"\S+",TEXT))]
        self.voice={"assembly":{"wav_sha256":"f"*64,"valid":True},"timing":{"format":"zodiac-speech-time-map@2","source":"measured_asr","fixture_classification":"SYNTHETIC_TEST_ONLY","narration_sha256":hashlib.sha256(TEXT.encode()).hexdigest(),"wav_sha256":"f"*64,"duration_seconds":len(words)*.25,"words":words}}
        self.voice_patch=patch.object(self.service.voice,"snapshot",side_effect=lambda _id:copy.deepcopy(self.voice));self.voice_patch.start();self.addCleanup(self.voice_patch.stop)

    def state(self):return self.visual.snapshot(self.project)

    def command(self,kind,payload,command_id=None):
        return self.visual.command(self.project,command_id or "test-"+str(time.time_ns()),self.state()["revision"],kind,payload)

    def authored(self):return self.command("source.replace",{"intent":self.intent})

    def test_prior_presentation_build_stays_readable_but_requires_rebuild(self):
        self.authored();self.visual.start(self.project,self.state()["revision"]);built=self.wait()
        self.assertFalse(built["stale_preview"])
        with _exclusive_source_lock(self.handle.workspace, "visual-state"):
            state,_=self.visual._read(self.handle)
            state["build"]["contracts"].pop("presentation_contract_sha256")
            self.visual._save(self.handle,state)
        old=self.state()
        self.assertTrue(old["stale_preview"])
        self.assertEqual(old["stale_reason"],"VISUAL_PRESENTATION_CHANGED_REBUILD_REQUIRED")
        self.assertEqual(old["build"]["id"],built["build"]["id"])
        with self.assertRaises(StudioError) as caught:
            self.visual._export_inputs(self.handle,old,old["intent"])
        self.assertEqual(caught.exception.code,"EXPORT_REBUILD_REQUIRED")

    def wait(self):
        deadline=time.monotonic()+45
        while time.monotonic()<deadline:
            state=self.state()
            if state["job"]["status"]!="RUNNING":return state
            time.sleep(.05)
        self.visual.cancel(self.project);self.fail("Build exceeded fixture timeout")

    def built(self):
        state=self.authored();self.visual.start(self.project,state["revision"]);state=self.wait()
        self.assertEqual(state["job"]["status"],"COMPLETED",state["job"])
        return state

    def test_source_commit_idempotency_revision_undo_and_reopen(self):
        state=self.authored();source=self.handle.workspace/".authoring/visual-intent.json"
        initial=source.read_bytes();revision=state["revision"]
        payload={"scene_id":"s01","entity_id":"gemini","state_id":"neutral","changes":{"x":280}}
        moved=self.visual.command(self.project,"move-one",revision,"scene.patch",payload)
        repeated=self.visual.command(self.project,"move-one",revision,"scene.patch",payload)
        self.assertEqual(moved["revision"],repeated["revision"])
        with self.assertRaises(StudioError):self.visual.command(self.project,"stale",revision,"scene.patch",payload)
        undone=self.command("undo",{});self.assertEqual(undone["intent"],self.intent)
        self.assertEqual(json.loads(initial),json.loads(source.read_bytes()))
        redone=self.command("redo",{});self.assertEqual(redone["intent"]["scenes"][0]["entities"][0]["states"]["neutral"]["transform"]["x"],280)
        reopened=StudioProjectService(self.root/"projects");self.addCleanup(reopened.close)
        self.assertEqual(reopened.visual.snapshot(self.project)["revision"],redone["revision"])
        self.assertEqual((self.handle.workspace/"narration.txt").read_bytes(),TEXT.encode())

    @unittest.skipUnless(os.name=="nt","Windows lock contention regression")
    def test_windows_preview_lock_collision_does_not_sleep_one_second(self):
        entered=threading.Event();observed=[]
        def reader():
            start=time.perf_counter();entered.set()
            with _exclusive_source_lock(self.handle.workspace,"contention-test"):
                observed.append(time.perf_counter()-start)
        with _exclusive_source_lock(self.handle.workspace,"contention-test"):
            worker=threading.Thread(target=reader);worker.start();self.assertTrue(entered.wait(1));time.sleep(.06)
        worker.join(timeout=2);self.assertEqual(len(observed),1);self.assertLess(observed[0],.8)

    @unittest.skipUnless(os.name=="nt","Windows MAX_PATH regression")
    def test_atomic_request_temp_name_can_exceed_windows_max_path(self):
        folder=self.root
        while len(str(folder.resolve()))<210:folder=folder/("nested-"+"x"*14)
        target=folder/"request-input.json"
        self.assertGreater(len(str(target))+37,260)
        VoiceArtifactStore._atomic_write(target,{"source":"unchanged","revision":1})
        self.assertEqual(json.loads(target.read_text(encoding="utf8"))["revision"],1)

    def test_transaction_crash_recovers_one_consistent_source_revision(self):
        state=self.authored();real=VoiceArtifactStore._atomic_write
        def crash(path,payload):
            if path.name=="state.json" and "visual-workspace" in str(path):raise OSError("injected source/state crash")
            return real(path,payload)
        with patch("tools.studio_project.visual_workspace.VoiceArtifactStore._atomic_write",side_effect=crash):
            with self.assertRaises(OSError):self.visual.command(self.project,"theme-crash",state["revision"],"theme.select",{"theme":"dark"})
        recovered=self.state();self.assertEqual(recovered["theme"],"dark");self.assertEqual(recovered["revision"],state["revision"]+1)
        self.assertFalse((self.handle.workspace/".runtime/visual-workspace/pending.json").exists())

    def test_complete_build_safe_preview_origin_and_warm_cache(self):
        state=self.built();self.assertEqual(len(state["build"]["scenes"]),8)
        preview=self.visual.preview(self.project,"s01")
        with urllib.request.urlopen(preview["url"],timeout=3) as response:
            html=response.read();self.assertEqual(hashlib.sha256(html).hexdigest(),preview["sha256"])
            self.assertEqual(response.headers["X-Content-Type-Options"],"nosniff")
        with self.assertRaises(urllib.error.HTTPError):urllib.request.urlopen(preview["url"].replace("s01.html","..%2fstate.json"),timeout=3)
        with self.assertRaises(urllib.error.HTTPError):urllib.request.urlopen(urllib.request.Request(preview["url"],data=b"bad",method="POST"),timeout=3)
        self.visual.start(self.project,state["revision"]);warm=self.wait()
        self.assertEqual(warm["build"]["cache"]["rebuilt"],0);self.assertEqual(warm["approval"],"NOT_GRANTED")

    def test_the_build_manifest_carries_each_scene_camera_so_export_can_repaint_the_same_preview(self):
        state=self.built();folder=self.handle.workspace/".runtime/visual-workspace/builds"/state["build"]["id"]
        rows=json.loads((folder/"manifest.json").read_text("utf8"))["performance_graph"]["scenes"]
        self.assertTrue(all("camera" in row for row in rows))  # without it a scene with a camera move fails EXPORT_PREVIEW_DRIFT

    def test_the_whole_episode_previews_as_one_seekable_composition_and_is_cached(self):
        state=self.built();calls=[]
        def fake(handle,payload,*args,**kw):  # the fixture's synthetic acting is preview-valid but not export-valid: stand in for the painter
            calls.append(payload["action"]);out=Path(payload["output"]);out.mkdir(parents=True,exist_ok=True)
            (out/"index.html").write_text("<html><script>window.__timelines.episode=1</script></html>","utf8");return {}
        with patch.object(self.visual,"_node",side_effect=fake):
            page=self.visual.episode_preview(self.project,state["build"]["id"])
            again=self.visual.episode_preview(self.project,state["build"]["id"])
            with self.assertRaises(StudioError):self.visual.episode_preview(self.project,"0"*32)
        self.assertEqual(calls,["export_prepare"])  # prepared once, then reused while the manifest is unchanged
        self.assertIn("__timelines.episode",page["html"]);self.assertEqual(again["html"],page["html"])
        self.assertGreater(page["duration_ms"],0);self.assertFalse(page["stale"]);self.assertTrue(page["not_an_approval"])

    def test_scoped_edit_reuses_other_scenes_and_theme_preserves_voice(self):
        state=self.built();assets=state["build"]["assets"];voice=copy.deepcopy(self.voice)
        self.command("scene.patch",{"scene_id":"s03","entity_id":"gemini","state_id":"neutral","changes":{"x":280}})
        self.visual.start(self.project,self.state()["revision"],"s03");scoped=self.wait()
        self.assertEqual([e["node_id"] for e in scoped["build"]["cache"]["events"] if not e["hit"]],["scene:s03","appearance:s03"])
        self.command("theme.select",{"theme":"dark"});self.visual.start(self.project,self.state()["revision"]);dark=self.wait()
        self.assertEqual(dark["build"]["assets"],assets);self.assertEqual(self.voice,voice)
        self.assertTrue(all(s["qa"]["caption_contrast"]>=4.5 for s in dark["build"]["scenes"]))

    def test_invalid_build_preserves_last_good_and_marks_timing_drift(self):
        state=self.built();build=state["build"]["id"]
        self.voice["timing"]["words"]=[]
        self.assertTrue(self.state()["stale_preview"])
        self.visual.start(self.project,state["revision"]);failed=self.wait()
        self.assertEqual(failed["job"]["status"],"BLOCKED");self.assertEqual(failed["build"]["id"],build)
        self.assertIn("<svg",__import__('base64').b64decode(re.search(r'data:image/svg\+xml;base64,([^"\s]+)',self.visual.preview(self.project,"s01")["html"])[1]).decode())

    def test_missing_measured_voice_blocks_before_starting_worker(self):
        self.authored();self.voice["timing"]=None
        with self.assertRaises(StudioError):self.visual.start(self.project,self.state()["revision"])
        self.assertIsNone(self.state()["job"])

    def test_preview_tamper_requires_rebuild_and_cannot_be_served(self):
        state=self.built();build=state["build"]["id"]
        file=self.handle.workspace/".runtime/visual-workspace/builds"/build/"s01.html"
        file.write_text("<script>untrusted()</script>")
        with self.assertRaises(StudioError):self.visual.preview(self.project,"s01")
        self.visual.start(self.project,state["revision"]);recovered=self.wait()
        self.assertEqual(recovered["job"]["status"],"COMPLETED")

    def test_no_fit_is_explicit_and_candidate_selection_uses_current_catalog(self):
        self.authored();found=self.visual.candidates(self.project,"s01",{"family_id":"phone"})
        self.assertEqual(found["status"],"CANDIDATES")
        selected=self.command("asset.select",{"scene_id":"s01","candidate_id":found["bundles"][0]["candidate_id"],"requirement":{"family_id":"phone"}})
        self.assertTrue(selected["intent"]["scenes"][0]["entities"][1]["states"]["idle"]["asset"].startswith("studio_prop_"))
        absent=self.visual.candidates(self.project,"s01",{"family_id":"imaginary"})
        self.assertEqual(absent["status"],"NO_FIT_ASSET");self.assertTrue(absent["new_asset_task"])

    def test_unsupported_edits_out_of_scope_approvals_and_unsafe_rpc_rejected(self):
        self.authored()
        for kind,payload in [("voice.approve",{}),("scene.patch",{"scene_id":"s01","entity_id":"gemini","state_id":"neutral","changes":{"html":"<script/>"}})]:
            with self.assertRaises(StudioError):self.command(kind,payload)
        raw=json.dumps({"id":"bad","method":"visual.preview","params":{"project_id":self.project,"scene_id":"../../outside","build_id":"a"*32}}).encode()
        self.assertFalse(handle_line(self.service,raw)["ok"])
        raw=json.dumps({"id":"bad","method":"visual.open","params":{"project_id":self.project,"path":"elsewhere"}}).encode()
        self.assertFalse(handle_line(self.service,raw)["ok"])

    def test_cancel_preserves_build_and_kills_owned_child(self):
        state=self.built();before=state["build"]["id"];entered,release=threading.Event(),threading.Event()
        original=self.visual._node
        def waiting(handle,payload,*args):
            if payload["action"]=="build":entered.set();release.wait(5);raise RuntimeError("cancelled fixture")
            return original(handle,payload,*args)
        with patch.object(self.visual,"_node",side_effect=waiting):
            self.visual.start(self.project,state["revision"]);self.assertTrue(entered.wait(3))
            child=MagicMock();child.poll.return_value=None;self.visual._processes[self.project]=child
            stopped=self.visual.cancel(self.project);child.kill.assert_called_once();release.set();self.visual.close()
        self.assertEqual(stopped["job"]["status"],"CANCELLED");self.assertEqual(self.state()["build"]["id"],before)

    def test_agent_can_apply_only_one_validated_scene_patch_after_confirmation(self):
        state=self.authored();manager=self.service.agent;task_id="a"*32
        project=self.service.project(self.project)
        proposal={"kind":"scene.patch","payload":{"scene_id":"s01","entity_id":"gemini","state_id":"neutral","changes":{"x":300}}}
        task={"task_id":task_id,"project_id":self.project,"status":"COMPLETED","kind":"scene.propose","suggestion":json.dumps(proposal),"source_sha256":project["source_sha256"],"visual_source_hash":state["source_hash"],"visual_revision":state["revision"],"scene_id":"s01","write_applied":False}
        manager._tasks[task_id]=task
        from tools.studio_project.agent_authoring import dependencies
        task["dependencies"] = dependencies(self.service, self.project)
        with self.assertRaises(StudioError):manager.apply_suggestion(task_id,confirm=False,base_revision=state["revision"],command_id="no-confirm")
        with patch.object(self.service.voice, "_read", side_effect=lambda _: copy.deepcopy(self.voice)):
            result=manager.apply_suggestion(task_id,confirm=True,base_revision=state["revision"],command_id="agent-edit")
        self.assertEqual(result["intent"]["scenes"][0]["entities"][0]["states"]["neutral"]["transform"]["x"],300)
        self.assertEqual(self.service.project(self.project)["status"]["visual"],"UNKNOWN")

    def test_second_service_reader_does_not_interrupt_live_owner(self):
        state=self.authored();entered,release=threading.Event(),threading.Event();original=self.visual._node
        def held(handle,payload,*args):
            if payload["action"]=="build":entered.set();release.wait(5)
            return original(handle,payload,*args)
        with patch.object(self.visual,"_node",side_effect=held):
            self.visual.start(self.project,state["revision"]);self.assertTrue(entered.wait(2))
            second=StudioProjectService(self.root/"projects");self.addCleanup(second.close)
            read=second.visual.snapshot(self.project)
            self.assertEqual(read["job"]["status"],"RUNNING")
            with self.assertRaises(StudioError):second.visual.start(self.project,read["revision"])
            release.set();self.assertEqual(self.wait()["job"]["status"],"COMPLETED")

    def test_genuinely_dead_owner_is_marked_interrupted_without_losing_source(self):
        state=self.authored();root,_=self.visual._paths(self.handle)
        record=json.loads((root/"state.json").read_text(encoding="utf8"))
        record["job"]={"id":"f"*32,"status":"RUNNING","owner_pid":os.getpid(),"owner_instance":"dead-instance","ready_scenes":[],"revision":state["revision"],"error":None}
        VoiceArtifactStore._atomic_write(root/"state.json",record)
        recovered=self.state();self.assertEqual(recovered["job"]["status"],"INTERRUPTED")
        self.assertEqual(recovered["intent"],self.intent)


if __name__=="__main__":unittest.main()
