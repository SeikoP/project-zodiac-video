"""Job@5 producer / runner parity for held props, without weakening strict QC."""
import unittest

from tools.control_plane.semantic_qc import strict_errors, semantic_diagnostics


def make_ir(*, relation="held_by", owner_event=True, multiple_states=False,
            owner_kind="character", change_state=True, map_x=170):
    kind_folder = "characters" if owner_kind == "character" else "props"
    char_states = {
        "neutral": {"asset": "CHAR_BASE", "visible": True,
                    "transform": {"x": 0, "y": 0, "width": 300, "height": 400}},
        "raising": {"asset": "CHAR_RAISE", "visible": True,
                    "transform": {"x": 0, "y": 0, "width": 300, "height": 400}},
    }
    map_state = {"asset": "MAP", "visible": True,
                 "transform": {"x": map_x, "y": 140, "width": 130, "height": 150}}
    map_states = {"annotated": map_state}
    if multiple_states:
        map_states["revealed"] = dict(map_state)
    event = [{"id": "E06", "target": "hero", "intent": "raise_map",
              "state_before": "neutral",
              "state_after": "raising" if change_state else "neutral",
              "desired_motion": "state_swap"}] if owner_event else []
    return {"assets": {
                "CHAR_BASE": {"category": owner_kind, "path": f"assets/{kind_folder}/base.svg"},
                "CHAR_RAISE": {"category": owner_kind, "path": f"assets/{kind_folder}/raise.svg"},
                "MAP": {"category": "prop", "path": "assets/props/map.svg"},
            },
            "scenes": [{"id": "S06",
                        "entities": [
                            {"id": "hero", "initial_state": "neutral", "states": char_states},
                            {"id": "paper_map", "initial_state": "annotated", "states": map_states},
                        ],
                        "events": event,
                        "spatial_bindings": [{"entity": "paper_map", "anchor": "hero",
                                              "relation": relation, "max_distance_px": 400}],
                        "caption_timing_status": "estimated_not_audio_aligned"}]}


class RunnerProducerParityTests(unittest.TestCase):
    def codes(self, ir):
        return [x.code for x in strict_errors(ir)]

    def test_single_held_map_and_real_character_gesture_allows_import(self):
        ir = make_ir()
        self.assertEqual(self.codes(ir), [])
        warnings = [x.code for x in semantic_diagnostics(ir) if x.severity == "P2"]
        self.assertIn("STATIC_HELD_PROP_OWNER_GESTURE", warnings)
        self.assertIn("TIMING_UNMEASURED", warnings)

    def test_no_owner_event_blocks(self):
        self.assertIn("INTERACTIVE_PROP_UNSCHEDULED",
                      self.codes(make_ir(owner_event=False)))

    def test_multistate_prop_without_own_event_blocks(self):
        self.assertIn("INTERACTIVE_PROP_UNSCHEDULED",
                      self.codes(make_ir(multiple_states=True)))

    def test_points_to_does_not_inherit_held_exception(self):
        self.assertIn("INTERACTIVE_PROP_UNSCHEDULED",
                      self.codes(make_ir(relation="points_to")))

    def test_non_character_owner_blocks(self):
        self.assertIn("INTERACTIVE_PROP_UNSCHEDULED",
                      self.codes(make_ir(owner_kind="prop")))

    def test_owner_event_must_change_state(self):
        self.assertIn("INTERACTIVE_PROP_UNSCHEDULED",
                      self.codes(make_ir(change_state=False)))

    def test_spatial_bounds_still_block(self):
        self.assertIn("SPATIAL_BOUND_EXCEEDED",
                      self.codes(make_ir(map_x=1200)))


if __name__ == "__main__":
    unittest.main()
