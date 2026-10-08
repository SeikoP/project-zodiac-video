from tools.control_plane.semantic_qc import asset_category_from_path, semantic_diagnostics, strict_errors


def scene_fixture():
    return {
        "assets": {
            "PERSON": {"path": "assets/characters/person.svg", "category": "character"},
            "MARK": {"path": "assets/effects/mark.svg", "category": "effect"},
        },
        "scenes": [{
            "id": "S01", "events": [],
            "entities": [
                {"id": "actor", "initial_state": "base", "states": {
                    "base": {"asset": "PERSON", "visible": True, "transform": {"x": 0, "y": 0, "width": 100, "height": 100}}}},
                {"id": "mark", "initial_state": "hidden", "states": {
                    "hidden": {"asset": "MARK", "visible": False, "transform": {"x": 10, "y": 10, "width": 20, "height": 20}},
                    "visible": {"asset": "MARK", "visible": True, "transform": {"x": 10, "y": 10, "width": 20, "height": 20}}}},
            ],
            "spatial_bindings": [{"entity": "mark", "anchor": "actor", "relation": "emitted_by", "max_distance_px": 100}],
        }],
    }


def test_unscheduled_effect_fails_closed():
    assert "EFFECT_UNSCHEDULED" in [e.code for e in strict_errors(scene_fixture())]


def test_explicit_effect_lifecycle_passes():
    ir = scene_fixture()
    ir["scenes"][0]["events"] = [
        {"target": "mark", "state_after": "visible"},
        {"target": "mark", "state_after": "hidden"},
    ]
    assert strict_errors(ir) == []


def test_wrong_category_caught():
    ir = scene_fixture()
    ir["assets"]["MARK"]["category"] = "prop"
    assert "ASSET_CATEGORY_MISMATCH" in [e.code for e in strict_errors(ir)]


def test_all_states_checked_for_spatial_violations():
    ir = scene_fixture()
    ir["scenes"][0]["entities"][1]["states"]["visible"]["transform"]["x"] = 1000
    assert "SPATIAL_BOUND_EXCEEDED" in [e.code for e in strict_errors(ir)]


def test_decorative_still_scene_allowed():
    ir = scene_fixture()
    del ir["assets"]["MARK"]
    ir["scenes"][0]["entities"].pop()
    ir["scenes"][0]["spatial_bindings"] = []
    assert semantic_diagnostics(ir) == []
    assert asset_category_from_path("assets/effects/x.svg") == "effect"


def test_alternate_anchor_states_do_not_trigger_false_spatial_failure():
    ir = scene_fixture()
    actor = ir["scenes"][0]["entities"][0]
    actor["states"]["far"] = {
        "asset": "PERSON", "visible": True,
        "transform": {"x": 700, "y": 700, "width": 100, "height": 100},
    }
    # A pose is alternative, not simultaneously present.
    assert "SPATIAL_BOUND_EXCEEDED" not in [e.code for e in semantic_diagnostics(ir)]


def test_effect_hidden_then_visible_must_eventually_release():
    ir = scene_fixture()
    ir["scenes"][0]["events"] = [
        {"target": "mark", "state_after": "hidden"},
        {"target": "mark", "state_after": "visible"},
    ]
    assert "EFFECT_NO_RELEASE" in [e.code for e in strict_errors(ir)]


def test_effect_never_shown_is_invalid():
    ir = scene_fixture()
    ir["scenes"][0]["events"] = [{"target": "mark", "state_after": "hidden"}]
    assert "EFFECT_NO_ENTRANCE" in [e.code for e in strict_errors(ir)]
