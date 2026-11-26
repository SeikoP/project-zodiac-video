"""Catalog v5: a derived, additive index over the V4 asset library.

It adds no artwork and changes no V4 file. It gives the authoring agent and the pipeline three things V4 lacks:

* a compact prompt form of the catalog (about half the characters; the model sees ids and contexts, not repeated paths),
* semantic groups for poses and expressions, so a choice is made by what it says, not by guessing an id,
* nearest-neighbour lookup, so a prop, pose or expression that is not in the library is replaced by the closest real one
  in code instead of failing the whole proposal and costing the model another attempt.

Everything is computed from the V4 registries on each build, so it cannot drift from them.

Not to be confused with the Visual V5 design in docs/superpowers/specs/2026-11-14-v5-prop-variant-diversity.md (prop
families, models, appearances, lazy compilation). That design is still unimplemented; this module is only a prompt and
lookup layer over the existing V4 library and removes or generates no asset.
"""
from __future__ import annotations

import re
from typing import Iterable

FORMAT = "zodiac-asset-catalog@5"

# Meaning groups. Every id of the V4 component catalog must appear in exactly one group; tests enforce it so a new pose
# or expression cannot be added without saying what it is for.
POSE_GROUPS = {
    "speaking": ["neutral", "explain", "point-up", "beckon", "hand-on-chest", "shush", "salute", "stop-hand"],
    "giving_taking": ["reach", "offer", "offer-pants", "receive-pants", "receive-object", "hold-two-props", "open-barrier"],
    "conflict": ["confront", "recoil", "arms-crossed", "hands-on-hips", "raise-evidence", "point-choice"],
    "distress": ["facepalm", "cry-hug", "slump", "scratch-head", "shrug"],
    "joy": ["cheer", "clap", "dance", "wave", "cheek-poke"],
    "handling": ["inspect-prop", "flex-prop", "write", "read", "carry-backpack", "text-phone", "phone-call", "hold-broom"],
    "calm": ["rest_sitting", "rest_lying", "think-chin", "clasp-hands"],
    "movement": ["run"],
}
EXPRESSION_GROUPS = {
    "flat": ["neutral", "deadpan", "meme-deadpan", "weary", "meme-drained"],
    "alarm": ["panic", "meme-panic", "meme-confused"],
    "smug_sly": ["smug", "meme-smug", "side-eye", "meme-side-eye"],
    "distress": ["cry", "meme-sob", "exasperated", "embarrassed", "meme-cringe", "meme-grimace"],
    "relief": ["relieved"],
}
# Plain words a model tends to use for ids the library does not have; each maps to a real id.
SYNONYMS = {
    "angry": "exasperated", "annoyed": "exasperated", "mad": "exasperated", "sad": "cry", "crying": "cry", "tears": "cry",
    "happy": "relieved", "glad": "relieved", "scared": "panic", "afraid": "panic", "shocked": "panic", "surprised": "panic",
    "confused": "meme-confused", "bored": "weary", "tired": "weary", "sly": "smug", "proud": "smug", "shy": "embarrassed",
    "awkward": "meme-cringe", "suspicious": "side-eye", "blank": "deadpan", "calm": "neutral",
    "talk": "explain", "talking": "explain", "speak": "explain", "point": "point-up", "pointing": "point-up",
    "give": "offer", "giving": "offer", "take": "receive-object", "hug": "cry-hug", "think": "think-chin", "thinking": "think-chin",
    "sit": "rest_sitting", "sitting": "rest_sitting", "lie": "rest_lying", "sleep": "rest_lying", "walk": "run",
    "phone": "text-phone", "type": "text-phone", "call": "phone-call", "celebrate": "cheer", "hello": "wave", "bye": "wave",
}


# Furniture words the library has no prop for, mapped to a real prop that can stand in for background SET DRESSING only
# (entities named depth__*). A story prop is never swapped this way; it is asked for instead (record_asset_requests).
DRESSING_ALIASES = {"table": "laptop", "desk": "laptop", "counter": "laptop", "bàn": "laptop", "shelf": "book", "bookshelf": "book",
                    "lamp": "lightbulb", "plant": "potted-plant", "cup": "coffee-cup", "mug": "coffee-cup"}


def dressing_alias(wanted: str) -> str | None:
    return DRESSING_ALIASES.get(prop_id(wanted).lower())


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", text.lower()) if t}


def _jaccard(a: set, b: set) -> float:
    return len(a & b) / len(a | b) if a and b else 0.0


def group_of(groups: dict[str, list[str]], value: str) -> str | None:
    return next((name for name, members in groups.items() if value in members), None)


def ungrouped(groups: dict[str, list[str]], ids: Iterable[str]) -> list[str]:
    seen = {m for members in groups.values() for m in members}
    return [i for i in ids if i not in seen]


def prop_id(prop_or_path: str) -> str:
    base = prop_or_path.rsplit("/", 1)[-1]
    return base[:-4] if base.endswith(".svg") else base


MEME_PREFIX = "meme-label-"
MEME_CONTEXT = "optional-meme-lettering"


def compact_props(props: list[dict], manifest: dict | None = None) -> dict:
    """Prompt form. With a prop-family manifest the agent sees one entry per family, not one per file:
    ``"phone:ctx,ctx|v4-default=phone,phone-busy;phone-rounded"`` (model=its state files). Without one, one entry per prop.

    Meme labels are one third of the library and share everything but a slug, so they are listed once as slugs. Only a
    path that breaks ``props/<id>.svg`` is spelled out.
    """
    rows, odd, memes = [], {}, []
    by_id = {p["id"]: p for p in props}
    for prop in props:
        slug = prop["id"][len(MEME_PREFIX):]
        if (prop["id"].startswith(MEME_PREFIX) and prop.get("contexts", []) == [MEME_CONTEXT, slug]
                and prop.get("path") == f"props/{prop['id']}.svg"):
            memes.append(slug)
        if prop.get("path") != f"props/{prop['id']}.svg":
            odd[prop["id"]] = prop.get("path")
    meme_ids = {MEME_PREFIX + s for s in memes}
    if manifest is None:
        rows = [p["id"] + ":" + ",".join(p.get("contexts", [])) for p in props if p["id"] not in meme_ids]
    else:
        for family in manifest["families"].values():
            members = [pid for model in family["models"].values() for pid in model["states"].values() if pid not in meme_ids]
            if not members:
                continue
            contexts = ",".join(family["contexts"])
            if len(members) == 1 and members[0] == family["id"]:
                rows.append(f"{family['id']}:{contexts}")
                continue
            models = ";".join(f"{mid}=" + ",".join(pid for pid in m["states"].values() if pid in by_id)
                              for mid, m in family["models"].items())
            rows.append(f"{family['id']}:{contexts}|{models}")
    return {"format": "family:contexts|model=file-ids" if manifest else "id:contexts", "path_rule": "library:props/<id>.svg",
            "path_exceptions": odd, "items": rows,
            "choose": "Use one file id as the asset path. A model is a physical silhouette, a state file only changes what it shows: "
                      "pick another model (not another state) when a scene needs a different-looking prop." if manifest else "",
            "meme_labels": {"id_prefix": MEME_PREFIX, "context": MEME_CONTEXT, "slugs": memes}}


def listed_prop_ids(compact: dict) -> list[str]:
    """Every prop id a compact_props() result offers (used to prove the compact form loses nothing)."""
    labels = compact.get("meme_labels") or {}
    ids = []
    for row in compact["items"]:
        head, _, models = row.partition("|")
        if models:
            ids += [pid for chunk in models.split(";") for pid in chunk.split("=", 1)[1].split(",")]
        else:
            ids.append(head.split(":")[0])
    return ids + [labels.get("id_prefix", "") + s for s in labels.get("slugs", [])]


def compact_components(components: dict) -> dict:
    """Poses and expressions grouped by meaning; ids the groups do not know stay listed under 'other'."""
    out = dict(components)
    for key, groups in (("poses", POSE_GROUPS), ("expressions", EXPRESSION_GROUPS)):
        known = {m for members in groups.values() for m in members}
        grouped = {name: [m for m in members if m in components[key]] for name, members in groups.items()}
        other = [i for i in components[key] if i not in known]
        out[key] = {**{k: v for k, v in grouped.items() if v}, **({"other": other} if other else {})}
    return out


def nearest_props(props: list[dict], wanted: str, k: int = 3, minimum: float = 0.34) -> list[dict]:
    """The k library props closest to a requested id or path, best first; empty when nothing is close enough."""
    want = prop_id(wanted)
    want_tokens = _tokens(want)
    scored = []
    for prop in props:
        tokens = _tokens(prop["id"])
        score = _jaccard(want_tokens, tokens)
        if want_tokens and tokens and (want in prop["id"] or prop["id"] in want):
            score = max(score, 0.7)
        if score and prop.get("role") == "story_prop":
            score += 0.02  # ordinary props before meme lettering when two are equally close
        scored.append((score, prop))
    scored.sort(key=lambda pair: (-pair[0], pair[1]["id"]))
    return [{"id": p["id"], "path": p["path"], "score": round(s, 3)} for s, p in scored[:k] if s >= minimum]


def nearest_component(value: str, options: list[str]) -> str | None:
    """A real pose/expression id for one the library does not have, or None."""
    if value in options:
        return value
    word = str(value).lower().strip().replace(" ", "-").replace("_", "-")
    mapped = SYNONYMS.get(word)
    if mapped in options:
        return mapped
    want = _tokens(word)
    best = max(((_jaccard(want, _tokens(o)), o) for o in options), default=(0, None))
    if best[0] >= 0.5:
        return best[1]
    for token in want:
        mapped = SYNONYMS.get(token)
        if mapped in options:
            return mapped
    return None
