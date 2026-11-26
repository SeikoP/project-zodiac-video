"""Prop families (Visual V5 design, P3 slice): family -> model -> state, derived from the V4 library.

Spec: docs/superpowers/specs/2026-11-14-v5-prop-variant-diversity.md. The taxonomy keeps five axes apart: a *model* is a
physical silhouette, a *state* is what one model shows (the V4 phone files phone/busy/ping/quiet/silent are one model in
five states), a *view* is a camera presentation. This module reads `props/index.json` and the SVG bodies; it writes
nothing, deletes nothing and never invents geometry. A model or state the library lacks is NEW_VARIANT_MASTER_REQUIRED.
"""
from __future__ import annotations

import hashlib
import re
from pathlib import Path

DEFAULT_MODEL = "v4-default"
VIEWS = ("front",)  # only the front view has real geometry in the library; any other view needs a new master
_PATH_D = re.compile(r'<path\b[^>]*?\bd="([^"]+)"')


class PropVariantRequired(Exception):
    """The requested family/model/state/view has no registered master; the answer is a new master, not a substitute."""
    code = "NEW_VARIANT_MASTER_REQUIRED"

    def __init__(self, message: str, **details):
        super().__init__(message)
        self.details = details


def _geometry(assets_root: Path, path: str) -> str:
    """Hash of the exterior body path (the first <path>): silhouette identity, independent of fill, text or badge."""
    try:
        svg = (Path(assets_root) / path).read_text(encoding="utf8")
    except OSError:
        return ""
    first = _PATH_D.search(svg)
    return hashlib.sha256(re.sub(r"\s+", " ", (first.group(1) if first else svg)).encode()).hexdigest()


def build_manifest(props: list[dict], assets_root: Path) -> dict:
    by_id = {p["id"]: p for p in props}

    def placement(prop):
        if "identity" in prop:
            ident = prop["identity"]
            return ident["family_id"], ident["model_id"], ident.get("state_id") or "idle"
        parent_id = prop.get("state_of")
        if parent_id in by_id:
            family, model, _ = placement(by_id[parent_id])
            return family, model, prop["id"][len(parent_id) + 1:] if prop["id"].startswith(parent_id + "-") else prop["id"]
        if prop["id"].startswith("meme-label-"):
            return "meme-label", DEFAULT_MODEL, prop["id"][len("meme-label-"):]
        return prop["id"], DEFAULT_MODEL, "default"

    families: dict[str, dict] = {}
    by_prop: dict[str, dict] = {}
    for prop in props:
        family_id, model_id, state_id = placement(prop)
        family = families.setdefault(family_id, {"id": family_id, "models": {}, "contexts": [], "roles": []})
        model = family["models"].setdefault(model_id, {"states": {}, "geometry_by_state": {}, "review": None, "base": None})
        model["states"][state_id] = prop["id"]
        model["geometry_by_state"][state_id] = _geometry(assets_root, prop["path"])
        if model["base"] is None or state_id in ("default", "idle"):
            model["base"] = prop["id"]
            model["review"] = prop.get("review") or ("V4_ACCEPTED" if "identity" not in prop else "PENDING")
        for context in prop.get("contexts", []):
            if context not in family["contexts"]:
                family["contexts"].append(context)
        if prop.get("role") not in family["roles"]:
            family["roles"].append(prop.get("role"))
        by_prop[prop["id"]] = {"family_id": family_id, "model_id": model_id, "state_id": state_id}

    for family in families.values():
        for model in family["models"].values():
            base_state = next(s for s, pid in model["states"].items() if pid == model["base"])
            model["geometry_sha256"] = model["geometry_by_state"][base_state]
            model["geometry_consistent"] = len(set(model.pop("geometry_by_state").values())) == 1
        shas = [m["geometry_sha256"] for m in family["models"].values()]
        family["distinct_geometry"] = len(shas) > 1 and len(set(shas)) == len(shas)
    return {"format": "zodiac-prop-families@1", "families": families, "by_prop": by_prop}


def resolve(manifest: dict, family_id: str, model_id: str | None = None, state_id: str | None = None, view_id: str = "front") -> dict:
    family = manifest["families"].get(family_id)
    if family is None:
        raise PropVariantRequired(f"Không có prop family {family_id!r} trong thư viện", family_id=family_id)
    if view_id not in VIEWS:
        raise PropVariantRequired(f"{family_id}: chưa có hình học cho góc nhìn {view_id!r}", family_id=family_id, view_id=view_id)
    model_id = model_id or (DEFAULT_MODEL if DEFAULT_MODEL in family["models"] else next(iter(family["models"])))
    model = family["models"].get(model_id)
    if model is None:
        raise PropVariantRequired(f"{family_id}: không có model {model_id!r}", family_id=family_id, model_id=model_id,
                                  available=sorted(family["models"]))
    if state_id is None:
        state_id = next((s for s in ("default", "idle") if s in model["states"]), next(iter(model["states"])))
    prop_id = model["states"].get(state_id)
    if prop_id is None:
        raise PropVariantRequired(f"{family_id}/{model_id}: không có trạng thái {state_id!r}", family_id=family_id,
                                  model_id=model_id, state_id=state_id, available=sorted(model["states"]))
    return {"prop_id": prop_id, "path": f"props/{prop_id}.svg", "family_id": family_id, "model_id": model_id,
            "state_id": state_id, "view_id": view_id}


def check_model_consistency(manifest: dict, intent: dict) -> list[dict]:
    """Hard consistency rules of the spec (§2 owner_id, test 3), applied to the library props of a Visual Intent.

    * One prop entity keeps one physical model across all its states (states change what it shows, not what it is).
    * One declared ``owner_id`` keeps one model per family across the episode (a recurring owner's device does not
      silently become another device). An entity with no owner_id is not tied to anyone, so nothing is claimed for it.
    Assets that are not library props (story visuals, generated art) are not judged here.
    """
    assets = (intent or {}).get("assets") or {}
    issues, owned = [], {}
    for scene in (intent or {}).get("scenes") or []:
        for entity in scene.get("entities") or []:
            per_family: dict[str, set[str]] = {}
            for state in (entity.get("states") or {}).values():
                path = str(((assets.get((state or {}).get("asset")) or {}).get("path")) or "")
                placed = manifest["by_prop"].get(path.rsplit("/", 1)[-1].removesuffix(".svg")) if path.startswith("library:") else None
                if placed:
                    per_family.setdefault(placed["family_id"], set()).add(placed["model_id"])
            for family_id, models in per_family.items():
                if len(models) > 1:
                    issues.append({"code": "PROP_MODEL_CHANGED_WITHIN_ENTITY", "scene_id": scene.get("id"), "entity_id": entity.get("id"),
                                   "family_id": family_id, "models": sorted(models),
                                   "message": f"{scene.get('id')}/{entity.get('id')}: các trạng thái dùng nhiều model {sorted(models)}; "
                                              "đổi trạng thái thì giữ model, muốn đổi model hãy dùng entity khác."})
                elif entity.get("owner_id"):
                    owned.setdefault((entity["owner_id"], family_id), {}).setdefault(next(iter(models)), []).append(scene.get("id"))
    for (owner, family_id), models in owned.items():
        if len(models) > 1:
            issues.append({"code": "PROP_OWNER_MODEL_DRIFT", "owner_id": owner, "family_id": family_id,
                           "models": sorted(models), "scene_ids": sorted({s for ids in models.values() for s in ids}),
                           "message": f"{owner} dùng nhiều model {family_id} ({sorted(models)}); một chủ sở hữu giữ một model "
                                      "trừ khi câu chuyện đổi thiết bị."})
    return issues


def reuse_profile(manifest: dict, episodes: list[tuple[str, dict]], lookback: int = 8) -> dict:
    """How many of the most recent episodes (newest first, bounded) used each family+model. Counts episodes, not files."""
    recent = episodes[:max(0, lookback)]
    counts: dict[tuple[str, str], set[str]] = {}
    for episode_id, intent in recent:
        for asset in ((intent or {}).get("assets") or {}).values():
            path = str((asset or {}).get("path", ""))
            if not path.startswith("library:"):
                continue
            placed = manifest["by_prop"].get(path.rsplit("/", 1)[-1].removesuffix(".svg"))
            if placed:
                counts.setdefault((placed["family_id"], placed["model_id"]), set()).add(episode_id)
    usage = [{"family_id": f, "model_id": m, "episodes": len(ids)} for (f, m), ids in counts.items()]
    usage.sort(key=lambda row: (-row["episodes"], row["family_id"], row["model_id"]))
    return {"episodes_considered": len(recent), "usage": usage}


def diversity_hints(manifest: dict, profile: dict, threshold: int = 3) -> list[dict]:
    """Soft hints for a family+model repeated across distinct episodes. Never a ban and never a made-up alternative."""
    hints = []
    for row in profile["usage"]:
        if row["episodes"] < threshold:
            continue
        family = manifest["families"][row["family_id"]]
        alternatives = sorted(m for m in family["models"] if m != row["model_id"])
        hints.append({"family_id": row["family_id"], "model_id": row["model_id"], "episodes": row["episodes"],
                      "alternative_models": alternatives,
                      "scarcity": None if alternatives else "NEW_VARIANT_MASTER_REQUIRED",
                      "note": "Gợi ý mềm, không cấm dùng lại: nếu cùng nhân vật dùng cùng thiết bị thì giữ nguyên; "
                              "chỉ đổi model khi câu chuyện cho phép, hoặc bỏ prop nếu cảnh vẫn đứng được."})
    return hints
