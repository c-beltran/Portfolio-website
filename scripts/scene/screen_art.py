"""
What the screens show at rest, and which way up each model takes its image: the monitor's terminal
pane and the laptop's dashboard, as flat rects with nothing to read. Rects are fractions of the
image, u to the right and v down. No bpy, so it is unit-tested by test_screen_art.py.
"""

import random

# The terminal pane: the left half's lower 30%, right of the file tree.
TERMINAL = (0.115, 0.68, 0.49, 0.965)
ROWS, PITCH, BAR = 8, 0.0205, 0.011
PROMPT_W = 0.006  # a row that opens with a bar this narrow is a prompt


def image_uv(u, v_down):
    """The monitor model's UV for a point of its image: the model's v runs down from the top."""
    return (u, v_down)


# The laptop's glass in its atlas (u0, u1, v0, v1), which lays it on its side: u runs down the
# screen from its top, and v from its right to its left.
LAPTOP_SCREEN = (0.477, 0.664, 0.628, 0.927)
LAPTOP_ACROSS = (LAPTOP_SCREEN[3], LAPTOP_SCREEN[2])  # v at the page's left, at its right
LAPTOP_UP = (LAPTOP_SCREEN[1], LAPTOP_SCREEN[0])  # u at the page's bottom, at its top


def laptop_page(u, v):
    """The point of the page (x right, y up) shown at an atlas point."""
    (left, right), (bottom, top) = LAPTOP_ACROSS, LAPTOP_UP
    return ((v - left) / (right - left), (u - bottom) / (top - bottom))


def _row(i):
    rng = random.Random(100 + i)
    if i % 4 == 3:
        return [(0.0, PROMPT_W), (0.011, 0.011 + rng.uniform(0.04, 0.12))]
    out, x = [], 0.0 if i % 4 == 0 else 0.012
    for _ in range(rng.randint(1, 3)):
        w = rng.uniform(0.025, 0.085)
        out.append((x, x + w))
        x += w + 0.008
    return out


def terminal_rows(frame: int):
    """Prompt and output bars: frame k has k more rows than frame 0, the older ones scrolled up."""
    u0, _, _, v1 = TERMINAL
    n, last = ROWS + frame, v1 - 0.015 - BAR
    rects = []
    for i in range(n):
        y = last - (n - 1 - i) * PITCH
        rects += [(u0 + 0.012 + a, y, u0 + 0.012 + b, y + BAR) for a, b in _row(i)]
    return rects


def dashboard_blocks():
    """A generic dashboard in neutral greys and one accent, in the order it's painted."""
    ink, panel, line, soft, accent = "#23262B", "#FFFFFF", "#C9CDD3", "#8B929B", "#3BA99C"
    out = [((0, 0, 0.17, 1), ink), ((0.17, 0, 1, 0.09), panel), ((0.03, 0.04, 0.12, 0.065), accent)]
    out += [((0.03, y, 0.03 + w, y + 0.02), soft) for y, w in ((0.16, 0.10), (0.23, 0.08), (0.30, 0.11), (0.37, 0.07), (0.44, 0.09))]
    out += [((0.20, 0.035, 0.36, 0.06), line), ((0.92, 0.025, 0.955, 0.07), accent)]
    for i in range(4):
        x = 0.20 + i * 0.195
        out += [((x, 0.13, x + 0.175, 0.28), panel), ((x + 0.015, 0.16, x + 0.09, 0.178), line)]
        out += [((x + 0.015, 0.205, x + 0.11, 0.245), accent if i == 0 else soft)]
    out.append(((0.20, 0.32, 0.96, 0.64), panel))
    ys = (0.57, 0.55, 0.56, 0.51, 0.53, 0.48, 0.46, 0.48, 0.43, 0.44, 0.40, 0.38)
    for i, (a, b) in enumerate(zip(ys, ys[1:])):
        x = 0.23 + i * 0.062
        out += [((x + k * 0.0062, a + (b - a) * k / 10, x + (k + 1) * 0.0062, a + (b - a) * k / 10 + 0.012), accent) for k in range(10)]
    out.append(((0.20, 0.68, 0.96, 0.96), panel))
    rng = random.Random(3)
    for r in range(5):
        y = 0.71 + r * 0.05
        out += [((x, y, x + rng.uniform(0.06, 0.15), y + 0.018), soft if r == 0 else line) for x in (0.23, 0.43, 0.63, 0.80)]
    return out
