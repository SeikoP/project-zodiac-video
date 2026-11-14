"""P0 evidence ledger validation. A declared PASS does not mean a verified PASS."""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

_FORMAT = "zodiac-studio-phase-evidence@1"
_SHA = re.compile(r"^[0-9a-f]{64}$")
_COMMIT = re.compile(r"^[0-9a-fA-F]{40}$")


def _digest_file(root: Path, relative: object, expected: object) -> bool:
    if not isinstance(relative, str) or not isinstance(expected, str) or \
            not _SHA.fullmatch(expected):
        return False
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts or not relative.strip():
        return False
    target = root / rel
    if target.is_symlink() or not target.resolve().is_relative_to(root):
        return False
    try:
        digest = hashlib.sha256()
        with target.open("rb") as f:
            for chunk in iter(lambda: f.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest() == expected
    except OSError:
        return False


def evaluate_phase_gate(report: dict, required_ids: set[str],
                        *, evidence_root: Path | None = None) -> dict:
    """Validate checked-in evidence at the phase boundary, not user approvals."""
    root = Path(evidence_root or Path.cwd()).resolve()
    issues: list[dict] = []

    def issue(code: str, detail: str):
        issues.append({"code": code, "detail": detail})

    if not isinstance(report, dict):
        return {"format": _FORMAT, "status": "BLOCKED",
                "issues": [{"code": "EVIDENCE_INVALID", "detail": "Not an object"}]}
    if report.get("format") != _FORMAT:
        issue("EVIDENCE_FORMAT_UNSUPPORTED", str(report.get("format")))
    for key in ("phase_id", "task_id"):
        if not isinstance(report.get(key), str) or not report[key].strip():
            issue("EVIDENCE_ID_MISSING", key)
    for key in ("baseline_commit", "implementation_commit"):
        if not isinstance(report.get(key), str) or not _COMMIT.fullmatch(report[key]):
            issue("EVIDENCE_COMMIT_INVALID", key)
    for key in ("requirements", "contracts", "reused_components", "changed_files",
                "test_runs", "smoke_artifacts", "review_gates", "risks", "deferred"):
        if not isinstance(report.get(key), list):
            issue("EVIDENCE_FIELD_INVALID", key)
    if not isinstance(report.get("rollback"), str) or not report["rollback"].strip():
        issue("EVIDENCE_ROLLBACK_MISSING", "Rollback must be actionable")
    if report.get("handoff_ready") is not True:
        issue("EVIDENCE_HANDOFF_NOT_READY", "Handoff requires explicit readiness")

    tests = report.get("test_runs", []) if isinstance(report.get("test_runs"), list) else []
    known_tests: set[str] = set()
    if not tests:
        issue("EVIDENCE_TESTS_MISSING", "No reproducible run")
    for index, test in enumerate(tests):
        if not isinstance(test, dict):
            issue("EVIDENCE_TEST_INVALID", str(index))
            continue
        test_id = test.get("id")
        if not isinstance(test_id, str) or not test_id.strip() or test_id in known_tests:
            issue("EVIDENCE_TEST_ID_INVALID", str(test_id))
        else:
            known_tests.add(test_id)
        if not isinstance(test.get("command"), str) or not test["command"].strip() or \
                test.get("status") != "PASS" or type(test.get("exit_code")) is not int or \
                test["exit_code"] != 0:
            issue("EVIDENCE_TEST_UNVERIFIED", str(test_id))
        if not _digest_file(root, test.get("log_ref"), test.get("log_sha256")):
            issue("EVIDENCE_TEST_LOG_UNVERIFIED", str(test_id))

    requirements = report.get("requirements", [])
    requirements = requirements if isinstance(requirements, list) else []
    seen: set[str] = set()
    for entry in requirements:
        if not isinstance(entry, dict):
            issue("EVIDENCE_REQUIREMENT_INVALID", str(entry))
            continue
        requirement_id = entry.get("id")
        if not isinstance(requirement_id, str) or not requirement_id or requirement_id in seen:
            issue("EVIDENCE_REQUIREMENT_DUPLICATE", str(requirement_id))
            continue
        seen.add(requirement_id)
        refs = entry.get("test_refs")
        if entry.get("status") not in ("TESTED", "REVIEWED") or \
                not isinstance(refs, list) or not refs or \
                not all(isinstance(ref, str) and ref in known_tests for ref in refs):
            issue("EVIDENCE_REQUIREMENT_UNVERIFIED", requirement_id)
    for missing in sorted(required_ids - seen):
        issue("EVIDENCE_REQUIRED_ITEM_MISSING", missing)

    for name in ("contracts", "changed_files", "reused_components"):
        if not report.get(name):
            issue("EVIDENCE_SCOPE_MISSING", name)
    for contract in (report.get("contracts") if isinstance(report.get("contracts"), list) else []):
        if not isinstance(contract, dict) or not contract.get("name") or \
                contract.get("result") not in ("PRESERVED", "COMPATIBLE", "NEW_VALIDATED"):
            issue("EVIDENCE_CONTRACT_UNVERIFIED", str(contract))
    for name in ("smoke_artifacts", "review_gates"):
        if not report.get(name):
            issue("EVIDENCE_PROOF_MISSING", name)
    for artifact in (report.get("smoke_artifacts") if isinstance(report.get("smoke_artifacts"), list) else []):
        if not isinstance(artifact, dict) or \
                not _digest_file(root, artifact.get("path"), artifact.get("sha256")):
            issue("EVIDENCE_ARTIFACT_UNVERIFIED", str(artifact))
    for gate in (report.get("review_gates") if isinstance(report.get("review_gates"), list) else []):
        if not isinstance(gate, dict) or gate.get("status") != "REVIEWED" or \
                not _digest_file(root, gate.get("evidence_ref"), gate.get("evidence_sha256")):
            issue("EVIDENCE_REVIEW_PENDING", str(gate.get("id") if isinstance(gate, dict) else gate))
    return {"format": _FORMAT, "status": "BLOCKED" if issues else "MERGE_READY", "issues": issues}
