from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Sequence

from .authoring import load_authoring_ir
from .errors import ControlPlaneError
from .render_plan import target_overlap_count, validate_render_plan
from .timeline import compile_render_plan
from .lineage_audit import inspect_lineage


def _read_json(path: Path, *, code: str) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ControlPlaneError(
            code=code,
            stage="PACKAGE" if code == "PACKAGE_INVALID" else "PLAN",
            message=f"cannot read {path.name}: {exc}",
            detail={"path": str(path)},
        ) from exc
    if not isinstance(payload, dict):
        raise ControlPlaneError(
            code=code,
            stage="PACKAGE" if code == "PACKAGE_INVALID" else "PLAN",
            message=f"{path.name} root must be an object",
            detail={"path": str(path)},
        )
    return payload


def build_package(package_root: Path, output: Path | None = None) -> Path:
    root = Path(package_root).resolve()
    ir = load_authoring_ir(root / "production.ir.json")
    print("PACKAGE_VALID")

    timing = _read_json(
        root / ".runtime" / "timing.json",
        code="TIMING_INVALID",
    )
    design = _read_json(root / "design-token.json", code="DESIGN_TOKEN_INVALID")

    plan = compile_render_plan(ir, timing, design)
    print("PLAN_COMPILED")
    validate_render_plan(plan, ir)
    print("PLAN_VALID")
    lineage = inspect_lineage(ir, plan)
    if lineage["status"] != "PASS":
        raise ControlPlaneError(code="PLAN_LINEAGE_DRIFT", stage="PLAN", message="authored event/asset lineage was lost during plan compilation", detail={"issues": lineage["issues"]})
    print(f"LINEAGE_VERIFIED_EVENTS={lineage['events']}")
    print(f"TARGET_OVERLAP_COUNT={target_overlap_count(plan)}")

    destination = Path(output).resolve() if output is not None else root / ".runtime" / "render-plan.json"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(plan, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    return destination


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="zodiac-control")
    subparsers = parser.add_subparsers(dest="command", required=True)
    build = subparsers.add_parser("build", help="compile a zodiac-job@5 authoring package into a render plan")
    build.add_argument("package_root", type=Path)
    build.add_argument("--output", type=Path)
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "build":
            build_package(args.package_root, args.output)
            return 0
    except ControlPlaneError as exc:
        print(
            json.dumps(exc.to_dict(), ensure_ascii=False, sort_keys=True, separators=(",", ":")),
            file=sys.stderr,
        )
        return 2
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
