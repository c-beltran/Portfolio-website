"""The room's geometry (no Blender):  python3 -I scripts/scene/test_room.py"""

import math
import sys
import unittest
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import room as R  # noqa: E402

LEFT_WALL_X = -2.3  # build_room's room_wall_left


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def regions(tris, keep):
    """Edge-connected groups of the triangles keep() picks."""
    by_edge = defaultdict(list)
    for i, t in enumerate(tris):
        if keep(i):
            for k in range(3):
                by_edge[frozenset((t[k], t[(k + 1) % 3]))].append(i)
    seen, count = set(), 0
    for i in range(len(tris)):
        if not keep(i) or i in seen:
            continue
        count += 1
        stack = [i]
        while stack:
            j = stack.pop()
            if j in seen:
                continue
            seen.add(j)
            t = tris[j]
            for k in range(3):
                stack += [n for n in by_edge[frozenset((t[k], t[(k + 1) % 3]))] if n not in seen]
    return count


class Ball(unittest.TestCase):
    def setUp(self):
        self.r = R.BALL["r"]
        self.verts, self.tris, self.black, self.face = R.soccer_ball(self.r)

    def test_ball_is_a_closed_sphere(self):
        for v in self.verts:
            self.assertAlmostEqual(math.sqrt(sum(c * c for c in v)), self.r, delta=1e-9)
        edges = defaultdict(int)
        for t in self.tris:
            for k in range(3):
                edges[frozenset((t[k], t[(k + 1) % 3]))] += 1
        self.assertTrue(all(n == 2 for n in edges.values()), "every edge in two triangles")
        self.assertEqual(len(self.tris), 2880)

    def test_ball_faces_outward(self):
        for t in self.tris:
            a, b, c = (self.verts[i] for i in t)
            n = cross(sub(b, a), sub(c, a))
            centroid = tuple((a[k] + b[k] + c[k]) / 3 for k in range(3))
            self.assertGreater(sum(n[k] * centroid[k] for k in range(3)), 0)

    def test_twelve_black_pentagons_twenty_white_hexagons(self):
        black_faces = {self.face[i] for i in range(len(self.tris)) if self.black[i]}
        white_faces = {self.face[i] for i in range(len(self.tris)) if not self.black[i]}
        self.assertEqual((len(black_faces), len(white_faces)), (12, 20))
        self.assertEqual(regions(self.tris, lambda i: self.black[i]), 12, "pentagons never touch")
        per_face = defaultdict(int)
        for i in range(len(self.tris)):
            per_face[self.face[i]] += 1
        for f in black_faces:
            self.assertEqual(per_face[f], 5 * 16, "a pentagon: five fan triangles, each in 16")
        for f in white_faces:
            self.assertEqual(per_face[f], 6 * 16, "a hexagon: six fan triangles, each in 16")

    def test_ball_rests_on_the_floor_by_the_wall(self):
        x, _, z = R.BALL["at"]
        self.assertAlmostEqual(z, self.r, places=9)
        self.assertGreaterEqual(x, LEFT_WALL_X + self.r + 0.05)


class Board(unittest.TestCase):
    def test_eight_magnets_in_carloss_order(self):
        self.assertEqual(R.PLACES, ("egypt", "italy", "colombia", "guatemala", "canada", "mexico", "puerto_rico", "aruba"))
        self.assertEqual([m["place"] for m in R.board_layout()][:8], list(R.PLACES))

    def test_home_in_the_middle(self):
        # El Salvador, in the gap at the board's centre
        self.assertEqual(R.HOME, "el_salvador")
        self.assertEqual(R.BOARD_PLACES, R.PLACES + (R.HOME,))
        home = R.board_layout()[-1]
        self.assertEqual(home["place"], R.HOME)
        (cx, _, cz) = R.BOARD["centre"]
        self.assertLessEqual(math.dist(home["centre"], (cx, cz)), 0.008)

    def test_magnets_fit_the_board(self):
        (cx, _, cz), (w, h) = R.BOARD["centre"], R.BOARD["size"]
        inner_x, inner_z = w / 2 - R.BOARD["frame"], h / 2 - R.BOARD["frame"]
        layout = R.board_layout()
        for m in layout:
            x, z = m["centre"]
            r = m["r"]
            self.assertLessEqual(abs(x - cx) + r, inner_x - 0.005, m["place"])
            self.assertLessEqual(abs(z - cz) + r, inner_z - 0.005, m["place"])
        for i, a in enumerate(layout):
            for b in layout[i + 1 :]:
                self.assertGreaterEqual(math.dist(a["centre"], b["centre"]), a["r"] + b["r"] + 0.008, (a["place"], b["place"]))

    def test_home_is_slightly_bigger(self):
        *others, home = R.board_layout()
        self.assertEqual({m["r"] for m in others}, {R.MAGNET["r"]})
        self.assertGreaterEqual(home["r"] / R.MAGNET["r"], 1.15)
        self.assertLessEqual(home["r"] / R.MAGNET["r"], 1.25)

    def test_home_is_el_salvador_not_nicaragua(self):
        # What tells the two flags apart: the laurel wreath round the sides and foot of the
        # triangle, and five flags fanned out behind it.
        green = R.LAUREL
        for deg in (180 + 25, 270, 360 - 25):
            t = math.radians(deg)
            self.assertEqual(R.colour_at(R.HOME, 0.405 * math.cos(t), 0.405 * math.sin(t)), green, deg)
        self.assertEqual(len(R.HOME_FLAGS), 5)
        for deg, start in R.HOME_FLAGS:
            (bx, by), (wx, wy) = R.flag_points(deg, start)
            self.assertEqual(R.colour_at(R.HOME, bx, by), R.FLAG_BLUE, deg)
            self.assertEqual(R.colour_at(R.HOME, wx, wy), "#FFFFFF", deg)

    def test_icons_are_shapes_only(self):
        for place in R.BOARD_PLACES:
            icon = R.ICONS[place]
            # home carries a coat of arms (a wreath, five flags, the triangle), the rest six shapes
            self.assertLessEqual(len(icon["layers"]), 24 if place == R.HOME else 6, place)
            for _, shape in icon["layers"]:
                kind = shape[0]
                self.assertIn(kind, ("circle", "ellipse", "rect", "poly"), place)
                if kind == "circle":
                    _, x, y, r = shape
                    reach = math.hypot(x, y) + r
                elif kind == "ellipse":  # its farthest point, measured on its outline
                    _, x, y, rx, ry = shape
                    reach = max(math.hypot(x + rx * math.cos(t), y + ry * math.sin(t)) for t in (k * math.pi / 180 for k in range(360)))
                elif kind == "rect":
                    _, x0, y0, x1, y1 = shape
                    reach = max(math.hypot(x, y) for x in (x0, x1) for y in (y0, y1))
                else:
                    reach = max(math.hypot(x, y) for x, y in shape[1])
                self.assertLessEqual(reach, 0.95 + 1e-9, (place, kind))

    def test_icons_cover_and_differ(self):
        n = 48
        grid = [((i + 0.5) / n * 2 - 1, (j + 0.5) / n * 2 - 1) for j in range(n) for i in range(n)]
        inside = [(x, y) for x, y in grid if x * x + y * y <= 1]
        maps = {}
        for place in R.BOARD_PLACES:
            cols = [R.colour_at(place, x, y) for x, y in inside]
            covered = sum(1 for c in cols if c != R.ICONS[place]["bg"]) / len(cols)
            self.assertGreaterEqual(covered, 0.15, place)
            self.assertLessEqual(covered, 0.70, place)
            maps[place] = cols
        self.assertIsNone(R.colour_at("egypt", 0.99, 0.99), "outside the disc")
        places = list(R.BOARD_PLACES)
        for i, a in enumerate(places):
            for b in places[i + 1 :]:
                diff = sum(1 for p, q in zip(maps[a], maps[b]) if p != q) / len(inside)
                self.assertGreaterEqual(diff, 0.20, (a, b))


if __name__ == "__main__":
    unittest.main()
