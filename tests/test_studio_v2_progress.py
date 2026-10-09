"""Progress events correspond to completed real units; tqdm never fakes work."""
import unittest

from tools.studio_v2.progress import observe_unit_progress, tracked_units, reset_unit_progress


class TqdmTelemetryTests(unittest.TestCase):
    def test_emits_each_completed_unit(self):
        events = []
        with observe_unit_progress(lambda *fields: events.append(fields)):
            for _ in tracked_units(["s01", "s02", "s03"], stage="RENDER",
                                   label="Render", unit="segment"):
                pass
        self.assertEqual(events, [
            ("RENDER", 1, 3, "segment", "Render"),
            ("RENDER", 2, 3, "segment", "Render"),
            ("RENDER", 3, 3, "segment", "Render"),
        ])

    def test_exception_does_not_mark_unfinished_unit(self):
        events = []
        with observe_unit_progress(lambda *args: events.append(args)):
            with self.assertRaisesRegex(RuntimeError, "render failed"):
                for item in tracked_units([1, 2, 3], stage="RENDER",
                                          label="Render", unit="segment"):
                    if item == 2:
                        raise RuntimeError("render failed")
        self.assertEqual(len(events), 1)
        self.assertEqual(events[0][1:3], (1, 3))

    def test_fallback_invalidates_partial_count(self):
        events = []
        with observe_unit_progress(lambda *args: events.append(args)):
            reset_unit_progress("RENDER", label="Fallback", unit="segment")
        self.assertEqual(events, [("RENDER", 0, 0, "segment", "Fallback")])

    def test_empty_sequence_has_no_measured_percent(self):
        events = []
        with observe_unit_progress(lambda *args: events.append(args)):
            self.assertEqual(list(tracked_units([], stage="RENDER",
                               label="Render", unit="segment")), [])
        self.assertEqual(events, [])


if __name__ == "__main__":
    unittest.main()
