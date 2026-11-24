"""Pure bake logic (no Blender):  python3 -I scripts/scene/test_bake.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bake_logic import GROUPS, backdrop_covers, group_for, lift_for  # noqa: E402


class GroupFor(unittest.TestCase):
    def test_room(self):
        self.assertEqual(group_for("room_wall", "room_wall", False), "room")
        self.assertEqual(group_for("window_mullion_1", "window_frame", False), "room")

    def test_desk(self):
        self.assertEqual(group_for("deco_desk_top", "deco_desk", False), "desk")
        self.assertEqual(group_for("deco_mat", "deco_mat", False), "desk")

    def test_monitor_and_its_screen(self):
        self.assertEqual(group_for("Object_5", "obj_monitor", True), "screen")
        self.assertEqual(group_for("Object_4", "obj_monitor", False), "monitor")
        self.assertEqual(group_for("obj_lightbar", "obj_lightbar", False), "monitor")

    def test_no_glass_or_water_groups(self):
        # the water glass goes, so the portrait behind it shows
        self.assertNotIn("glass", GROUPS)
        self.assertNotIn("water", GROUPS)
        self.assertEqual(group_for("deco_mug", "deco_mug", False), "props")

    def test_props(self):
        self.assertEqual(group_for("deco_mug", "deco_mug", False), "props")
        self.assertEqual(group_for("deco_cable_mouse", "deco_cable_mouse", False), "props")

    def test_movers_bake_on_their_own(self):
        # the kit and the phone come forward, so each gets its own atlas
        self.assertIn("kit", GROUPS)
        self.assertIn("phone", GROUPS)
        self.assertEqual(group_for("kit_base", "obj_kit", False), "kit")
        self.assertEqual(group_for("kit_lid", "obj_kit", False), "kit")
        self.assertEqual(group_for("Object_20", "obj_phone", False), "phone")

    def test_each_new_mover_has_its_group(self):
        for mover in ("badge", "photo", "notepad", "card", "car", "ball", "mug"):
            self.assertIn(mover, GROUPS)
            self.assertEqual(group_for(f"{mover}_part", f"obj_{mover}", False), mover)

    def test_the_diploma_has_its_own_group(self):
        self.assertIn("diploma", GROUPS)
        self.assertEqual(group_for("diploma_paper", "obj_diploma", False), "diploma")
        self.assertEqual(group_for("diploma_seal", "obj_diploma", False), "diploma")

    def test_the_board_has_its_own_group(self):
        self.assertIn("board", GROUPS)
        self.assertEqual(group_for("magnet_egypt_face", "obj_board", False), "board")

    def test_what_stays_on_the_desk_stays_with_the_props(self):
        for name in ("deco_lanyard", "deco_lanyard_ring", "deco_coaster_mug"):
            self.assertEqual(group_for(name, name, False), "props")

    def test_the_clip_quad_is_never_baked(self):
        self.assertIsNone(group_for("phone_screen", "obj_phone", False))


class BackdropCovers(unittest.TestCase):
    WINDOW = [(0.2, 0.1), (0.8, 0.1), (0.8, 0.6), (0.2, 0.6)]

    def test_narrower_plane_does_not_cover(self):
        self.assertFalse(backdrop_covers(self.WINDOW, [(0.3, 0.0), (0.7, 0.0), (0.7, 0.7), (0.3, 0.7)]))

    def test_containing_plane_covers(self):
        self.assertTrue(backdrop_covers(self.WINDOW, [(0.1, 0.0), (0.9, 0.0), (0.9, 0.7), (0.1, 0.7)]))

    def test_window_off_frame_is_clipped_to_the_frame(self):
        # Only what the camera sees must be covered: the window runs past the frame's top.
        window = [(0.2, 0.5), (0.8, 0.5), (0.8, 1.4), (0.2, 1.4)]
        self.assertTrue(backdrop_covers(window, [(0.1, 0.4), (0.9, 0.4), (0.9, 1.05), (0.1, 1.05)]))


class LiftFor(unittest.TestCase):
    def test_the_badge_rests_on_the_mat_unlifted(self):
        self.assertEqual(lift_for("obj_badge"), 0.0)

    def test_leaves_everything_else(self):
        self.assertEqual(lift_for("obj_card"), 0.0)


if __name__ == "__main__":
    unittest.main()
