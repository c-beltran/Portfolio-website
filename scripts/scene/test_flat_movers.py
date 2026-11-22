"""Pure geometry of the badge, photo, notepad and card (no Blender):  python3 -I scripts/scene/test_flat_movers.py"""

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flat_movers as F  # noqa: E402


class FlatMovers(unittest.TestCase):
    def test_angles_ease(self):
        self.assertEqual(sorted(F.CLIPS), ["badge_flip", "card_flip", "notepad_lift", "photo_tilt"])
        for name, (_, seconds, axis, a, b) in F.CLIPS.items():
            self.assertGreater(seconds, 0)
            self.assertIn(axis, "XYZ")
            self.assertAlmostEqual(F.angle(name, 0), a)
            self.assertAlmostEqual(F.angle(name, 1), b)
            seq = [F.angle(name, i / 50) for i in range(51)]
            sign = 1 if b > a else -1
            self.assertTrue(all(sign * (q - p) >= -1e-9 for p, q in zip(seq, seq[1:])), name)

    def test_faces_turn_to_the_eye(self):
        for mover, (part, corners) in F.FACES.items():
            clip = f"{mover}_flip"
            tl, tr, br, bl = (F.turn(p, F.CLIPS[clip][2], F.angle(clip, 1)) for p in corners)
            for p in (tr, br, bl):
                self.assertAlmostEqual(p[2], tl[2], places=9, msg=part)
            self.assertGreater(tl[2], 0, part)  # the back is on top once it has flipped
            self.assertGreater(tr[0], tl[0], part)
            self.assertAlmostEqual(tr[1], tl[1], places=9)
            self.assertLess(bl[1], tl[1], part)
            self.assertAlmostEqual(bl[0], tl[0], places=9)
            self.assertAlmostEqual(br[0], tr[0], places=9)
            self.assertAlmostEqual(br[1], bl[1], places=9)

    def test_page_lifts_clear(self):
        _, y, z = F.turn((0, -F.PAD[1], 0), "X", F.angle("notepad_lift", 1))
        self.assertGreater(z, 0, "above the block's top")
        self.assertGreater(y, 0, "behind the spiral edge")

    def test_photo_keeps_its_foot(self):
        w, h, d = F.PHOTO
        corners = [(x, y, z) for x in (-w / 2, w / 2) for y in (0, h) for z in (0, d)]
        for i in range(25):
            a = -12 + 12 * i / 24
            self.assertAlmostEqual(min(F.turn(c, "X", a)[1] for c in corners), 0, places=9, msg=a)

    def test_marks_inside_margin(self):
        marks = F.badge_front_marks()
        self.assertEqual(len(marks), 4)
        for mark in marks:
            x0, y0, x1, y1 = mark
            self.assertTrue(F.BADGE_MARGIN <= x0 < x1 <= 1 - F.BADGE_MARGIN, mark)
            self.assertTrue(F.BADGE_MARGIN <= y0 < y1 <= 1 - F.BADGE_MARGIN, mark)
        strokes = F.sketch_strokes()
        self.assertGreaterEqual(len(strokes), 8)
        self.assertEqual(strokes, F.sketch_strokes(), "the same drawing every build")
        for line in strokes:
            self.assertGreaterEqual(len(line), 2)
            for x, y in line:
                self.assertTrue(F.SKETCH_MARGIN <= x <= 1 - F.SKETCH_MARGIN, (x, y))
                self.assertTrue(F.SKETCH_MARGIN <= y <= 1 - F.SKETCH_MARGIN, (x, y))

    def test_lanyard_is_a_flat_strap(self):
        path = F.lanyard_path()
        verts, faces = F.ribbon(path, *F.STRAP)
        self.assertEqual(len(verts), 4 * len(path))
        for i, p in enumerate(path):
            a, b, c, d = verts[4 * i : 4 * i + 4]
            self.assertAlmostEqual(math.dist(a, b), F.STRAP[0], places=9)
            self.assertAlmostEqual(math.dist(a, d), F.STRAP[1], places=9)
            self.assertAlmostEqual(a[2], p[2], places=9, msg="it lies on what is under it")
        self.assertTrue(all(0 <= i < len(verts) for f in faces for i in f))
        x0, y0, x1, y1 = F.MAT
        for x, y, z in verts:
            self.assertTrue(x0 <= x <= x1 and y0 <= y <= y1, ("off the mat", x, y))


if __name__ == "__main__":
    unittest.main()
