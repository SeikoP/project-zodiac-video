from tools.control_plane.semantic_qc import strict_errors, asset_category_from_path


def _scene(bindings=None, events=None):
    def entity(name, visible):
        return {"id": name, "initial_state": "initial", "states": {
            "initial": {"asset": name, "visible": visible, "transform": {"x": 0, "y": 0, "width": 100, "height": 100}},
            "shown": {"asset": name, "visible": True, "transform": {"x": 0, "y": 0, "width": 100, "height": 100}},
        }}
    return {"assets": {
        "gemini": {"path": "assets/characters/gemini.svg", "category": "character"},
        "seat": {"path": "assets/environment/seat.svg", "category": "environment"},
    }, "scenes": [{
        "id": "S01", "entities": [entity("gemini", True), entity("seat", False)],
        "events": events or [], "spatial_bindings": bindings or [],
    }]}


def test_story_roles_have_distinct_folders():
    assert asset_category_from_path("assets/story/conversation.svg") == "story_object"
    assert asset_category_from_path("assets/symbols/balance.svg") == "story_symbol"


def test_hidden_anchor_detected_before_render():
    source = _scene([{"entity": "gemini", "anchor": "seat", "max_distance_px": 300}])
    assert "SPATIAL_ANCHOR_HIDDEN" in {i.code for i in strict_errors(source)}


def test_seat_anchored_to_visible_gemini_is_allowed():
    source = _scene([{"entity": "seat", "anchor": "gemini", "max_distance_px": 300}])
    assert "SPATIAL_ANCHOR_HIDDEN" not in {i.code for i in strict_errors(source)}


def test_binding_cycle_is_rejected():
    source = _scene([
        {"entity": "seat", "anchor": "gemini", "max_distance_px": 300},
        {"entity": "gemini", "anchor": "seat", "max_distance_px": 300},
    ])
    assert "SPATIAL_BINDING_CYCLE" in {i.code for i in strict_errors(source)}


def test_later_hide_anchor_is_rejected():
    source = _scene([{"entity": "gemini", "anchor": "seat", "max_distance_px": 300}],
                    [{"id": "E1", "target": "seat", "state_after": "shown"}])
    assert "SPATIAL_ANCHOR_HIDDEN" in {i.code for i in strict_errors(source)}
