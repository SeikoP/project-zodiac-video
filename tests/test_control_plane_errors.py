import unittest

from tools.control_plane.contracts import validate_contract_shape
from tools.control_plane.errors import ControlPlaneError, error_result


class ControlPlaneErrorTests(unittest.TestCase):
    def test_error_serializes_to_canonical_shape(self):
        error = ControlPlaneError(
            code="TIMELINE_TARGET_CONFLICT",
            stage="PLAN",
            message="same target cannot be scheduled within drift allowance",
            scene_id="S02",
            event_id="E22",
            target="scorpio",
            detail={
                "preferred_start": 188,
                "prior_end": 192,
                "max_drift_frames": 3,
            },
        )
        payload = error.to_dict()
        self.assertEqual(
            payload,
            {
                "ok": False,
                "code": "TIMELINE_TARGET_CONFLICT",
                "stage": "PLAN",
                "message": "same target cannot be scheduled within drift allowance",
                "scene_id": "S02",
                "event_id": "E22",
                "target": "scorpio",
                "detail": {
                    "preferred_start": 188,
                    "prior_end": 192,
                    "max_drift_frames": 3,
                },
            },
        )
        self.assertEqual(validate_contract_shape("error-v1", payload), [])

    def test_optional_context_is_serialized_as_null(self):
        payload = ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="invalid package",
        ).to_dict()
        self.assertIsNone(payload["scene_id"])
        self.assertIsNone(payload["event_id"])
        self.assertIsNone(payload["target"])
        self.assertEqual(payload["detail"], {})

    def test_error_result_is_same_canonical_payload(self):
        error = ControlPlaneError(
            code="ANCHOR_NOT_FOUND",
            stage="PLAN",
            message="anchor not found",
            scene_id="S01",
            event_id="E01",
        )
        self.assertEqual(error_result(error), error.to_dict())

    def test_invalid_stage_is_rejected_at_construction(self):
        with self.assertRaises(ValueError):
            ControlPlaneError(
                code="BROKEN",
                stage="NOT_A_STAGE",
                message="bad",
            )


if __name__ == "__main__":
    unittest.main()
