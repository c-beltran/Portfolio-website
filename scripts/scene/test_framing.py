"""Tests for framing.py (python3 -I scripts/scene/test_framing.py): the Python twin of
content/scene/framing.ts, read from the same framing.json."""

import math
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import framing  # noqa: E402


class Master(unittest.TestCase):
    def test_seat(self):
        w, h, safe = framing.master()
        self.assertAlmostEqual(w, 32 / 9, places=12)
        self.assertAlmostEqual(h, 4 / 3, places=12)
        self.assertAlmostEqual(safe["x0"], 0.275, places=6)
        self.assertAlmostEqual(safe["y0"], 0.25, places=6)
        self.assertAlmostEqual(safe["x1"], 0.725, places=6)
        self.assertEqual(safe["y1"], 1)


class CameraFor(unittest.TestCase):
    def test_seat(self):
        sensor, lens, sx, sy = framing.camera_for(math.radians(60))
        self.assertEqual(sx, 0)
        self.assertAlmostEqual(sy, (4 / 3 - 1) / (2 * 32 / 9), places=12)
        hfov = 2 * math.atan(sensor / 2 / lens)
        self.assertAlmostEqual(hfov, 2 * math.atan(math.tan(math.radians(30)) * (32 / 9) / (8 / 5)), places=12)

    def test_resolution(self):
        self.assertEqual(framing.resolution(), (round(1600 * 32 / 9), round(1600 * 4 / 3)))

    def test_camera_name(self):
        self.assertEqual(framing.CAMERA, "cam_seat")


if __name__ == "__main__":
    unittest.main()
