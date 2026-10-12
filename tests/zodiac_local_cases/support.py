import hashlib
import os
import json
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave
import zipfile
from pathlib import Path

from tools.zodiac_local import (
    AlignmentMismatchError,
    PipelineError,
    _align_scene_words,
    _alignment_coverage_gap,
    _alignment_units,
    _renderer_tree_sha256,
    _run_ffmpeg,
    _select_vieneu_gradio_dependency,
    align_scene_timings,
    build_audio_preview,
    build_parser,
    build_and_write_timing,
    build_timing_from_word_alignment,
    build_tts_diagnostics,
    canonical_narration_text,
    effective_tts_generation_config,
    generate_scene_voices,
    recover_scene_alignment_with_adaptive_frame_cap,
    tts_scene_frame_cap_retry_eligible,
    concatenate_scene_voices,
    concatenate_wavs,
    configure_background_music,
    import_package,
    mix_background_music_into_render,
    observe_subprocess_output,
    run_managed_subprocess,
    finalize_publish_outputs,
    resolve_renderer_root,
    renderer_check_fingerprint,
    style_compile_fingerprint,
    safe_extract_zip,
    validate_background_music,
    validate_package,
    validate_publish_contract,
    validate_publish_outputs,
    validate_timing,
)


EXPECTED_DEPENDENCIES = {
    "@remotion/captions": "4.0.530",
    "@remotion/cli": "4.0.530",
    "@remotion/media": "4.0.530",
    "remotion": "4.0.530",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "@remotion/layout-utils": "4.0.530",
    "@fontsource/be-vietnam-pro": "5.3.0",
    "ajv": "8.20.0",
}
EXPECTED_SCRIPTS = {
    "prepare:runtime": "node scripts/render.mjs --prepare-only",
    "studio": "npm run prepare:runtime && remotion studio src/index.ts --props=../.runtime/render-props.json",
    "render": "node scripts/render.mjs",
    "test": "node --test tests/*.test.mjs",
    "typecheck": "tsc --noEmit",
    "compile:style": "node scripts/compile-style-token.mjs",
}


def style_token():
    return {
        "id": "zodiac-paper-stickers-v1",
        "version": "1.0",
        "palette_roles": {
            "paper": "#F4EFE6",
            "ink": "#252A2E",
            "sticker_edge": "#FFFDF8",
            "coral": "#E36C54",
        },
        "character_construction": {
            "head_to_body_ratio": [1.1, 1.35],
            "outline_px_at_1080": [5, 7],
        },
        "shape_language": {
            "medium": "cut-paper-notebook-stickers",
        },
        "caption_emphasis": {
            "font_family": "Be Vietnam Pro",
            "font_weight": 500,
            "font_size_px": 46,
            "min_font_size_px": 34,
            "max_lines": 2,
            "color_role": "ink",
            "highlight_role": "coral",
            "background_role": "sticker_edge",
        },
        "safe_zone": {
            "x": 90,
            "y": 1430,
            "width": 900,
            "height": 150,
        },
        "motion_grammar": {
            "state_swap": "voice-anchored-character-pose-change",
        },
        "layout_zones": {
            "content": {
                "x": 48,
                "y": 70,
                "width": 984,
                "height": 1260,
                "radius": 28,
                "border_px": 3,
            },
            "caption": {
                "x": 90,
                "y": 1430,
                "width": 900,
                "height": 150,
            },
            "gap_px": 100,
        },
    }


RUNTIME_V3_HASH = "88f845a0e9304383ed6627127206185d301ba1516b1e16e591cbe1ba47c3d1f8"
RUNTIME_V315_HASH = "4d52e6ca766649546482a5cdfbf879f4f19c4d3c41c07c7743cccec1a7100ffa"
RUNTIME_V316_HASH = "728a98743563c19b8c6fead718fc817782965b5c3bd30fefe257135c38f6f754"


def v3_style_token():
    return {
        "id": "zodiac-paper-doodle-meme-v3",
        "version": "3.1",
        "style_family": "paper-doodle-chibi-meme",
        "hard_style_lock": True,
        "palette_roles": {
            "paper": "#F6F0E6",
            "card": "#FFFDF9",
            "ink": "#2F3C44",
            "soft_ink": "#5C6B75",
            "hair_ink": "#4B5B61",
            "skin": "#F1C6A0",
            "sticker_edge": "#FFFDF9",
            "soft_shadow": "#D0C1B3",
            "teal": "#8EC0B9",
            "coral": "#E97A66",
            "ochre": "#F2C45C",
            "slate": "#435064",
        },
        "character_construction": {
            "head_to_body_ratio": [1.15, 1.4],
            "outline_px_at_1080": [5, 8],
            "hair_silhouette_catalog": ["a", "b", "c", "d", "e"],
        },
        "shape_language": {"medium": "handmade-paper-doodle-stickers"},
        "caption_emphasis": {
            "font_family": "Patrick Hand",
            "font_weight": 400,
            "font_size_px": 84,
            "min_font_size_px": 64,
            "max_lines": 2,
            "color_role": "ink",
            "highlight_role": "coral",
            "background_role": "sticker_edge",
            "ghost_frame": True,
        },
        "safe_zone": {"x": 72, "y": 960, "width": 936, "height": 620},
        "caption_overlay": {
            "mode": "collision_aware",
            "preferred_anchor": "lower_center",
        },
        "motion_grammar": {"state_swap": "voice-anchored-pose-change"},
        "asset_style_contract": {
            "required_visual_cues": ["warm-paper-background"],
            "forbidden": ["photoreal"],
        },
    }


def v4_style_token():
    return {
        "id": "zodiac-paper-doodle-meme-v4",
        "version": "4.0",
        "style_family": "paper-doodle-chibi-meme",
        "handmade_profile": "human-stroke-v2",
        "hard_style_lock": True,
        "palette_roles": {
            "paper": "#F6F0E6",
            "card": "#FFFDF9",
            "ink": "#2F3C44",
            "soft_ink": "#5C6B75",
            "hair_ink": "#4B5B61",
            "skin": "#F1C6A0",
            "sticker_edge": "#FFFDF9",
            "soft_shadow": "#D0C1B3",
            "teal": "#8EC0B9",
            "coral": "#E97A66",
            "ochre": "#F2C45C",
            "slate": "#435064",
        },
        "character_construction": {
            "handmade_profile": "human-stroke-v2",
            "identity_rule": "body_profile + hair_id + outfit_id; pose/expression are state only",
            "body_variation": "authored_geometry_not_scale_transform",
        },
        "shape_language": {
            "medium": "handmade-paper-doodle-stickers",
            "geometry_preference": "path-first",
            "density": "one-focal-interaction-one-supporting-prop",
        },
        "caption_emphasis": {
            "font_family": "Patrick Hand",
            "font_weight": 400,
            "font_size_px": 84,
            "min_font_size_px": 64,
            "max_lines": 2,
            "color_role": "ink",
            "highlight_role": "coral",
            "background_role": "sticker_edge",
            "ghost_frame": True,
            "segmentation": "semantic-sentence-or-natural-clause",
        },
        "safe_zone": {"x": 72, "y": 960, "width": 936, "height": 620},
        "caption_overlay": {
            "mode": "collision_aware",
            "preferred_anchor": "lower_center",
            "max_visual_overlap_ratio": 0.24,
            "edge_margin_px": 72,
            "paper_halo_px": 18,
        },
        "motion_grammar": {
            "state_swap": "voice-anchored-pose-or-expression-change",
            "camera_focus": "restrained-focus-shift",
            "freeze_then_release": "hold-reaction-then-resume",
        },
        "asset_style_contract": {
            "style_token": "zodiac-paper-doodle-meme-v4",
            "handmade_profile": "human-stroke-v2",
            "legacy_v3_direct_copy": False,
        },
    }


def token_hash(token):
    encoded = json.dumps(
        token,
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def design_markdown(token):
    fence = chr(96) * 3
    return (
        "# Zodiac test design\n\n"
        "<!-- STYLE_TOKEN_BEGIN -->\n"
        + fence
        + "json\n"
        + json.dumps(token, ensure_ascii=False, indent=2)
        + "\n"
        + fence
        + "\n<!-- STYLE_TOKEN_END -->\n"
    )


def package_files():
    token = style_token()
    compiled = {**token, "source_hash": token_hash(token)}
    transform = {
        "x": 100,
        "y": 100,
        "width": 300,
        "height": 500,
    }
    production = {
        "version": "2.0",
        "video": {
            "width": 1080,
            "height": 1920,
            "fps": 30,
        },
        "visual_system": {
            "palette": token["palette_roles"],
            "background_primitive": "paper.bg",
            "primitive_renderer": {
                "allowed_tags": ["rect"],
            },
            "motion_presets": {
                "state_swap": {
                    "keyframes": [
                        {"frame": 0, "opacity": 0},
                        {"frame": 1, "opacity": 1},
                    ],
                    "easing": "linear",
                },
            },
            "transition_presets": {
                "hard_cut": {
                    "renderer": "instant_cut",
                },
            },
            "sfx_profiles": {},
            "style_token": compiled,
        },
        "caption_style": {
            "font_family": "Be Vietnam Pro",
            "font_size_px": 46,
            "min_font_size_px": 34,
            "font_weight": 500,
            "color": "#252A2E",
            "highlight_color": "#E36C54",
            "background": "transparent",
            "safe_area": token["safe_zone"],
            "max_lines": 2,
        },
        "primitives": {
            "paper.bg": {
                "kind": "svg_elements",
                "viewBox": "0 0 1 1",
                "elements": [],
            },
        },
        "assets": {
            "lead.neutral": {
                "kind": "svg",
                "category": "character_pose",
                "character_id": "lead",
                "pose": "neutral",
                "path": "assets/characters/lead-neutral.svg",
                "format": "image/svg+xml",
                "style_id": token["id"],
            },
            "lead.active": {
                "kind": "svg",
                "category": "character_pose",
                "character_id": "lead",
                "pose": "active",
                "path": "assets/characters/lead-active.svg",
                "format": "image/svg+xml",
                "style_id": token["id"],
            },
        },
        "scenes": [
            {
                "id": "S01",
                "voice": "Xin chào mọi người.",
                "timing": {"mode": "from_voice"},
                "entities": [
                    {
                        "id": "character.lead",
                        "kind": "character",
                        "initial_state": "neutral",
                        "states": {
                            "neutral": {
                                "asset": "lead.neutral",
                                "transform": transform,
                                "layer": 2,
                                "visible": True,
                            },
                            "active": {
                                "asset": "lead.active",
                                "transform": transform,
                                "layer": 2,
                                "visible": True,
                            },
                        },
                    },
                ],
                "events": [
                    {
                        "id": "S01-E01",
                        "target": "character.lead",
                        "action": "reacts",
                        "state_before": "neutral",
                        "state_after": "active",
                        "trigger": {"source": "scene_start"},
                        "motion": {
                            "preset": "state_swap",
                            "duration_frames": 6,
                        },
                    },
                ],
                "transition": {
                    "type": "hard_cut",
                    "duration_frames": 0,
                },
                "captions": {
                    "source": "voice",
                    "page_target_words": 4,
                    "max_words": 7,
                    "max_lines": 2,
                },
            },
        ],
    }
    renderer_package = {
        "name": "zodiac-remotion-renderer",
        "private": True,
        "type": "module",
        "scripts": EXPECTED_SCRIPTS,
        "dependencies": EXPECTED_DEPENDENCIES,
        "devDependencies": {
            "@types/node": "24.0.0",
            "@types/react": "19.0.0",
            "typescript": "5.8.0",
        },
    }
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>'
    )
    files = {
        "README.md": "# Video\n\nPLUGIN SIDE COMPLETE\n",
        "design.md": design_markdown(token),
        "narration.txt": "Xin chào mọi người.\n",
        "production.json": json.dumps(production, ensure_ascii=False),
        "handoff-manifest.json": json.dumps(
            {
                "package_id": "zodiac-test",
                "plugin_version": "test",
                "status": ["LOCAL_RUNTIME_PENDING"],
                "render_ready": False,
            },
            ensure_ascii=False,
        ),
        "assets/characters/lead-neutral.svg": svg,
        "assets/characters/lead-active.svg": svg,
        "renderer/package.json": json.dumps(renderer_package),
        "publish/publish-copy.txt": (
            "COVER IDENTITY:\nXỬ NỮ ♍\n\n"
            "HOOK:\nBẬT CHẾ ĐỘ KIỂM LỖI 24/7?\n\n"
            "TIKTOK CAPTION:\nMột caption thử nghiệm.\n\n"
            "HASHTAGS:\n#xunu #cungxunu #virgo\n"
        ),
        "publish/publish.json": json.dumps(
            {
                "version": "1.1",
                "platform": "tiktok",
                "cover": {
                    "layout": "tilted_top_hook",
                    "identity": {
                        "sign_id": "virgo",
                        "label": "XỬ NỮ",
                        "glyph": "♍",
                    },
                    "hook": "BẬT CHẾ ĐỘ KIỂM LỖI 24/7?",
                    "source_scene_id": "S01",
                    "visuals": [
                        {
                            "entity_id": "character.lead",
                            "state_id": "neutral",
                        }
                    ],
                },
                "caption": "Một caption thử nghiệm.",
                "hashtags": ["#xunu", "#cungxunu", "#virgo"],
            },
            ensure_ascii=False,
        ),
    }
    renderer_sources = {
        "renderer/src/index.ts": "registerRoot(RemotionRoot);\n",
        "renderer/src/Root.tsx": (
            "const calculateMetadata = ({props}) => ({durationInFrames: props.total_duration_frames});\n"
            "export const RemotionRoot = () => <>"
            "<Composition id=\"ZodiacVideo\" calculateMetadata={calculateMetadata} durationInFrames={1} />"
            "<Still id=\"ZodiacCover\" component={ZodiacCover} />"
            "</>;\n"
        ),
        "renderer/src/ZodiacCover.tsx": (
            "const scene = production.scenes.find((item) => item.id === publish.cover.source_scene_id);\n"
            "const entity = scene.entities.find((item) => item.id === visual.entity_id);\n"
            "const state = entity.states[visual.state_id];\n"
            "const tilted = {transform: \"rotate(-3deg)\"};\n"
            "export const ZodiacCover = () => <div>{publish.cover.identity.label}{publish.cover.hook}</div>;\n"
        ),
        "renderer/src/ZodiacComposition.tsx": (
            "export const ZodiacComposition = (timing) => production.scenes.map((scene) => {\n"
            "  const row = timing.scenes.find((item) => item.scene_id === scene.id);\n"
            "  return <Sequence from={row.start_frame} durationInFrames={row.duration_frames}>\n"
            "    <Audio src={staticFile(\"voice.wav\")} />{scene.entities.map(() => null)}{scene.events.map(() => null)}\n"
            "  </Sequence>;\n"
            "});\n"
            "const captionStyle = {width: \"fit-content\", maxWidth: area.width, left: \"50%\", transform: \"translateX(-50%)\"};\n"
            "const canonicalContentZone = () => ({x:48,y:70,width:984,height:1260});\n"
            "const contentFrameStyle = () => ({overflow: \"hidden\"});\n"
        ),
        "renderer/src/PrimitiveSvg.tsx": "export const PrimitiveSvg = () => null;\n",
        "renderer/src/types.ts": (
            "export type ProductionScene = {id: string};\n"
            "export type Production = {version: \"2.0\"; scenes: ProductionScene[]};\n"
            "export type RuntimeTiming = {total_duration_frames: number; scenes: unknown[]};\n"
        ),
        "renderer/src/runtime-contract.mjs": "export const resolveProductionEvents = () => ({});\n",
        "renderer/scripts/render.mjs": (
            "const renderPropsPath = path.join(packageRoot, '.runtime', 'render-props.json');\n"
            "await writeFile(renderPropsPath, JSON.stringify(timing));\n"
            "const videoArgs = ['render', 'src/index.ts', 'ZodiacVideo', '../out/zodiac-story.mp4'];\n"
            "const coverArgs = ['still', 'src/index.ts', 'ZodiacCover', '../out/cover.png'];\n"
            "spawnSync(cli, videoArgs); spawnSync(cli, coverArgs);\n"
            "await copyFile('publish/publish-copy.txt', '../out/publish-copy.txt');\n"
            "await copyFile('publish/publish.json', '../out/publish.json');\n"
        ),
        "renderer/scripts/generate-sfx.mjs": "export const generateSfx = async () => {};\n",
        "renderer/scripts/style-token.mjs": "export const parseDesignToken = () => ({});\n",
        "renderer/scripts/compile-style-token.mjs": "export {};\n",
        "renderer/schemas/production.schema.json": "{}\n",
        "renderer/tests/pipeline-contract.test.mjs": "test('renderer contract', () => {});\n",
    }
    files.update(renderer_sources)
    return files


def v3_package_files():
    files = package_files()
    token = v3_style_token()
    source_hash = token_hash(token)
    production = json.loads(files["production.json"])
    production["visual_system"]["palette"] = token["palette_roles"]
    production["visual_system"]["style_token"] = {**token, "source_hash": source_hash}
    production["caption_style"] = {
        "font_family": "Patrick Hand",
        "font_size_px": 84,
        "min_font_size_px": 64,
        "font_weight": 400,
        "color": token["palette_roles"]["ink"],
        "highlight_color": token["palette_roles"]["coral"],
        "background": "transparent",
        "safe_area": token["safe_zone"],
        "max_lines": 2,
    }
    for asset in production["assets"].values():
        asset["style_id"] = token["id"]

    files["design.md"] = design_markdown(token)
    files["production.json"] = json.dumps(production, ensure_ascii=False)
    handoff = json.loads(files["handoff-manifest.json"])
    handoff["plugin_version"] = "1.14.0"
    files["handoff-manifest.json"] = json.dumps(handoff, ensure_ascii=False)
    files["package-manifest.json"] = json.dumps(
        {
            "format": "zodiac-job@3",
            "production_contract": "2.0",
            "runtime": {
                "id": "zodiac-remotion",
                "version": "1.14.0",
                "sha256": RUNTIME_V3_HASH,
            },
            "design": {
                "id": token["id"],
                "version": token["version"],
                "sha256": source_hash,
            },
            "producer": {
                "plugin": "zodiac-video-pipeline",
                "version": "1.14.0",
            },
        },
        ensure_ascii=False,
    )
    for name in list(files):
        if name.startswith("renderer/"):
            del files[name]
    return files


def semantic_thief_v315_files():
    files = v3_package_files()
    production = json.loads(files["production.json"])
    token = v3_style_token()
    source_hash = token_hash(token)

    def lineage(intent, mutated=None, preserved=None):
        value = {
            "mode": "semantic_variant",
            "source_library": "zodiac-paper-doodle-asset-library-v3",
            "source_master": "compact-safe",
            "semantic_intent": intent,
        }
        if mutated is not None:
            value["mutated_groups"] = mutated
        if preserved is not None:
            value["preserved_groups"] = preserved
        return value

    asset_base = {
        "kind": "svg",
        "category": "prop_state",
        "format": "image/svg+xml",
        "style_id": token["id"],
    }
    production["assets"] = {
        "safe.body": {
            **asset_base,
            "pose": "body",
            "path": "assets/props/safe-body.svg",
            "lineage": lineage(
                "Keep the compact-safe structural shell while its door moves independently.",
                [],
                ["body", "dial", "interior", "contents_slot"],
            ),
        },
        "safe.door.closed": {
            **asset_base,
            "pose": "door_closed",
            "path": "assets/props/safe-door-closed.svg",
            "lineage": lineage(
                "Extract the compact-safe door as a child entity in its closed orientation.",
                ["door"],
                ["body", "dial"],
            ),
        },
        "safe.door.open": {
            **asset_base,
            "pose": "door_open",
            "path": "assets/props/safe-door-open.svg",
            "lineage": lineage(
                "Rotate the compact-safe door child entity into an open orientation.",
                ["door"],
                ["body", "dial"],
            ),
        },
    }
    transform = {"x": 260, "y": 480, "width": 420, "height": 420}
    production["scenes"][0]["entities"] = [
        {
            "id": "safe",
            "kind": "object",
            "initial_state": "body",
            "states": {
                "body": {
                    "asset": "safe.body",
                    "transform": transform,
                    "layer": 2,
                    "visible": True,
                }
            },
        },
        {
            "id": "safe-door",
            "kind": "object",
            "initial_state": "closed",
            "states": {
                "closed": {
                    "asset": "safe.door.closed",
                    "transform": transform,
                    "layer": 3,
                    "visible": True,
                },
                "open": {
                    "asset": "safe.door.open",
                    "transform": transform,
                    "layer": 3,
                    "visible": True,
                },
            },
        },
    ]
    production["scenes"][0]["events"] = [
        {
            "id": "S01-E01",
            "target": "safe-door",
            "action": "open_safe",
            "state_before": "closed",
            "state_after": "open",
            "trigger": {"source": "scene_start"},
            "motion": {"preset": "state_swap", "duration_frames": 6},
            "mechanism": {
                "mode": "child_entities",
                "parts": ["safe-door"],
            },
        }
    ]

    for name in list(files):
        if name.startswith("assets/"):
            del files[name]
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" '
        'viewBox="0 0 10 10"><g id="body"><rect x="1" y="1" width="8" height="8"/></g></svg>'
    )
    files["assets/props/safe-body.svg"] = svg
    files["assets/props/safe-door-closed.svg"] = svg
    files["assets/props/safe-door-open.svg"] = svg

    publish = json.loads(files["publish/publish.json"])
    publish["cover"]["source_scene_id"] = "S01"
    publish["cover"]["visuals"] = [{"entity_id": "safe-door", "state_id": "closed"}]
    files["publish/publish.json"] = json.dumps(publish, ensure_ascii=False)

    production_text = json.dumps(production, ensure_ascii=False)
    files["production.json"] = production_text
    manifest = json.loads(files["package-manifest.json"])
    manifest["runtime"] = {
        "id": "zodiac-remotion",
        "version": "1.15.0",
        "sha256": RUNTIME_V315_HASH,
    }
    manifest["design"] = {
        "id": token["id"],
        "version": token["version"],
        "sha256": source_hash,
    }
    manifest["producer"] = {
        "plugin": "zodiac-video-pipeline",
        "version": "1.20.0",
    }
    files["package-manifest.json"] = json.dumps(manifest, ensure_ascii=False)
    handoff = json.loads(files["handoff-manifest.json"])
    handoff["plugin_version"] = "1.20.0"
    files["handoff-manifest.json"] = json.dumps(handoff, ensure_ascii=False)
    files["FINAL_VALIDATION.json"] = json.dumps(
        {
            "status": "PASS",
            "package_compatibility_gate": "PASS",
            "narration_scene_voice_identity": "PASS",
            "caption_design_lock": "PASS",
            "handoff_boundary": "PASS",
            "asset_lineage": "PASS",
            "semantic_animation_gate": "PASS",
            "interaction_choreography": "NOT_APPLICABLE",
            "production_sha256": hashlib.sha256(
                production_text.encode("utf-8")
            ).hexdigest(),
        },
        ensure_ascii=False,
    )
    return files


def write_semantic_thief_v315_package(root: Path) -> Path:
    job = root / "zodiac-v315-thief"
    for name, content in semantic_thief_v315_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def v4_package_files():
    files = semantic_thief_v315_files()
    files.pop("FINAL_VALIDATION.json", None)
    files.pop("handoff-manifest.json", None)
    files["package-manifest.json"] = json.dumps(
        {
            "format": "zodiac-job@4",
            "production_contract": "2.0",
            "runtime": {
                "id": "zodiac-remotion",
                "version": "1.15.0",
            },
            "producer": {
                "plugin": "zodiac-video-pipeline",
                "version": "1.21.0",
            },
        },
        ensure_ascii=False,
    )
    return files


def write_v4_package(root: Path) -> Path:
    job = root / "zodiac-v4-test"
    for name, content in v4_package_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job

def performance_v316_files():
    files = v4_package_files()
    production = json.loads(files["production.json"])
    for scene in production["scenes"]:
        scene["captions"] = {
            "source": "voice",
            "segmentation": "semantic",
            "max_lines": 2,
        }
        for event in scene["events"]:
            event["performance"] = {
                "intent": "make the visible state change readable before it lands",
                "phase": "action",
                "energy": 0.45,
                "anticipation_frames": 4,
                "hold_frames": 8,
                "settle_frames": 6,
            }
    files["production.json"] = json.dumps(production, ensure_ascii=False)
    manifest = json.loads(files["package-manifest.json"])
    manifest["runtime"] = {
        "id": "zodiac-remotion",
        "version": "1.16.0",
    }
    manifest["producer"]["version"] = "1.30.0"
    files["package-manifest.json"] = json.dumps(manifest, ensure_ascii=False)
    return files


def write_performance_v316_package(root: Path) -> Path:
    job = root / "zodiac-v316-performance"
    for name, content in performance_v316_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def runtime_owned_v3191_files():
    files = performance_v316_files()
    production = json.loads(files["production.json"])
    for scene in production["scenes"]:
        for event in scene["events"]:
            event.pop("motion", None)
            event.pop("performance", None)
    files["production.json"] = json.dumps(production, ensure_ascii=False)
    manifest = json.loads(files["package-manifest.json"])
    manifest["runtime"] = {
        "id": "zodiac-remotion",
        "version": "1.19.1",
    }
    manifest["producer"]["version"] = "1.43.0"
    files["package-manifest.json"] = json.dumps(manifest, ensure_ascii=False)
    return files


def write_runtime_owned_v3191_package(root: Path) -> Path:
    job = root / "zodiac-v3191-runtime-owned-animation"
    for name, content in runtime_owned_v3191_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def runtime_owned_v3200_files():
    files = runtime_owned_v3191_files()
    manifest = json.loads(files["package-manifest.json"])
    manifest["runtime"] = {
        "id": "zodiac-remotion",
        "version": "1.20.0",
    }
    manifest["producer"]["version"] = "1.46.0"
    files["package-manifest.json"] = json.dumps(manifest, ensure_ascii=False)
    return files


def write_runtime_owned_v3200_package(root: Path) -> Path:
    job = root / "zodiac-v3200-layer-safety"
    for name, content in runtime_owned_v3200_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def runtime_owned_v3210_files():
    files = runtime_owned_v3200_files()
    token = v4_style_token()
    source_hash = token_hash(token)
    production = json.loads(files["production.json"])
    production["visual_system"]["palette"] = token["palette_roles"]
    production["visual_system"]["style_token"] = {**token, "source_hash": source_hash}
    production["caption_style"].update(
        {
            "font_family": "Patrick Hand",
            "font_stack": ["Patrick Hand", "Segoe Print", "cursive"],
            "css_font_family": '"Patrick Hand", "Segoe Print", cursive',
            "font_size_px": 84,
            "min_font_size_px": 64,
            "font_weight": 400,
            "color": token["palette_roles"]["ink"],
            "highlight_color": token["palette_roles"]["coral"],
            "background": "transparent",
            "safe_area": token["safe_zone"],
            "max_lines": 2,
        }
    )
    for asset_id, asset in production["assets"].items():
        asset["style_id"] = token["id"]
        lineage = asset.get("lineage")
        if isinstance(lineage, dict):
            lineage["mode"] = "composite"
            lineage["source_library"] = "zodiac-visual-grammar-v4"
            lineage["source_master"] = str(lineage.get("source_master") or asset_id)
    files["design.md"] = design_markdown(token)
    files["production.json"] = json.dumps(production, ensure_ascii=False)
    manifest = json.loads(files["package-manifest.json"])
    manifest["runtime"] = {"id": "zodiac-remotion", "version": "1.21.0"}
    manifest["producer"]["version"] = "1.58.0"
    files["package-manifest.json"] = json.dumps(manifest, ensure_ascii=False)
    if "publish/publish.json" in files:
        publish = json.loads(files["publish/publish.json"])
        publish.setdefault("source", {})["narration"] = "narration.txt"
        publish["source"]["production"] = "production.json"
        files["publish/publish.json"] = json.dumps(publish, ensure_ascii=False)
    return files


def write_runtime_owned_v3210_package(root: Path) -> Path:
    job = root / "zodiac-v3210-v4-style"
    for name, content in runtime_owned_v3210_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def write_v3_package(root: Path) -> Path:
    job = root / "zodiac-v3-test"
    for name, content in v3_package_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def write_package(root: Path) -> Path:
    job = root / "zodiac-test"
    for name, content in package_files().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


def write_zip(path: Path, files, root="zodiac-test"):
    with zipfile.ZipFile(
        path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
    ) as archive:
        for name, content in files.items():
            archive.writestr(f"{root}/{name}", content)


def valid_timing():
    return {
        "fps": 30,
        "total_duration_frames": 30,
        "scenes": [
            {
                "scene_id": "S01",
                "start_frame": 0,
                "duration_frames": 30,
                "captions": [
                    {
                        "text": "Xin",
                        "startMs": 0,
                        "endMs": 180,
                        "timestampMs": 0,
                        "confidence": 0.99,
                    },
                    {
                        "text": "chào",
                        "startMs": 180,
                        "endMs": 380,
                        "timestampMs": 180,
                        "confidence": 0.99,
                    },
                    {
                        "text": "mọi",
                        "startMs": 380,
                        "endMs": 600,
                        "timestampMs": 380,
                        "confidence": 0.99,
                    },
                    {
                        "text": "người.",
                        "startMs": 600,
                        "endMs": 900,
                        "timestampMs": 600,
                        "confidence": 0.99,
                    },
                ],
            },
        ],
    }


def write_pcm(path: Path, seconds=1.0, rate=8000):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b"\x00\x00" * int(seconds * rate))



REPO_ROOT = Path(__file__).resolve().parents[2]

# Export private single-underscore helpers too: case modules preserve the original test module namespace.
__all__ = [name for name in globals() if not name.startswith("__")]
