"""Tests for sky_geo.py (python3 -I scripts/scene/test_sky_geo.py)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sky_geo as S  # noqa: E402

EYE = (0.0, -0.5, 1.2)
OPENING = [(0.2, 0.9, 0.8), (2.0, 0.9, 0.8), (2.0, 0.9, 2.4), (0.2, 0.9, 2.4)]


class Plane(unittest.TestCase):
    def test_bounds_and_uv(self):
        for got, want in zip(S.plane_bounds(), (-2.0, 4.0, -0.9, 4.1)):
            self.assertAlmostEqual(got, want)
        for got, want in zip(S.uv_of(-2.0, -0.9) + S.uv_of(4.0, 4.1), (0, 0, 1, 1)):
            self.assertAlmostEqual(got, want)

    def test_ray_meets_the_plane(self):
        x, z = S.onto_plane((0, 0, 0), (1, 0.85, 1))
        self.assertAlmostEqual(x, 2.0)
        self.assertAlmostEqual(z, 2.0)
        with self.assertRaises(ValueError):
            S.onto_plane((0, 0, 0), (0, -1.0, 0))  # looking away from it


class Patch(unittest.TestCase):
    def test_covers_the_opening_with_a_margin_and_stays_on_the_plane(self):
        x0, x1, z0, z1 = S.window_patch(EYE, OPENING)
        for p in OPENING:
            px, pz = S.onto_plane(EYE, p)
            self.assertTrue(x0 < px < x1 and z0 < pz < z1)
        bx0, bx1, bz0, bz1 = S.plane_bounds()
        self.assertTrue(bx0 <= x0 and x1 <= bx1 and bz0 <= z0 and z1 <= bz1)

    def test_cut_to_what_the_camera_sees(self):
        # A frame whose top edge meets the plane at z = 2.0: the patch stops a margin above it.
        view = [(-1.0, 1.7, 2.0), (3.0, 1.7, 2.0), (3.0, 1.7, 0.0), (-1.0, 1.7, 0.0)]
        x0, x1, z0, z1 = S.window_patch(EYE, OPENING, view)
        full = S.window_patch(EYE, OPENING)
        self.assertLess(z1, full[3])
        self.assertLess(z1, 2.0 + (2.0 - z0))

    def test_corners_run_clockwise_from_top_left(self):
        c = S.patch_corners((0.0, 1.0, 0.5, 2.0))
        self.assertEqual(c[0], (0.0, 1.7, 2.0))
        self.assertEqual(c[1], (1.0, 1.7, 2.0))
        self.assertEqual(c[2], (1.0, 1.7, 0.5))
        self.assertEqual(c[3], (0.0, 1.7, 0.5))

    def test_uv(self):
        uv = S.patch_uv((-2.0, 1.0, -0.9, 1.6))
        self.assertEqual(uv, {"u0": 0.0, "v0": 0.0, "u1": 0.5, "v1": 0.5})


if __name__ == "__main__":
    unittest.main()
