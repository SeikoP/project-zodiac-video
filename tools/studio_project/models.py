"""Project metadata types. Review approval is never issued by this module."""
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ProjectHandle:
    project_id: str
    workspace: Path
    imported_source_sha256: str
    episode_id: str


@dataclass(frozen=True)
class StudioIssue:
    code: str
    message: str
    stage: str


@dataclass(frozen=True)
class EpisodeStatus:
    project_id: str
    content: str = "UNKNOWN"
    voice: str = "UNKNOWN"
    visual: str = "UNKNOWN"
    video: str = "UNKNOWN"
    published: str = "UNKNOWN"


class StudioError(Exception):
    def __init__(self, code: str, message: str = "", stage: str = "registry"):
        self.code = code
        self.message = message or code
        self.stage = stage
        super().__init__(f"{code}: {self.message}")

    @property
    def issue(self) -> StudioIssue:
        return StudioIssue(self.code, self.message, self.stage)
