"""Tests for pins.py. Run: python3 -I scripts/scene/test_pins.py"""

import hashlib
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pins import PinError, verify_download, verify_files  # noqa: E402


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


class VerifyFiles(unittest.TestCase):
    """Loose downloads (Poly Haven ships its glTF as separate files, not a zip): every file pinned
    by its own sha256, and every buffer and image the glTF names must be one of them."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dl = Path(self.tmp.name)
        self.folder = self.dl / "plant_x"
        (self.folder / "textures").mkdir(parents=True)
        files = {
            "plant.gltf": b'{"asset":{},"buffers":[{"uri":"plant.bin"}],"images":[{"uri":"textures/d.jpg"}]}',
            "plant.bin": b"\x00\x01",
            "textures/d.jpg": b"\xff\xd8",
        }
        for rel, data in files.items():
            (self.folder / rel).write_bytes(data)
        self.pins = {rel: hashlib.sha256(data).hexdigest() for rel, data in files.items()}

    def tearDown(self):
        self.tmp.cleanup()

    def test_accepts_a_pinned_set_and_returns_the_gltf(self):
        self.assertEqual(verify_files(self.dl, "plant_x/plant.gltf", self.pins), self.folder / "plant.gltf")

    def test_rejects_a_changed_file(self):
        (self.folder / "plant.bin").write_bytes(b"\x09")
        with self.assertRaisesRegex(PinError, "differs"):
            verify_files(self.dl, "plant_x/plant.gltf", self.pins)

    def test_rejects_a_missing_file(self):
        (self.folder / "textures/d.jpg").unlink()
        with self.assertRaisesRegex(PinError, "missing"):
            verify_files(self.dl, "plant_x/plant.gltf", self.pins)

    def test_rejects_an_unsafe_path(self):
        with self.assertRaisesRegex(PinError, "unsafe"):
            verify_files(self.dl, "plant_x/plant.gltf", {**self.pins, "../evil.bin": "0" * 64})

    def test_rejects_a_uri_that_is_not_pinned(self):
        pins = {k: v for k, v in self.pins.items() if k != "textures/d.jpg"}
        with self.assertRaisesRegex(PinError, "not pinned"):
            verify_files(self.dl, "plant_x/plant.gltf", pins)


if __name__ == "__main__":
    unittest.main()
