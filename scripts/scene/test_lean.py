"""Where a lean-in's camera stands (no Blender):  python3 -I scripts/scene/test_lean.py"""

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import lean as L  # noqa: E402

# A quad turned 8° about Z, on the far side of the desk: top-left, top-right, bottom-right, bottom-left.
C, S = math.cos(math.radians(8)), math.sin(math.radians(8))
QUAD = [(0.1 + x * C, 0.3 + x * S, z) for x, z in ((-0.2, 1.27), (0.2, 1.27), (0.2, 0.93), (-0.2, 0.93))]
SEAT = (-0.03, -0.85, 1.30)


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


class Lean(unittest.TestCase):
    def setUp(self):
        self.eye, self.target = L.lean_camera(QUAD, SEAT)

    def test_eye_at_distance(self):
        self.assertAlmostEqual(math.dist(self.eye, self.target), L.LEAN_DISTANCE, places=9)

    def test_looks_square(self):
        axis = sub(self.eye, self.target)
        self.assertAlmostEqual(dot(axis, sub(QUAD[1], QUAD[0])), 0, delta=1e-9)
        self.assertAlmostEqual(dot(axis, sub(QUAD[3], QUAD[0])), 0, delta=1e-9)

    def test_on_the_seat_side(self):
        self.assertGreater(dot(sub(self.eye, self.target), sub(SEAT, self.target)), 0)
        back, _ = L.lean_camera(QUAD[::-1], SEAT)
        for a, b in zip(back, self.eye):
            self.assertAlmostEqual(a, b, places=9, msg="the winding doesn't choose the side")

    def test_target_is_the_centroid(self):
        for i in range(3):
            self.assertAlmostEqual(self.target[i], sum(p[i] for p in QUAD) / 4, places=9)


if __name__ == "__main__":
    unittest.main()
