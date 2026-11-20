"""Pure geometry of the two movers (no Blender):  python3 -I scripts/scene/test_movers.py"""

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import movers as MV  # noqa: E402


def rot_x(p, rad):
    """A point (x, y, z) turned about the X axis through the origin (right-handed)."""
    x, y, z = p
    return (x, y * math.cos(rad) - z * math.sin(rad), y * math.sin(rad) + z * math.cos(rad))


def corners(box):
    """The four footprint corners of a content box, in the case frame."""
    (cx, cy, _), (sx, sy, _), a = box["centre"], box["size"], math.radians(box["rot_z_deg"])
    out = []
    for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        x, y = dx * sx / 2, dy * sy / 2
        out.append((cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)))
    return out


class Case(unittest.TestCase):
    def setUp(self):
        self.base, self.base_z, self.lid, self.lid_z, self.hinge = MV.split_case(MV.KIT_SIZE, MV.LID_H)

    def test_split_keeps_the_case_height(self):
        self.assertAlmostEqual(self.base[2] + self.lid[2], 0.085, places=9)
        self.assertAlmostEqual(self.lid[2], 0.030, places=9)
        self.assertEqual(self.base[:2], MV.KIT_SIZE[:2])
        # the halves stack: base bottom on the case bottom, lid top on the case top
        self.assertAlmostEqual(self.base_z - self.base[2] / 2, -0.0425, places=9)
        self.assertAlmostEqual(self.lid_z + self.lid[2] / 2, 0.0425, places=9)

    def test_hinge_on_the_back_top_edge(self):
        _, y, z = self.hinge
        self.assertAlmostEqual(y, MV.KIT_SIZE[1] / 2, places=9)
        self.assertAlmostEqual(z, self.base_z + self.base[2] / 2, places=9)

    def test_lid_opens_up_and_back(self):
        hx, hy, hz = self.hinge
        front = (0.0, -MV.KIT_SIZE[1] / 2, self.lid_z)  # the lid's front edge, mid-height
        rel = (front[0] - hx, front[1] - hy, front[2] - hz)
        x, y, z = rot_x(rel, MV.lid_rotation_x(1.0))
        self.assertGreater(z + hz, hz + 0.1, "the front edge rises well above the base top")
        self.assertGreater(y + hy, hy, "and ends up behind the hinge")

    def test_lid_angle_eases(self):
        self.assertEqual(MV.lid_angle(0.0), 0.0)
        self.assertAlmostEqual(MV.lid_angle(1.0), 105.0, places=9)
        self.assertEqual(MV.LID_OPEN_DEG, 105)
        steps = [MV.lid_angle(i / 48) for i in range(49)]
        self.assertTrue(all(b > a for a, b in zip(steps, steps[1:])), "monotonic")
        # eased in and out: the first and last steps are the smallest
        d = [b - a for a, b in zip(steps, steps[1:])]
        self.assertLess(d[0], d[24])
        self.assertLess(d[-1], d[24])
        self.assertEqual(MV.lid_angle(-1), 0.0)
        self.assertAlmostEqual(MV.lid_angle(2), 105.0, places=9)

    def test_clip_lengths(self):
        self.assertEqual((MV.KIT_OPEN_S, MV.PHONE_TURN_S, MV.FPS), (0.8, 0.5, 60))
        self.assertEqual(MV.frames(MV.KIT_OPEN_S), 48)
        self.assertEqual(MV.frames(MV.PHONE_TURN_S), 30)
        self.assertAlmostEqual(MV.turn_angle(1.0), 90.0, places=9)

    def test_contents_fit_under_the_lid(self):
        top = self.hinge[2]
        half_w = MV.KIT_SIZE[0] / 2 - MV.WALL
        half_d = MV.KIT_SIZE[1] / 2 - MV.WALL
        layout = MV.kit_layout()
        self.assertEqual(
            {"gauge", "gauge_face", "needle", "screwdriver", "shaft", "certificate"},
            set(layout["contents"]),
        )
        for name, box in layout["contents"].items():
            self.assertLessEqual(box["centre"][2] + box["size"][2] / 2, top - 0.001, name)
            for x, y in corners(box):
                self.assertLessEqual(abs(x), half_w, f"{name} x")
                self.assertLessEqual(abs(y), half_d, f"{name} y")
        foam = layout["foam"]
        self.assertAlmostEqual(foam["centre"][2] + foam["size"][2] / 2, top - 0.003, places=9)

    def test_contents_do_not_overlap(self):
        c = MV.kit_layout()["contents"]

        def rect(b):
            xs, ys = zip(*corners(b))
            return min(xs), min(ys), max(xs), max(ys)

        # the three items' footprints (the screwdriver's handle stands for the whole tool)
        g, s, cert = rect(c["gauge"]), rect(c["screwdriver"]), rect(c["certificate"])
        for a, b in ((g, cert), (g, s)):
            self.assertTrue(a[2] <= b[0] or b[2] <= a[0] or a[3] <= b[1] or b[3] <= a[1])


class Marks(unittest.TestCase):
    def test_dial_has_ticks_only(self):
        ticks = MV.dial_ticks()
        self.assertEqual(len(ticks), 40)
        for (x0, y0), (x1, y1) in ticks:
            for x, y in ((x0, y0), (x1, y1)):
                self.assertLessEqual(math.hypot(x, y), 1.0 + 1e-9)
            self.assertGreater(math.hypot(x0, y0), 0.6, "ticks sit at the rim, no numerals inside")

    def test_certificate_marks_inside_margin(self):
        marks = MV.certificate_marks()
        self.assertGreater(len(marks), 8)
        self.assertEqual(marks, MV.certificate_marks(seed=7), "deterministic")
        kinds = {m["kind"] for m in marks}
        self.assertLessEqual(kinds, {"rect", "ring"}, "no glyph paths by construction")
        self.assertIn("ring", kinds)
        lo, hi = 0.06, 0.94
        for m in marks:
            if m["kind"] == "rect":
                xs, ys = (m["x0"], m["x1"]), (m["y0"], m["y1"])
            else:
                xs = (m["cx"] - m["r1"], m["cx"] + m["r1"])
                ys = (m["cy"] - m["r1"], m["cy"] + m["r1"])
            for v in (*xs, *ys):
                self.assertGreaterEqual(v, lo - 1e-9, m)
                self.assertLessEqual(v, hi + 1e-9, m)


if __name__ == "__main__":
    unittest.main()
