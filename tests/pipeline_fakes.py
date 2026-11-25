"""Shared fakes mirroring the shapes of VisualWorkspace / VoiceLab / AgentManager snapshots."""
from tools.studio.artifacts import canonical_hash
from tools.studio_project.models import StudioError


class _Handle:
    def __init__(self, workspace):
        self.workspace = workspace


class _Registry:
    def __init__(self, workspace):
        self.workspace = workspace

    def get(self, _):
        return _Handle(self.workspace)


class _Part:
    """snapshot() returns the configured value; any other method call is recorded and returns a stub."""

    def __init__(self, name, value, calls):
        self._name, self.value, self.calls = name, value, calls

    def snapshot(self, _):
        if isinstance(self.value, Exception):
            raise self.value
        return self.value

    def __getattr__(self, method):
        def call(*args, **kwargs):
            self.calls.append((f"{self._name}.{method}", args, kwargs))
            if method.startswith("start_") or method == "task":
                return {"task_id": "task-1", "status": "RUNNING"}
            return {"ok": True}
        return call


class FakeService:
    def __init__(self, workspace, *, content="APPROVED", video="UNKNOWN", visual=None, voice=None, agent_task=None):
        self.calls = []
        self._project = {"project_id": "p", "status": {"content": content, "video": video}}
        self.registry = _Registry(workspace)
        self.visual = _Part("visual", visual, self.calls)
        self.voice = _Part("voice", voice, self.calls)
        self.agent = _Part("agent", None, self.calls)
        self.agent_task = agent_task

    def project(self, project_id):
        if project_id != "p":
            raise StudioError("PROJECT_NOT_FOUND", project_id, "project")
        return self._project


TIMING = {"wav_sha256": "w1", "words": [{"text": "a"}]}


def voice_state(**changes):
    state = {"revision": 4, "units": [{"id": "u1", "selected_take": "t1", "takes": [{"take_id": "t1", "valid": True}]}],
             "assembly": {"wav_sha256": "w1", "listened": {"kind": "user_listened"}}, "timing": TIMING, "job": None,
             "voice": "Hải Đăng"}
    state.update(changes)
    return state


def visual_state(**changes):
    state = {"revision": 5, "source_hash": "h1", "intent": {"scenes": [{"id": "s01"}, {"id": "s02"}]},
             "build": {"id": "b1", "revision": 5, "scenes": [{"id": "s01"}, {"id": "s02"}],
                       "voice_timing_fingerprint": canonical_hash(TIMING)}, "job": None}
    state.update(changes)
    return state
