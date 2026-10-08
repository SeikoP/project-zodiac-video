import stat
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

import tools.control_plane.package_io as package_io
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_io import extract_package_archive


class PackageIoTests(unittest.TestCase):
    def _zip(self, root: Path, entries: list[tuple[str, bytes]]) -> Path:
        path = root / "job.zip"
        with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as handle:
            for name, payload in entries:
                handle.writestr(name, payload)
        return path

    def test_extracts_root_flat_package(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [
                    ("package-manifest.json", b"{}"),
                    ("production.ir.json", b"{}"),
                    ("assets/char.svg", b"<svg/>"),
                ],
            )
            destination = root / "out"
            package_root = extract_package_archive(archive, destination)
            self.assertEqual(package_root, destination)
            self.assertTrue((package_root / "package-manifest.json").is_file())
            self.assertTrue((package_root / "assets" / "char.svg").is_file())

    def test_strips_one_unambiguous_wrapper_directory(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [
                    ("zodiac-bocap/package-manifest.json", b"{}"),
                    ("zodiac-bocap/production.ir.json", b"{}"),
                ],
            )
            destination = root / "out"
            package_root = extract_package_archive(archive, destination)
            self.assertEqual(package_root, destination)
            self.assertTrue((destination / "package-manifest.json").is_file())
            self.assertFalse((destination / "zodiac-bocap").exists())

    def test_rejects_path_traversal(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(root, [("../escape.txt", b"x")])
            with self.assertRaises(ControlPlaneError) as caught:
                extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_absolute_or_drive_paths(self):
        for name in ("/absolute.txt", "C:/drive.txt", "C:\\drive.txt"):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as temp:
                root = Path(temp)
                archive = self._zip(root, [(name, b"x")])
                with self.assertRaises(ControlPlaneError) as caught:
                    extract_package_archive(archive, root / "out")
                self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_casefold_duplicate_normalized_paths(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [
                    ("Assets/Char.svg", b"a"),
                    ("assets/char.svg", b"b"),
                ],
            )
            with self.assertRaises(ControlPlaneError) as caught:
                extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_symlink_entries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "job.zip"
            info = zipfile.ZipInfo("link")
            info.create_system = 3
            info.external_attr = (stat.S_IFLNK | 0o777) << 16
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr("package-manifest.json", "{}")
                handle.writestr(info, "target")
            with self.assertRaises(ControlPlaneError) as caught:
                extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_special_file_entries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = root / "job.zip"
            info = zipfile.ZipInfo("pipe")
            info.create_system = 3
            info.external_attr = (stat.S_IFIFO | 0o644) << 16
            with zipfile.ZipFile(archive, "w") as handle:
                handle.writestr("package-manifest.json", "{}")
                handle.writestr(info, "payload")
            with self.assertRaises(ControlPlaneError) as caught:
                extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_encrypted_entries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [("package-manifest.json", b"{}"), ("assets/file.txt", b"payload")],
            )
            payload = bytearray(archive.read_bytes())
            local = payload.find(b"PK\x03\x04")
            central = payload.find(b"PK\x01\x02")
            self.assertGreaterEqual(local, 0)
            self.assertGreaterEqual(central, 0)
            payload[local + 6] |= 1
            payload[central + 8] |= 1
            archive.write_bytes(payload)
            with self.assertRaises(ControlPlaneError) as caught:
                extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_too_many_archive_entries(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [
                    ("package-manifest.json", b"{}"),
                    ("one", b"1"),
                    ("two", b"2"),
                ],
            )
            with patch.object(package_io, "MAX_ARCHIVE_ENTRIES", 2, create=True):
                with self.assertRaises(ControlPlaneError) as caught:
                    extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_member_over_expanded_size_limit(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [("package-manifest.json", b"{}"), ("assets/large", b"1234")],
            )
            with patch.object(package_io, "MAX_ARCHIVE_FILE_BYTES", 3, create=True):
                with self.assertRaises(ControlPlaneError) as caught:
                    extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_total_expanded_size_limit(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [
                    ("package-manifest.json", b"{}"),
                    ("one", b"123"),
                    ("two", b"456"),
                ],
            )
            with patch.object(package_io, "MAX_ARCHIVE_TOTAL_BYTES", 5, create=True):
                with self.assertRaises(ControlPlaneError) as caught:
                    extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")

    def test_rejects_suspicious_compression_ratio(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            archive = self._zip(
                root,
                [("package-manifest.json", b"{}"), ("assets/repeated", b"x" * 100)],
            )
            with patch.object(package_io, "MAX_ARCHIVE_RATIO_CHECK_BYTES", 1, create=True):
                with patch.object(package_io, "MAX_ARCHIVE_COMPRESSION_RATIO", 2, create=True):
                    with self.assertRaises(ControlPlaneError) as caught:
                        extract_package_archive(archive, root / "out")
            self.assertEqual(caught.exception.code, "PACKAGE_ARCHIVE_UNSAFE")


if __name__ == "__main__":
    unittest.main()
