"""P5 gallery uses the same exact, read-only transport as other Studio queries."""
from types import SimpleNamespace
import unittest
from unittest.mock import Mock

from tools.studio_project.models import StudioError
from tools.studio_project.rpc_stdio import dispatch


class GalleryTransportTests(unittest.TestCase):
    def test_gallery_dispatch_and_exact_boundary(self):
        gallery = Mock(return_value={"format": "zodiac-asset-gallery@1"})
        service = SimpleNamespace(visual=SimpleNamespace(gallery=gallery))
        self.assertEqual(dispatch(service, "assets.gallery", {"project_id": "p1"})["format"], "zodiac-asset-gallery@1")
        gallery.assert_called_once_with("p1")
        with self.assertRaises(StudioError):
            dispatch(service, "assets.gallery", {"project_id": "p1", "path": "outside"})
