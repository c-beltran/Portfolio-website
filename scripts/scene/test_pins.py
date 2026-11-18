"""Tests for pins.py. Run: python3 -I scripts/scene/test_pins.py"""

import hashlib
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pins import PinError, verify_download  # noqa: E402


class VerifyDownload(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dl = Path(self.tmp.name)
        self.zip = self.dl / "model_x.zip"
        with zipfile.ZipFile(self.zip, "w") as z:
            z.writestr("scene.gltf", '{"asset":{}}')
            z.writestr("textures/a.png", b"\x89PNG")
        self.sha = hashlib.sha256(self.zip.read_bytes()).hexdigest()

    def tearDown(self):
        self.tmp.cleanup()

    def test_extracts_a_pinned_zip_and_returns_the_gltf(self):
        p = verify_download(self.dl, "model_x/scene.gltf", self.sha)
        self.assertEqual(p, self.dl / "model_x" / "scene.gltf")
        self.assertEqual((self.dl / "model_x/textures/a.png").read_bytes(), b"\x89PNG")

    def test_accepts_an_existing_extraction_that_matches(self):
        verify_download(self.dl, "model_x/scene.gltf", self.sha)
        verify_download(self.dl, "model_x/scene.gltf", self.sha)

    def test_rejects_a_zip_whose_hash_differs(self):
        with self.assertRaisesRegex(PinError, "sha256"):
            verify_download(self.dl, "model_x/scene.gltf", "0" * 64)

    def test_rejects_an_edited_extracted_file(self):
        verify_download(self.dl, "model_x/scene.gltf", self.sha)
        (self.dl / "model_x/scene.gltf").write_text('{"asset":{"edited":1}}')
        with self.assertRaisesRegex(PinError, "differs"):
            verify_download(self.dl, "model_x/scene.gltf", self.sha)

    def test_rejects_a_missing_zip(self):
        with self.assertRaisesRegex(PinError, "missing"):
            verify_download(self.dl, "model_y/scene.gltf", self.sha)

    def test_rejects_unsafe_member_paths(self):
        bad = self.dl / "model_z.zip"
        with zipfile.ZipFile(bad, "w") as z:
            z.writestr("../escape.txt", "x")
        sha = hashlib.sha256(bad.read_bytes()).hexdigest()
        with self.assertRaisesRegex(PinError, "unsafe"):
            verify_download(self.dl, "model_z/scene.gltf", sha)
        self.assertFalse((self.dl / "escape.txt").exists())


if __name__ == "__main__":
    unittest.main()
