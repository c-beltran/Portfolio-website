"""The car's, ball's and mug's clips (no Blender):  python3 -I scripts/scene/test_room_movers.py"""

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flat_movers as F  # noqa: E402
import room as R  # noqa: E402
import room_movers as RV  # noqa: E402


class RoomMovers(unittest.TestCase):
    def test_angles_ease(self):
        self.assertEqual(sorted(RV.CLIPS), ["ball_roll", "car_turn", "mug_tip"])
        for name, (_, seconds, _, a, b) in RV.CLIPS.items():
            self.assertGreater(seconds, 0)
            self.assertAlmostEqual(RV.angle(name, 0), a)
            self.assertAlmostEqual(RV.angle(name, 1), b)

    def test_car_ends_in_profile(self):
        h = math.radians(R.CAR["heading_deg"])
        x, y, z = F.turn((-math.sin(h), -math.cos(h), 0), "Z", RV.angle("car_turn", 1))
        self.assertAlmostEqual(x, -1, places=9, msg="the nose points left, towards the panel")
        self.assertAlmostEqual(y, 0, places=9)

    def test_ball_rolls_half_a_turn_forward(self):
        self.assertAlmostEqual(F.turn((0, 0, 1), "X", RV.angle("ball_roll", 0.5))[1], -1, places=9)
        self.assertAlmostEqual(F.turn((0, 0, 1), "X", RV.angle("ball_roll", 1))[2], -1, places=9)

    def test_mug_handle_ends_on_the_right(self):
        a = math.radians(RV.MUG_HANDLE_DEG)
        x, y, _ = F.turn((math.cos(a), math.sin(a), 0), "Z", RV.angle("mug_tip", 1))
        self.assertAlmostEqual(x, 1, places=9)
        self.assertAlmostEqual(y, 0, places=9)


if __name__ == "__main__":
    unittest.main()
