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


def seg_dist(p, a, b):
    """The distance from point p to segment ab, in the plane (z ignored)."""
    (px, py), (ax, ay), (bx, by) = p[:2], a[:2], b[:2]
    dx, dy = bx - ax, by - ay
    t = 0.0 if dx == dy == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)


def footprint_dist(p, box):
    """How far point p (x, y) lies outside a content's footprint (0 inside): a circle for round
    upright parts, else its turned rectangle."""
    (cx, cy, _), (sx, sy, _) = box["centre"], box["size"]
    if box["kind"] in ("ring", "upright", "hex"):
        return max(0.0, math.hypot(p[0] - cx, p[1] - cy) - box["r"])
    a = math.radians(box["rot_z_deg"])
    lx = (p[0] - cx) * math.cos(a) + (p[1] - cy) * math.sin(a)
    ly = -(p[0] - cx) * math.sin(a) + (p[1] - cy) * math.cos(a)
    return math.hypot(max(0.0, abs(lx) - sx / 2), max(0.0, abs(ly) - sy / 2))


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
        self.assertAlmostEqual(layout["item_top"], top - MV.ITEM_CLEAR, places=9)
        for name, box in layout["contents"].items():
            self.assertLessEqual(box["centre"][2] + box["size"][2] / 2, layout["item_top"] + 1e-9, name)
            for x, y in corners(box):
                self.assertLessEqual(abs(x), half_w, f"{name} x")
                self.assertLessEqual(abs(y), half_d, f"{name} y")
        for colour, hose in layout["hoses"].items():
            for x, y, z in hose["path"]:
                self.assertLessEqual(abs(x) + hose["r"], half_w, f"{colour} hose x")
                self.assertLessEqual(abs(y) + hose["r"], half_d, f"{colour} hose y")
                self.assertLessEqual(z + hose["r"], layout["item_top"] + 1e-9, f"{colour} hose z")
        foam = layout["foam"]
        self.assertAlmostEqual(foam["centre"][2] + foam["size"][2] / 2, top - MV.FOAM_DROP, places=9)

    def test_contents_are_carloss_kit(self):
        # Carlos, 2026-11-21: "closer to my real kit": the gauge with its hoses, the fittings and
        # the screwdriver (his photos); the generic certificate is dropped.
        c = MV.kit_layout()["contents"]
        for name in ("gauge", "gauge_face", "needle", "minigauge", "minigauge_face", "manifold",
                     "screwdriver", "screwdriver_collar", "screwdriver_shaft", "screwdriver_tip"):
            self.assertIn(name, c)
        self.assertEqual(sum(1 for n in c if n.startswith("brass_fitting_")), 4)
        self.assertNotIn("certificate", c)
        self.assertFalse(hasattr(MV, "certificate_marks"))

    def test_knobs_read_red_blue_yellow(self):
        layout = MV.kit_layout()
        c = layout["contents"]
        self.assertEqual(tuple(layout["hoses"]), MV.HOSES)
        xs = [c[f"knob_{k}"]["centre"][0] for k in ("red", "blue", "yellow")]
        self.assertEqual(xs, sorted(xs), "left to right on the manifold, as on his gauge")
        for k in MV.HOSES:  # each hose starts at its own knob
            hx, hy, _ = layout["hoses"][k]["path"][0]
            kx = c[f"knob_{k}"]["centre"][0]
            self.assertAlmostEqual(hx, kx, places=6, msg=k)
            self.assertLess(hy, c[f"knob_{k}"]["centre"][1], k)

    def test_hoses_never_cross(self):
        hoses = MV.kit_layout()["hoses"]
        names = list(hoses)
        for i, a in enumerate(names):
            pa = hoses[a]["path"]
            for p, q in zip(pa, pa[1:]):
                self.assertLessEqual(math.dist(p, q), 0.004, f"{a}: sampled every few mm")
            for b in names[i + 1 :]:
                pb = hoses[b]["path"]
                gap = min(seg_dist(p, s0, s1) for p in pa for s0, s1 in zip(pb, pb[1:]))
                self.assertGreaterEqual(gap, hoses[a]["r"] + hoses[b]["r"] - 1e-6, f"{a} and {b}")

    def test_hoses_run_clear_of_the_other_contents(self):
        layout = MV.kit_layout()
        c = layout["contents"]
        for colour, hose in layout["hoses"].items():
            r = hose["r"]
            for name, box in c.items():
                if name.endswith(colour) or box["kind"] == "disc" or name == "needle":
                    continue  # its own knob, nipple and end; the faces lie inside their gauges
                for x, y, _ in hose["path"]:
                    self.assertGreaterEqual(footprint_dist((x, y), box), r - 1e-6, f"{colour} hose over {name}")


class Lid(unittest.TestCase):
    def test_egg_crate_clears_the_contents(self):
        """The lid's egg-crate foam (as in his case): its bumps, below the lid's underside, stop
        short of the tallest content when the lid shuts."""
        layout = MV.kit_layout()
        pad = layout["pad"]
        verts, faces = MV.egg_crate(pad["size"][0], pad["size"][1])
        zs = [v[2] for v in verts]
        self.assertLessEqual(max(zs), 0.0)
        self.assertGreaterEqual(min(zs), -(MV.ITEM_CLEAR - 0.0005))
        self.assertLess(min(zs), -0.003, "deep enough to read as egg-crate")
        xs, ys = [v[0] for v in verts], [v[1] for v in verts]
        self.assertAlmostEqual(max(xs) - min(xs), pad["size"][0], places=9)
        self.assertAlmostEqual(max(ys) - min(ys), pad["size"][1], places=9)
        self.assertTrue(all(len(f) == 4 and max(f) < len(verts) for f in faces))

    def test_egg_crate_faces_out_of_the_lid(self):
        """Its faces point down, out of the lid's underside (towards the viewer once it opens): the
        bake and the live scene light a face from the side it points to."""
        verts, faces = MV.egg_crate(0.1, 0.06)
        for f in faces[:: max(1, len(faces) // 50)]:
            (ax, ay, _), (bx, by, _), (cx, cy, _) = (verts[i] for i in f[:3])
            self.assertLess((bx - ax) * (cy - ay) - (by - ay) * (cx - ax), 0, "normal down (-z)")


class Marks(unittest.TestCase):
    def test_dial_has_ticks_only(self):
        """His gauge's scale: an arc of ticks across the top of the face, above the needle's low
        pivot. Ticks only: no numerals, no brand."""
        ticks = MV.dial_ticks()
        self.assertEqual(len(ticks), 31)
        px, py = MV.DIAL_PIVOT
        for (x0, y0), (x1, y1) in ticks:
            for x, y in ((x0, y0), (x1, y1)):
                self.assertLessEqual(math.hypot(x, y), 0.93 + 1e-9, "inside the face")
                self.assertGreater(y, 0.2, "across the top of the face")
            self.assertGreater(math.hypot(x0 - px, y0 - py), 0.95, "far from the pivot: nothing inside the arc")

    def test_small_dial_has_ticks_only(self):
        ticks = MV.small_dial_ticks()
        self.assertEqual(len(ticks), 40)
        for (x0, y0), (x1, y1) in ticks:
            for x, y in ((x0, y0), (x1, y1)):
                self.assertLessEqual(math.hypot(x, y), 1.0 + 1e-9)
            self.assertGreater(math.hypot(x0, y0), 0.6, "ticks sit at the rim, no numerals inside")


if __name__ == "__main__":
    unittest.main()
