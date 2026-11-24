"""Canonical opened poses (no Blender):  python3 -I scripts/scene/test_opened.py"""

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import opened as O  # noqa: E402

DOWN = math.radians(22.5)  # the seat looks 22.5° down
EYE = (0.0, -0.9, 1.15)
FORWARD = (0.0, math.cos(DOWN), -math.sin(DOWN))
UP = (0.0, math.sin(DOWN), math.cos(DOWN))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def norm(a):
    return math.sqrt(dot(a, a))


def angle(a, b):
    return math.degrees(math.acos(max(-1.0, min(1.0, dot(a, b) / (norm(a) * norm(b))))))


def rotate_xyzw(q, v):
    """v rotated by a three-style quaternion (x, y, z, w)."""
    x, y, z, w = q
    return O.rotate((w, x, y, z), v)


class Canonical(unittest.TestCase):
    def test_canonical_faces_the_eye(self):
        for name, p in O.PRESENT.items():
            loc, q = O.canonical_pose(name, EYE, FORWARD, UP)
            face = O.rotate(q, O.AXES[p["face"]])
            self.assertAlmostEqual(angle(face, sub(EYE, loc)), p["tilt_deg"], delta=0.5, msg=name)
            # tipped up: the face leans toward the camera's up, never down
            self.assertGreaterEqual(dot(face, UP), -1e-9, name)
            # and its up axis points the camera's way up
            self.assertAlmostEqual(dot(O.rotate(q, O.AXES[p["up"]]), UP), math.cos(math.radians(p["tilt_deg"])), places=6, msg=name)

    def test_distance(self):
        for name, p in O.PRESENT.items():
            loc, _ = O.canonical_pose(name, EYE, FORWARD, UP)
            self.assertAlmostEqual(norm(sub(loc, EYE)), p["d0"], places=9)
            self.assertAlmostEqual(angle(sub(loc, EYE), FORWARD), 0.0, places=4)  # acos is coarse near 0

    def test_presentation_numbers(self):
        self.assertEqual(
            O.PRESENT,
            {
                "kit": {"face": "+Z", "up": "+Y", "tilt_deg": 40, "d0": 0.42},
                "phone": {"face": "screen", "up": "long", "tilt_deg": 0, "d0": 0.30},
                "badge": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.22},
                "photo": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.36},
                "notepad": {"face": "+Z", "up": "+Y", "tilt_deg": 40, "d0": 0.42},
                "card": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.22},
                "car": {"face": "+Z", "up": "+Y", "tilt_deg": 70, "d0": 0.38},  # 20° above side-on
                "ball": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.40},
                "mug": {"face": "+Z", "up": "+Y", "tilt_deg": 35, "d0": 0.34},  # you look into the coffee
            },
        )

    def test_unit_quaternion(self):
        for name in O.PRESENT:
            _, q = O.canonical_pose(name, EYE, FORWARD, UP)
            self.assertAlmostEqual(norm(q), 1.0, places=9)

    def test_seat_axes_from_a_camera_matrix(self):
        # a camera at (1, 2, 3) turned 90° about X: it looks along +Y with +Z up
        m = [[1, 0, 0, 1], [0, 0, -1, 2], [0, 1, 0, 3], [0, 0, 0, 1]]
        eye, forward, up = O.seat_axes(m)
        self.assertEqual(eye, (1, 2, 3))
        for a, b in ((forward, (0, 1, 0)), (up, (0, 0, 1))):
            for x, y in zip(a, b):
                self.assertAlmostEqual(x, y, places=9)

    def test_three_axes_roundtrip(self):
        self.assertEqual(O.to_three((1.0, 2.0, 3.0)), (1.0, 3.0, -2.0))
        _, q = O.canonical_pose("kit", EYE, FORWARD, UP)
        for v in ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.3, -0.2, 0.9)):
            # rotate in Blender then convert == convert then rotate in three
            a = O.to_three(O.rotate(q, v))
            b = rotate_xyzw(O.quat_to_three(q), O.to_three(v))
            for x, y in zip(a, b):
                self.assertAlmostEqual(x, y, places=9)


if __name__ == "__main__":
    unittest.main()
