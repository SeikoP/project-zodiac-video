"""Bounded initial-authoring capsule and native text boards, never arbitrary model files."""
from __future__ import annotations

import copy
import hashlib
import json
import re

from tools.studio.artifacts import canonical_hash
from .models import StudioError
from .service import ASSETS, ROOT

MAX_PROPOSAL = 96000


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
    return {"components": {k: [r["id"] for r in components[k]] for k in
                           ("body_profiles", "hair", "outfits", "face_profiles", "poses", "expressions")},
            "props": [{k: r[k] for k in ("id", "path", "contexts") if k in r} for r in props]}


def capsule(service, project_id, instruction):
    visual = service.visual
    state = visual.snapshot(project_id)
    if state["intent"] is not None:
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
    # Supply exact UTF-8 partitions so the model never guesses Vietnamese byte offsets.
    starts = [0]
    for beat in plan.get("beats", []):
        anchor = beat.get("voice_anchor", "")
        at = narration.find(anchor, starts[-1]) if anchor else -1
        if at > starts[-1]: starts.append(at)
    ranges = [{"id": f"s{i+1:02}", "narration_range": [len(narration[:at].encode()), len(narration[:stop].encode())],
               "text": narration[at:stop]} for i, (at, stop) in enumerate(zip(starts, starts[1:] + [len(narration)]))]
    from fontTools.ttLib import TTFont
    with TTFont(ROOT / "runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf") as font:
        board_characters = "".join(chr(c) for c in sorted(font.getBestCmap()) if c >= 32) + "→"
    return {"revision": state["revision"], "source_hash": state["source_hash"], "board_characters": board_characters,
            "dependencies": dependencies(service, project_id), "catalog": catalog(), "instruction": instruction,
            "narration_sha256": hashlib.sha256(narration.encode()).hexdigest(), "scene_ranges": ranges,
            "narrative_plan": plan, "duration_seconds": timing.get("duration_seconds"),
            "schema": {
                "format": "zodiac-visual-intent@1", "video": {"width": 1080, "height": 1920, "fps": 30},
                "cast": "Array of {entity_id,body_profile,hair_id,face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'coral' or 'teal',accessory_id:'none',variant_seed,asset_budget:{max_unique_states:8},states:{neutral:{pose_id:'neutral',expression_id:'deadpan'},reaction:{pose_id:catalog id,expression_id:catalog id}},design_intent:{selection_basis:'story_first',role:'lead' or 'support',identity_tension,audience_read,decision_reasons:{body_profile,hair_id,shirt_color_id},rejected_alternative:{choice,reason},reuse_strategy:'native_assembly_after_story',scene_anchor:{scene_id,excerpt,meaning},state_purposes:{neutral:reason,reaction:reason}}}",
                "episode_cast_plan": "{format:'zodiac-episode-cast-plan@1',bindings:[{member_id:English zodiac id,entity_id,scene_ids:[ids],role:'member',reason}]}",
                "assets": "Map id -> {path:'library:'+exact catalog path,category:'prop'} OR {board:{title:short Vietnamese title,lines:[up to 4 short Vietnamese lines]},category:'story_visual'}. Board text is native-rendered, do not supply SVG, HTML, paths or scripts.",
                "scenes": "Use exact supplied ids/ranges. Each {id,narration_range,semantic_goal,grammar:{frame_id:'single-character-focus',mechanic_id:'explain',bindings:{subject:lead id}},entities:[{id,kind:'character' or 'story_visual',visual_role:same as kind,initial_state,states:{state_id:{asset:asset id (characters use 'compiled-'+entity id),visible:true,layer:20,transform:{x,y,width,height}}},narrative_intent:{voice_anchor:exact excerpt,reason}}],events:[{id,target,state_before,state_after,trigger:{type:'voice_anchor',text:exact substring inside scene},motion:{preset:'state_swap',duration_frames:12}}],layout_contract:{caption_safe_zone:{x:80,y:740,width:920,height:200}}}",
            }}


def board_svg(board):
    from fontTools.ttLib import TTFont
    from fontTools.pens.svgPathPen import SVGPathPen
    if not isinstance(board, dict) or set(board) != {"title", "lines"}:
        raise invalid("Board cần title và lines.")
    title, lines = board["title"], board["lines"]
    if (not isinstance(title, str) or not 1 <= len(title) <= 48 or not isinstance(lines, list) or
            not 0 <= len(lines) <= 4 or any(not isinstance(s, str) or not 1 <= len(s) <= 60 for s in lines)):
        raise invalid("Board tối đa 4 dòng ngắn, mỗi dòng 60 ký tự.")
    with TTFont(ROOT / "runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf") as font:
        glyphs, cmap, em = font.getGlyphSet(), font.getBestCmap(), font["head"].unitsPerEm
        advance = lambda c: em * .8 if c == "→" else glyphs[cmap[ord(c)]].width
        out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 920 520"><rect x="6" y="6" width="908" height="508" rx="28" fill="#fff9ed" stroke="#27231f" stroke-width="6"/>']
        for i, text in enumerate([title] + lines):
            if any(ord(c) not in cmap and c != "→" for c in text): raise invalid("Ký tự board không có trong font.")
            width = sum(advance(c) for c in text)
            size = min(52 if i == 0 else 44, 830 * em / max(1, width))
            if size < 28: raise invalid("Dòng board quá dài để đọc trên điện thoại.")
            x = 40
            for char in text:
                if char == "→":
                    out.append(f'<path d="M 0 0 H 32 M 20 -12 L 32 0 L 20 12" transform="translate({x:.2f} {66+i*94}) scale({size/52:.6f})" fill="none" stroke="#27231f" stroke-width="3"/>')
                    x += advance(char) * size / em
                    continue
                glyph = glyphs[cmap[ord(char)]]; pen = SVGPathPen(glyphs); glyph.draw(pen)
                out.append(f'<path d="{pen.getCommands()}" transform="translate({x:.2f} {78+i*94}) scale({size/em:.6f} {-size/em:.6f})" fill="#27231f"/>')
                x += glyph.width * size / em
        return ("".join(out) + "</svg>").encode()


def proposal(text, service, project_id, *, write_boards=False):
    if not isinstance(text, str) or len(text) > MAX_PROPOSAL: raise invalid("Đề xuất quá lớn.")
    try:
        proposed = json.loads(text)
        if (not isinstance(proposed, dict) or set(proposed) != {"kind", "payload"} or proposed["kind"] != "source.replace" or
                not isinstance(proposed["payload"], dict) or set(proposed["payload"]) != {"intent"}):
            raise invalid("Chỉ hỗ trợ đề xuất nguồn hình ảnh ban đầu.")
        intent = copy.deepcopy(proposed["payload"]["intent"])
        if not isinstance(intent, dict) or not isinstance(intent.get("assets"), dict) or len(intent["assets"]) > 100:
            raise invalid("Danh mục hình ảnh không hợp lệ.")
        allowed = {"library:" + a["path"] for a in catalog()["props"]}
        boards = []
        for key, asset in intent["assets"].items():
            if not isinstance(asset, dict): raise invalid("Asset không hợp lệ.")
            if "board" in asset:
                if set(asset) != {"board", "category"} or asset["category"] != "story_visual": raise invalid("Board chỉ dùng cho story_visual.")
                svg = board_svg(asset["board"]); sha = hashlib.sha256(svg).hexdigest()
                boards.append((sha, svg))
                intent["assets"][key] = {"path": f".authoring/agent-art/{sha}.svg", "category": "story_visual", "source_sha256": sha}
            elif set(asset) - {"path", "category", "source_sha256"} or asset.get("path") not in allowed or asset.get("category") != "prop":
                raise invalid("Agent chỉ được chọn asset trong danh mục hoặc board có cấu trúc.")
        handle = service.visual._handle(project_id)
        service.visual._node(handle, {"action": "validate", "intent": intent, "narration": service.visual._narration(handle)})
        if write_boards and boards:
            from .importer import _trusted_dir
            folder = _trusted_dir(handle.workspace, handle.workspace / ".authoring/agent-art")
            for sha, svg in boards:
                target = folder / (sha + ".svg")
                if target.is_symlink(): raise invalid("Đường dẫn board không an toàn.")
                if target.exists():
                    if target.read_bytes() != svg: raise invalid("Hash board không khớp.")
                else:
                    with target.open("xb") as stream: stream.write(svg)
        return intent
    except (ValueError, TypeError, KeyError) as error:
        raise invalid("JSON đề xuất không hợp lệ hoặc bị cắt.") from error
