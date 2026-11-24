"""What the screens show at rest (no Blender):  python3 -I scripts/scene/test_screen_art.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import screen_art as A  # noqa: E402


def lines(frame):
    out = {}
    for x0, y0, x1, y1 in A.terminal_rows(frame):
        out.setdefault(round(y0, 6), []).append((round(x0, 6), round(x1, 6)))
    return [out[y] for y in sorted(out)], sorted(out)


class ScreenArt(unittest.TestCase):
    def test_terminal_rows_inside(self):
        u0, v0, u1, v1 = A.TERMINAL
        for k in range(4):
            for x0, y0, x1, y1 in A.terminal_rows(k):
                self.assertTrue(u0 <= x0 < x1 <= u1 and v0 <= y0 < y1 <= v1, (k, x0, y0, x1, y1))

    def test_each_frame_adds_a_row(self):
        first, ys = lines(0)
        for k in range(1, 4):
            rows, at = lines(k)
            self.assertEqual(len(rows), len(first) + k)
            self.assertEqual(rows[: len(first)], first, "the old rows keep what they say")
            self.assertLess(at[0], ys[0], "and move up")

    def test_dashboard_inside_the_image(self):
        blocks = A.dashboard_blocks()
        self.assertGreaterEqual(len(blocks), 20)
        for (x0, y0, x1, y1), colour in blocks:
            self.assertTrue(0 <= x0 < x1 <= 1 and 0 <= y0 < y1 <= 1, (x0, y0, x1, y1))
            self.assertRegex(colour, "^#[0-9A-Fa-f]{6}$")

    def test_screen_images_are_the_right_way_round(self):
        self.assertEqual(A.image_uv(0.3, 0.0), (0.3, 0.0), "the monitor's v runs down from its top")
        u0, u1, v0, v1 = A.LAPTOP_SCREEN
        for uv, page in (((u0, v1), (0, 1)), ((u0, v0), (1, 1)), ((u1, v0), (1, 0)), ((u1, v1), (0, 0))):
            for got, want in zip(A.laptop_page(*uv), page):
                self.assertAlmostEqual(got, want, places=9, msg=uv)


if __name__ == "__main__":
    unittest.main()
