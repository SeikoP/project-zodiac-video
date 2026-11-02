import json
import os
import tempfile
import unittest
import zipfile
from datetime import datetime
from pathlib import Path

from tools.application import library
from tools.application.library_cli import main


def make_zip(path: Path, job_id: str | None, payload: str = "x", mtime: float | None = None):
    with zipfile.ZipFile(path, "w") as archive:
        if job_id:
            archive.writestr("package-manifest.json", json.dumps({"job": {"id": job_id, "revision": "1"}, "renderer": {"version": "2.0.1"}}))
        archive.writestr("payload.txt", payload)
    if mtime:
        os.utime(path, (mtime, mtime))


def make_job(base: Path, name: str, job_id: str, mtime: float, video=False, legacy=False):
    job = base / name
    job.mkdir(parents=True)
    if not legacy:
        (job / "package-manifest.json").write_text(json.dumps({"job": {"id": job_id, "revision": "1"}}), encoding="utf-8")
    if video:
        (job / "out").mkdir()
        (job / "out" / "final.mp4").write_bytes(b"v" * 10)
    os.utime(job, (mtime, mtime))
    for item in job.rglob("*"):
        os.utime(item, (mtime, mtime))


class LibraryTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.ws = self.root / ".zodiac-work"
        (self.root / "ready").mkdir()
        self.ws.mkdir()

    def tearDown(self):
        self._tmp.cleanup()

    def by_name(self, entries):
        return {e.name: e for e in entries}

    def test_older_packages_of_one_job_are_superseded_and_newest_is_latest(self):
        make_zip(self.root / "ready" / "a-old.zip", "songtu", "1", 1000)
        make_zip(self.root / "ready" / "a-new.zip", "songtu", "2", 2000)
        make_zip(self.root / "ready" / "other.zip", "bocap", "3", 1500)
        e = self.by_name(library.scan(self.root, self.ws))
        self.assertTrue(e["a-new.zip"].is_latest and e["a-new.zip"].verdict == "keep")
        self.assertEqual(e["a-old.zip"].verdict, "archive")
        self.assertTrue(e["other.zip"].is_latest)

    def test_identical_bytes_keep_only_one(self):
        make_zip(self.root / "ready" / "p.zip", "j", "same", 1000)
        (self.root / "ready" / "p (1).zip").write_bytes((self.root / "ready" / "p.zip").read_bytes())
        os.utime(self.root / "ready" / "p (1).zip", (500, 500))
        e = self.by_name(library.scan(self.root, self.ws))
        self.assertEqual([x.verdict for x in (e["p.zip"], e["p (1).zip"])], ["keep", "archive"])

    def test_unrelated_packages_without_manifest_are_never_guessed_away(self):
        make_zip(self.root / "ready" / "toolkit.zip", None, "1", 1000)
        make_zip(self.root / "ready" / "notes.zip", None, "2", 2000)
        self.assertTrue(all(x.verdict == "keep" for x in library.scan(self.root, self.ws)))

    def test_copy_suffix_and_version_suffix_group_without_manifest(self):
        make_zip(self.root / "ready" / "plugin-2.5.0.zip", None, "a", 1000)
        make_zip(self.root / "ready" / "plugin-2.6.0.zip", None, "b", 2000)
        e = self.by_name(library.scan(self.root, self.ws))
        self.assertEqual(e["plugin-2.5.0.zip"].verdict, "archive")
        self.assertTrue(e["plugin-2.6.0.zip"].is_latest)

    def test_older_job_keeps_if_it_holds_the_only_video(self):
        jobs = self.ws / "v2" / "jobs"
        make_job(jobs, "r01", "x", 1000, video=True)
        make_job(jobs, "r02", "x", 2000, video=False)
        e = self.by_name(library.scan(self.root, self.ws))
        self.assertTrue(e["r02"].is_latest)
        self.assertEqual(e["r01"].verdict, "keep")

    def test_older_job_is_archived_when_latest_has_video(self):
        jobs = self.ws / "v2" / "jobs"
        make_job(jobs, "r01", "x", 1000, video=True)
        make_job(jobs, "r02", "x", 2000, video=True)
        self.assertEqual(self.by_name(library.scan(self.root, self.ws))["r01"].verdict, "archive")

    def test_legacy_job_rules(self):
        make_job(self.ws / "v2" / "jobs", "same", "same", 2000)
        make_job(self.ws / "jobs", "same", "same", 1000, legacy=True)
        make_job(self.ws / "jobs", "keepme", "keepme", 1000, video=True, legacy=True)
        make_job(self.ws / "jobs", "empty", "empty", 1000, legacy=True)
        e = {x.path.parent.name + "/" + x.name: x for x in library.scan(self.root, self.ws)}
        self.assertEqual(e["jobs/same"].verdict, "archive")
        self.assertEqual(e["jobs/keepme"].verdict, "keep")
        self.assertEqual(e["jobs/empty"].verdict, "archive")

    def test_cleanup_moves_then_restore_brings_back(self):
        make_zip(self.root / "ready" / "old.zip", "j", "1", 1000)
        make_zip(self.root / "ready" / "new.zip", "j", "2", 2000)
        entries = library.scan(self.root, self.ws)
        batch = library.apply_cleanup(library.plan_cleanup(entries), self.ws, now=datetime(2026, 1, 1))
        self.assertFalse((self.root / "ready" / "old.zip").exists())
        self.assertTrue((self.root / "ready" / "new.zip").exists())
        self.assertEqual(library.restore(batch), 1)
        self.assertTrue((self.root / "ready" / "old.zip").exists())

    def test_caches_need_explicit_flag(self):
        (self.ws / "scratch").mkdir()
        (self.ws / "scratch" / "x.json").write_text("{}")
        entries = library.scan(self.root, self.ws)
        self.assertEqual(library.plan_cleanup(entries), [])
        self.assertEqual(len(library.plan_cleanup(entries, caches=True)), 1)

    def test_cli_is_a_dry_run_unless_yes(self):
        make_zip(self.root / "ready" / "old.zip", "j", "1", 1000)
        make_zip(self.root / "ready" / "new.zip", "j", "2", 2000)
        args = ["--project", str(self.root), "--workspace", str(self.ws)]
        self.assertEqual(main(args + ["clean"]), 0)
        self.assertTrue((self.root / "ready" / "old.zip").exists())
        self.assertEqual(main(args + ["clean", "--yes"]), 0)
        self.assertFalse((self.root / "ready" / "old.zip").exists())
        self.assertEqual(main(args + ["list"]), 0)


if __name__ == "__main__":
    unittest.main()
