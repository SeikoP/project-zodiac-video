"""Bounded initial visual authoring from approved narration and known assets."""
from __future__ import annotations

import copy
import hashlib
import json
import re

from tools.studio.artifacts import canonical_hash
from .models import StudioError
from .service import ASSETS, ROOT
from .story_visual_art import normalized_asset, visual_schema
from . import catalog_v5, prop_families

MAX_PROPOSAL = 96000


# Plugin Phase 2 rule (references/phase02-visual-rules.md): authoring-only, stripped before compilation. The pipeline's
# "Kiểm tra bản soạn" step runs scene-experience and reports EXPERIENCE_PROFILE_MISSING without it.
EXPERIENCE_PROFILE_RULE = (
    "REQUIRED on every scene, authoring-only (never projected into the render). Object {story_mode:'behavior'|'relationship'|"
    "'exposition'|'transition'|'reflection'|'payoff'|'symbolic', required_physical_entities:[ids of props the narrated action "
    "physically needs, else omit], sparse_reason:<only when deliberate negative space is the strategy>, "
    "story_focus:{goal:<exactly the scene semantic_goal>,focal_entity_id:<one VISIBLE character/object/story_visual carrying the "
    "beat>,supporting_entity_ids:[visible entity ids that support it],links:[{from:<focal/support id>,to:<focal/support id>,"
    "relation:<visible action or relationship>,purpose:<why it clarifies the goal>}]}}. story_focus is mandatory for behavior, "
    "relationship, symbolic and payoff scenes and for exposition scenes with several story entities; every supporting entity "
    "must be linked. Every id must be an entity in that scene. Behavior/relationship scenes need a visible actor/prop/story "
    "event, not a passive pose.")


def invalid(message):
    return StudioError("AGENT_PROPOSAL_INVALID", message, "agent")


def dependencies(service, project_id):
    return voice_dependencies(service.voice.snapshot(project_id))


def voice_dependencies(voice):
    return canonical_hash({"assembly": (voice.get("assembly") or {}).get("wav_sha256"),
                           "timing": voice.get("timing"),
                           "selection": [[u["id"], u.get("selected_take"), u.get("gap_after_ms")] for u in voice.get("units", [])]})


def catalog():
    components = json.loads((ASSETS / "characters/components/catalog.json").read_text("utf8"))
    props = json.loads((ASSETS / "props/index.json").read_text("utf8"))["assets"]
    layouts = json.loads((ASSETS / "shot-layouts/index.json").read_text("utf8"))
    mechanics = json.loads((ASSETS / "mechanics/index.json").read_text("utf8"))
    return {"components": {k: [r["id"] for r in components[k]] for k in
                           ("body_profiles", "hair", "outfits", "face_profiles", "poses", "expressions")},
            "props": [{k: r[k] for k in ("id", "path", "contexts") if k in r} for r in props],
            "frames": layouts.get("layouts", layouts.get("frames", [])),
            "mechanics": mechanics["mechanics"],
            "story_visual_templates": ["story_text", "chat_compare"]}


def prompt_catalog():
    """The catalog as the model sees it (catalog v5 compact form). Hash this, not catalog(), for staleness checks."""
    raw = catalog()
    return {**raw, "props": catalog_v5.compact_props(_library_props(), prop_families_manifest()),
            "components": catalog_v5.compact_components(raw["components"])}


def _library_props():
    return json.loads((ASSETS / "props/index.json").read_text("utf8"))["assets"]


_MANIFEST_CACHE: dict = {}


def prop_families_manifest():
    """Family/model/state manifest of the V4 library (cached until props/index.json changes)."""
    index = ASSETS / "props/index.json"
    key = (index.stat().st_mtime_ns, index.stat().st_size)
    if _MANIFEST_CACHE.get("key") != key:
        _MANIFEST_CACHE.update(key=key, value=prop_families.build_manifest(_library_props(), ASSETS))
    return _MANIFEST_CACHE["value"]


def record_asset_requests(workspace, bad):
    """Write what the library lacks to .authoring/asset-requests.json (spec: assets.request_variant). It asks for new
    master art to be authored and reviewed by a person; it generates nothing and approves nothing."""
    from pathlib import Path
    target = Path(workspace) / ".authoring/asset-requests.json"
    try:
        data = json.loads(target.read_text("utf8"))
    except (OSError, ValueError):
        data = {"format": "zodiac-asset-requests@1", "not_an_approval": True, "requests": []}
    rows = {r["wanted"]: r for r in data["requests"]}
    for key, path in bad.items():
        wanted = catalog_v5.prop_id(path)
        row = rows.setdefault(wanted, {"wanted": wanted, "status": "OPEN", "code": "NEW_VARIANT_MASTER_REQUIRED",
                                       "paths": [], "keys": [], "scene_ids": []})
        scene = key.split("-", 1)[0]
        for field, value in (("paths", path), ("keys", key), ("scene_ids", scene)):
            if value not in row[field]:
                row[field].append(value)
    data["requests"] = sorted(rows.values(), key=lambda r: r["wanted"])
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(data, ensure_ascii=False, indent=1), "utf-8")


def unknown_prop_message(bad):
    """Name every asset key (its scene prefix lets only that scene be redone), the path used and the real alternatives."""
    props = _library_props()
    parts = []
    for key, path in sorted(bad.items()):
        near = catalog_v5.nearest_props(props, path, k=3)
        offer = ("Gần nhất trong thư viện: " + ", ".join(n["id"] for n in near) if near
                 else "Thư viện không có prop nào gần giống; dùng prop khác trong catalog.props hoặc bỏ đồ này")
        parts.append(f"asset '{key}' dùng {path} nhưng thư viện không có prop đó. {offer}.")
    return " ".join(parts) + " Path hợp lệ có dạng library:props/<id>.svg với id lấy từ catalog.props."


def assert_prop_model_consistency(intent):
    """Reject an intent whose prop changes physical model between states, or whose owner drifts between models."""
    issues = prop_families.check_model_consistency(prop_families_manifest(), intent)
    if issues:
        raise invalid(" ".join(i["message"] for i in issues[:4]))


def visual_reuse(service, project_id, lookback=8):
    """Soft diversity hints from other exported episodes (spec §4). Best effort: {} when there is nothing to say."""
    try:
        episodes = []
        for row in service.list_projects(limit=lookback * 4):
            other = row.get("project_id")
            if other == project_id or (row.get("status") or {}).get("video") != "EXPORTED":
                continue
            intent = service.visual.snapshot(other).get("intent")
            if intent:
                episodes.append((other, intent))
            if len(episodes) >= lookback:
                break
        manifest = prop_families_manifest()
        profile = prop_families.reuse_profile(manifest, episodes, lookback)
        hints = prop_families.diversity_hints(manifest, profile)
        return {"episodes_considered": profile["episodes_considered"], "hints": hints} if hints else {}
    except Exception:  # a hint must never block authoring
        return {}


def capsule(service, project_id, instruction, *, repair=False):
    visual = service.visual
    state = visual.snapshot(project_id)
    if state["intent"] is not None and not repair:
        raise StudioError("AGENT_INITIAL_SOURCE_EXISTS", "Đã có hình ảnh; chọn cảnh để chỉnh sửa.", "agent")
    voice = service.voice.snapshot(project_id)
    timing = voice.get("timing")
    if (not timing or timing.get("source") != "measured_asr" or not timing.get("words") or
            not voice.get("assembly") or timing.get("wav_sha256") != voice["assembly"].get("wav_sha256")):
        raise StudioError("VISUAL_MEASURED_TIMING_REQUIRED", "Tạo giọng, ghép và căn thời gian trước khi soạn hình ảnh.", "agent")
    handle = visual._handle(project_id)
    narration = visual._narration(handle)
    plan_path = handle.workspace / ".authoring/narrative-plan.json"
    plan = json.loads(plan_path.read_text("utf8")) if plan_path.is_file() and not plan_path.is_symlink() else {}
    scope_path = handle.workspace / ".authoring/episode-scope.json"
    scope = json.loads(scope_path.read_text("utf8")) if scope_path.is_file() and not scope_path.is_symlink() else {}
    sign = scope.get("sign", "")
    suggested_topic = f"Cách {sign} yêu thật lòng" if scope.get("concept_code") == "love-sincere" and sign else None
    # Supply exact UTF-8 partitions so the model never guesses Vietnamese byte offsets.
    starts = [0]
    for beat in plan.get("beats", []):
        anchor = beat.get("voice_anchor", "")
        at = narration.find(anchor, starts[-1]) if anchor else -1
        if at > starts[-1]: starts.append(at)
    ranges = [{"id": f"s{i+1:02}", "narration_range": [len(narration[:at].encode()), len(narration[:stop].encode())],
               "text": narration[at:stop]} for i, (at, stop) in enumerate(zip(starts, starts[1:] + [len(narration)]))]
    result = _capsule_body(service, project_id, instruction, state, voice, timing, handle, narration, plan, scope, ranges, suggested_topic)
    if repair and state["intent"] is not None:
        # Same contract as a retry: the model repairs this candidate and keeps what already validates.
        result["previous_candidate"] = {"task_id": None, "validator_error": instruction, "json": json.dumps(
            {"kind": "source.replace", "payload": {"intent": state["intent"]}}, ensure_ascii=False)}
    return result


def _capsule_body(service, project_id, instruction, state, voice, timing, handle, narration, plan, scope, ranges, suggested_topic):
    return {"revision": state["revision"], "source_hash": state["source_hash"],
            "visual_contract": json.loads((ROOT / "tools/studio_project/visual_contract.json").read_text("utf8")),
            "dependencies": dependencies(service, project_id), "catalog": prompt_catalog(), "instruction": instruction,
            "narration_sha256": hashlib.sha256(narration.encode()).hexdigest(), "scene_ranges": ranges,
            "narrative_plan": plan, "episode_scope": {k: scope[k] for k in ("concept_code", "sign", "title_working") if k in scope},
            "required_story_visual_ids": [row["id"] for row in plan.get("story_visuals", []) if isinstance(row, dict) and row.get("id")]
            if plan.get("story_visual_decision", {}).get("mode") == "required" else [],
            "visual_reuse": visual_reuse(service, project_id) or None,
            "suggested_opening_topic": suggested_topic, "duration_seconds": timing.get("duration_seconds"),
            "schema": {
                "experience_profile": EXPERIENCE_PROFILE_RULE,
                "grammar": {"type": "object", "example": {"frame_id": "single-character-focus", "mechanic_id": "explain", "bindings": {"subject": "actual_actor_entity_id"}},
                            "description": "Scene grammar MUST be this structured object, NEVER a prose description. Choose exact frame_id/mechanic_id from catalog, bind required frame slots to actual scene entity IDs and respect slot kinds/mechanic requirements. Put prose directing in semantic_goal or narrative_intent.reason."},
                "format": "zodiac-visual-intent@1", "video": {"width": 1080, "height": 1920, "fps": 30},
                "cast": "Array of {entity_id,body_profile,hair_id,face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'coral' or 'teal',accessory_id:'none',variant_seed,asset_budget:{max_unique_states:8},states:{neutral:{pose_id:'neutral',expression_id:'deadpan'},reaction:{pose_id:catalog id,expression_id:catalog id}},design_intent:{selection_basis:'story_first',role:'lead' or 'support',identity_tension,audience_read,decision_reasons:{body_profile,hair_id,shirt_color_id},rejected_alternative:{choice,reason},reuse_strategy:'native_assembly_after_story',scene_anchor:{scene_id,excerpt,meaning},state_purposes:{neutral:reason,reaction:reason}}}",
                "character_constraints": "When outfit_id is zodiac-glyph-shirt, zodiac_sign_id MUST be the matching English zodiac id (e.g. sagittarius); otherwise choose plain-shirt. Every cast state, including additional states, MUST have a design_intent.state_purposes entry with at least 18 characters. All choice reasons must have at least 18 characters. Entity visual_role MUST be character for actors, interactive_prop for ordinary objects, story_visual for Story Visual. Grammar slot names speaker/listener/subject/focus_prop are NOT visual roles.",
                "episode_cast_plan": "{format:'zodiac-episode-cast-plan@1',bindings:[{member_id:English zodiac id,entity_id,scene_ids:[ids],role:'member',reason}]}",
                "assets": "Map id -> {path:'library:'+catalog prop path (catalog.props.path_rule: props/<id>.svg unless listed in path_exceptions),category:'prop'} for ordinary props. A prop entity keeps ONE physical model (catalog family model) across its states; give a different-looking prop its own entity. An entity may carry owner_id (the actor who owns it): one owner keeps one model per family. " + visual_schema() + " Never emit raw SVG, HTML, scripts or URLs.",
                "opening": "{format:'zodiac-series-opening@1',series:'12 CUNG HOÀNG ĐẠO',sign:episode_scope.sign,topic:suggested_opening_topic or a short theme-specific topic beginning 'Cách' or 'Khi',duration_frames:45,transition_frames:9}. Intro explains series/theme, never copies narration hook. Narration and captions start at frame zero.",
                "scenes": "Use exact supplied ids/ranges. Each {id,narration_range,semantic_goal,grammar,entities:[{id,kind:'character'|'object'|'story_visual',visual_role:canonical equivalent,initial_state,states:{state_id:{asset,visible,layer,transform:{x,y,width,height}}},narrative_intent:{voice_anchor:exact excerpt,reason}, optional lettering:{purpose,reason,states,styles}}],events:[{id,target,state_before,state_after,action:<short Vietnamese phrase for what the target character/prop DOES; REQUIRED, scenes without an authored action fail character_action>,trigger:{type:'voice_anchor',text:exact substring inside scene},motion:{preset:'state_swap',duration_frames:12}}],layout_contract:{caption_safe_zone:{x:80,y:1470,width:920,height:360}},SCENE DRESSING (scene_set_id is retired for fresh scenes; never use it): every relationship/behavior/payoff scene needs at least one visible set-dressing entity whose id starts with 'depth__' (an ordinary prop from catalog.props placed behind or in front of the actors, layer different from them; the library has NO table, desk or chair, so use a real prop such as laptop, notebook, coffee-cup or phone and never an invented id), and the story entities together must cover about 26% of the 1080x1400 story field (large characters, e.g. 390x780 each), otherwise validation reports ENVIRONMENT_VISUAL_UNDERDEVELOPED / FRAME_OCCUPANCY_LOW,experience_profile:<see schema.experience_profile; REQUIRED on every scene>}. Story Text is optional lettering within ONE story_visual per scene. A split chat can be chosen ONLY when Phase 1 directs contrasting messages and must show named senders, short conversation bubbles and actor reaction; never default to a full-width floating board. Use exact voice anchors, reveal only on the relevant beat, keep actor contact and caption lane clear. Preserve native V4 characters and meaningful real props. Never invent decorative text graphics.",
            }}


KNOWN_SIGNS = ("Bạch Dương", "Kim Ngưu", "Song Tử", "Cự Giải", "Sư Tử", "Xử Nữ",
               "Thiên Bình", "Bọ Cạp", "Nhân Mã", "Ma Kết", "Bảo Bình", "Song Ngư")


def repair_cast(cast, options):
    """Make every cast pose/expression a real catalog id, in place. Returns what was changed (reported, never silent).

    The usual slip is an expression written as a pose (or the reverse): it moves to the right field. Anything else
    becomes the nearest real id, else neutral. A wrong cast value used to be found only after every scene had been
    authored, costing the whole run.
    """
    changes = []
    for member in cast or []:
        for state_id, state in ((member or {}).get("states") or {}).items():
            if not isinstance(state, dict):
                continue
            for field, mine, other_field, other in (("pose_id", "poses", "expression_id", "expressions"),
                                                    ("expression_id", "expressions", "pose_id", "poses")):
                value = state.get(field)
                if not isinstance(value, str) or value in options[mine]:
                    continue
                where = f"{member.get('entity_id')}/{state_id}.{field}"
                near = catalog_v5.nearest_component(value, options[mine])
                if near:
                    state[field] = near
                    changes.append(f"{where}: {value} -> {near}")
                    continue
                state[field] = "neutral"
                if value in options[other] and state.get(other_field) not in options[other] or (
                        value in options[other] and state.get(other_field) == "neutral"):
                    state[other_field] = value
                    changes.append(f"{where}: {value} is a {other_field.split('_')[0]}, moved to {other_field}")
                else:
                    changes.append(f"{where}: {value} unknown -> neutral")
    return changes


def _repair_opening(intent, context):
    scope = context.get("episode_scope") or {}
    sign = scope.get("sign")
    if sign not in KNOWN_SIGNS:
        return []
    changed = []
    topic = context.get("suggested_opening_topic") or (f"Cách {sign} yêu thật lòng" if scope.get("concept_code") == "love-sincere" else None)
    opening = intent.get("opening")
    if not opening and topic:
        intent["opening"] = {"format": "zodiac-series-opening@1", "series": "12 CUNG HOÀNG ĐẠO", "sign": sign, "topic": topic,
                             "duration_frames": 45, "transition_frames": 9}
        return ["opening_built"]
    if isinstance(opening, dict):
        if opening.get("sign") != sign:
            opening["sign"] = sign
            changed.append("opening_sign")
        if scope.get("concept_code") == "love-sincere" and opening.get("topic") not in (f"Cách {sign} yêu thật lòng", f"Khi {sign} thật lòng yêu") and topic:
            opening["topic"] = topic
            changed.append("opening_topic")
    return changed


def bind_proposal(text, context):
    changed = []
    try:
        data = json.loads(text)
    except json.JSONDecodeError as error:
        if error.pos != len(text) or error.msg != "Expecting ',' delimiter":
            raise
        data = json.loads(text + "}")
        changed.append("outer_json_brace")
    if not isinstance(data, dict) or set(data) != {"kind", "payload"} or data["kind"] != "source.replace":
        raise ValueError("Unsupported authoring envelope")
    intent = data["payload"]["intent"]
    # The source owner supplies immutable metadata; the model supplies scene decisions.
    if intent.get("narration_sha256") != context["narration_sha256"]:
        intent["narration_sha256"] = context["narration_sha256"]
        changed.append("narration_sha256")
    if "video" not in intent:
        intent["video"] = copy.deepcopy(context["schema"]["video"])
        changed.append("video")
    # Phase 1 owns the story-visual decision; the model only copied it, and a slip failed the whole compile.
    decision = (context.get("narrative_plan") or {}).get("story_visual_decision")
    if isinstance(decision, dict) and intent.get("story_visual_decision") != decision:
        intent["story_visual_decision"] = copy.deepcopy(decision)
        changed.append("story_visual_decision")
    if intent.get("taxonomy_version") != "story_visual@1":
        intent["taxonomy_version"] = "story_visual@1"
        changed.append("taxonomy_version")
    changed += _substitute_missing_parts(intent)
    changed += ["cast:" + c for c in repair_cast(intent.get("cast"), catalog()["components"])]
    changed += _repair_opening(intent, context)
    ranges = {row["id"]: row["narration_range"] for row in context["scene_ranges"]}
    for scene in intent.get("scenes", []):
        if scene.get("id") in ranges and scene.get("narration_range") != ranges[scene["id"]]:
            scene["narration_range"] = list(ranges[scene["id"]])
            changed.append("narration_range:" + scene["id"])
        for entity in scene.get("entities", []):
            if entity.get("kind") == "prop":
                entity["kind"] = "object"
                changed.append("prop_kind:" + entity.get("id", ""))
    return (json.dumps(data, ensure_ascii=False) if changed else text), changed


def _substitute_missing_parts(intent):
    """A prop, pose or expression the library does not have becomes the nearest real one (catalog v5), in code.

    Without this the whole proposal is rejected and the model spends another attempt on a one-word mistake. Nothing is
    substituted when no library entry is close enough: that still fails and names the valid choices.
    """
    changed = []
    props = _library_props()
    allowed = {"library:" + a["path"] for a in props}
    for key, asset in (intent.get("assets") or {}).items():
        if (isinstance(asset, dict) and asset.get("category") == "prop" and str(asset.get("path", "")).startswith("library:")
                and asset["path"] not in allowed):
            near = catalog_v5.nearest_props(props, asset["path"], k=1)
            if near:
                changed.append(f"asset_substituted:{key}:{asset['path']}->library:{near[0]['path']}")
                asset["path"] = "library:" + near[0]["path"]
                continue
            users = [e.get("id", "") for s in intent.get("scenes") or [] for e in s.get("entities") or []
                     if any((st or {}).get("asset") == key for st in (e.get("states") or {}).values())]
            alias = catalog_v5.dressing_alias(asset["path"])
            if users and all(str(u).startswith("depth__") for u in users) and alias in {p["id"] for p in props}:
                changed.append(f"dressing_substituted:{key}:{asset['path']}->library:props/{alias}.svg")
                asset["path"] = f"library:props/{alias}.svg"
    options = catalog()["components"]
    for member in intent.get("cast") or []:
        for state_id, state in ((member or {}).get("states") or {}).items():
            for field, key in (("pose_id", "poses"), ("expression_id", "expressions")):
                value = (state or {}).get(field)
                if isinstance(value, str) and value not in options[key]:
                    near = catalog_v5.nearest_component(value, options[key])
                    if near:
                        changed.append(f"{field}_substituted:{member.get('entity_id')}/{state_id}:{value}->{near}")
                        state[field] = near
    return changed


def _stored_story_visual(asset, workspace):
    """A Story Visual asset exactly as normalized_asset() wrote it: same path pattern and file bytes matching its hash."""
    path, sha = str(asset.get("path", "")), asset.get("source_sha256")
    if not re.fullmatch(r"\.authoring/agent-art/story-[0-9a-f]{64}\.svg", path) or not isinstance(sha, str) or sha not in path:
        return False
    try:
        return hashlib.sha256((workspace / path).read_bytes()).hexdigest() == sha
    except OSError:
        return False

def proposal(text, service, project_id, *, write_visuals=False):
    if not isinstance(text, str) or len(text) > MAX_PROPOSAL: raise invalid("Đề xuất quá lớn.")
    try:
        proposed = json.loads(text)
        if (not isinstance(proposed, dict) or set(proposed) != {"kind", "payload"} or proposed["kind"] != "source.replace" or
                not isinstance(proposed["payload"], dict) or set(proposed["payload"]) != {"intent"}):
            raise invalid("Chỉ hỗ trợ đề xuất nguồn hình ảnh ban đầu.")
        intent = copy.deepcopy(proposed["payload"]["intent"])
        if not isinstance(intent, dict) or not isinstance(intent.get("assets"), dict) or len(intent["assets"]) > 100:
            raise invalid("Danh mục hình ảnh không hợp lệ.")
        known = catalog()
        allowed = {"library:" + a["path"] for a in known["props"]}
        for member in intent.get("cast") or []:  # name the valid choices here instead of failing late in the compiler
            for state_id, state in ((member or {}).get("states") or {}).items():
                for field, options in (("expression_id", "expressions"), ("pose_id", "poses")):
                    value = (state or {}).get(field)
                    if value is not None and value not in known["components"][options]:
                        raise invalid(f"Cast {member.get('entity_id')}/{state_id}: {field} {value!r} không có trong catalog. "
                                      f"Chọn một trong: {', '.join(known['components'][options])}.")
        handle = service.visual._handle(project_id)
        plan_path = handle.workspace / ".authoring/narrative-plan.json"
        plan = json.loads(plan_path.read_text("utf8")) if plan_path.is_file() else {}
        directions = {item["id"]: item for item in plan.get("story_visuals", []) if isinstance(item, dict) and item.get("id")}
        scope_path = handle.workspace / ".authoring/episode-scope.json"
        if scope_path.is_file():
            scope = json.loads(scope_path.read_text("utf8"))
            opening = intent.get("opening") or {}
            known_signs = {"Bạch Dương", "Kim Ngưu", "Song Tử", "Cự Giải", "Sư Tử", "Xử Nữ",
                           "Thiên Bình", "Bọ Cạp", "Nhân Mã", "Ma Kết", "Bảo Bình", "Song Ngư"}
            if scope.get("sign") in known_signs and not opening:
                raise invalid("Mỗi tập mới cần cover giới thiệu series, cung và chủ đề.")
            if opening and opening.get("sign") != scope.get("sign"):
                raise invalid("Cover phải ghi đúng tên cung trong Phase 1 đã duyệt.")
            if scope.get("concept_code") == "love-sincere" and opening.get("topic") not in (
                f"Cách {scope['sign']} yêu thật lòng", f"Khi {scope['sign']} thật lòng yêu"):
                raise invalid("Cover phải giới thiệu concept thật lòng yêu, không lấy hook làm tên tập.")
        generated = set()
        pending_art = []
        unknown_props = {}
        for key, asset in intent["assets"].items():
            if not isinstance(asset, dict):
                raise invalid("Asset không hợp lệ.")
            if set(asset) == {"visual", "category", "phase1_visual_id"} and asset.get("category") == "story_visual":
                visual_id = asset["phase1_visual_id"]
                if visual_id not in directions or plan.get("story_visual_decision", {}).get("mode") != "required":
                    raise invalid("Story Visual thiếu chỉ dẫn Phase 1 đã duyệt.")
                try:
                    intent["assets"][key] = normalized_asset(asset["visual"], directory=handle.workspace,
                                                             phase1_id=visual_id, write=False)
                    pending_art.append((asset["visual"], visual_id))
                except (ValueError, OSError) as error:
                    raise invalid(str(error)) from error
                generated.add(key)
            elif asset.get("category") == "story_visual" and _stored_story_visual(asset, handle.workspace):
                generated.add(key)  # already written by an earlier apply (a scene revision starts from the applied intent); the same placement rules apply
            elif set(asset) - {"path", "category", "source_sha256"} or asset.get("category") != "prop":
                raise invalid("Chỉ được chọn đạo cụ trong catalog hoặc Story Visual dạng template đã duyệt.")
            elif asset.get("path") not in allowed:
                unknown_props[key] = str(asset.get("path"))
        if unknown_props:
            try:
                record_asset_requests(handle.workspace, unknown_props)
            except OSError:
                pass  # recording the request must never hide the real error from the model
            raise invalid(unknown_prop_message(unknown_props))
        if generated:
            used_directions = set()
            for scene in intent.get("scenes", []):
                focused = [entity for entity in scene.get("entities", []) if any(
                    state.get("asset") in generated for state in entity.get("states", {}).values())]
                if len(focused) > 1:
                    raise invalid("Mỗi cảnh tối đa một Story Visual có chữ.")
                for entity in focused:
                    if entity.get("kind") != "story_visual" or entity.get("visual_role") != "story_visual":
                        raise invalid("Story Text phải thuộc Story Visual, không phải overlay riêng.")
                    if entity.get("states", {}).get(entity.get("initial_state"), {}).get("visible") is not False:
                        raise invalid("Chữ phải ẩn đến đúng voice anchor được chỉ định.")
                    anchors = [event for event in scene.get("events", []) if event.get("target") == entity["id"]
                               and event.get("trigger", {}).get("type") == "voice_anchor"]
                    if not anchors:
                        raise invalid("Story Visual phải xuất hiện đúng điểm nhấn giọng đọc.")
                    id_used = next(intent["assets"][state["asset"]]["creative_origin"]["phase1_visual_id"]
                                   for state in entity["states"].values() if state.get("asset") in generated)
                    direction = directions[id_used]
                    used_directions.add(id_used)
                    first = anchors[0]
                    raw = service.visual._narration(handle).encode("utf8")
                    voice = raw[slice(*scene["narration_range"])].decode("utf8")
                    art = scene.setdefault("art_direction", {})
                    art.setdefault("narrative_brief", {
                        "format": "zodiac-narrative-brief@2", "phase1_visual_id": id_used,
                        "story_point": direction.get("story_point", scene["semantic_goal"]),
                        "viewer_read": direction.get("viewer_read", scene["semantic_goal"]),
                        "anchor_phrase": first["trigger"]["text"],
                        "state_changes": [{"from": first["state_before"], "to": first["state_after"],
                                           "anchor_phrase": first["trigger"]["text"], "event_id": first["id"]}]})
                    art.setdefault("visual_coverage", {
                        "format": "zodiac-visual-coverage@1", "layers_version": "story_visual@1",
                        "narration_sha256": hashlib.sha256(voice.encode("utf8")).hexdigest(),
                        "beats": [{"id": "story-" + entity["id"], "goal": scene["semantic_goal"],
                                   "narration_range": [0, len(voice.encode("utf8"))],
                                   "event_ids": [event["id"] for event in anchors],
                                   "layers": {"story_visual": {"decision": "use",
                                     "reason": direction.get("contribution", scene["semantic_goal"]),
                                     "entity_ids": [entity["id"]]}}}]})
        if plan.get("story_visual_decision", {}).get("mode") == "required":
            missing = sorted(set(directions) - (used_directions if generated else set()))
            if not generated or missing:
                raise invalid("Story Visual bắt buộc của Phase 1 chưa được thực hiện trong cảnh. "
                              f"Thiếu: {', '.join(missing)}. Mỗi phase1_visual_id cần asset category story_visual, "
                              "entity tham chiếu asset trong states và voice_anchor event reveal trong cảnh.")
        assert_prop_model_consistency(intent)
        service.visual._node(handle, {"action": "validate_authoring", "intent": intent, "narration": service.visual._narration(handle)})
        # Stage deterministic SVG files only after all semantic/source validation passes.
        # This prevents invalid proposals from leaving unreferenced art in the project.
        if write_visuals:
            for spec, visual_id in pending_art:
                normalized_asset(spec, directory=handle.workspace, phase1_id=visual_id, write=True)
        return intent
    except (ValueError, TypeError, KeyError) as error:
        raise invalid("JSON đề xuất không hợp lệ hoặc bị cắt.") from error
