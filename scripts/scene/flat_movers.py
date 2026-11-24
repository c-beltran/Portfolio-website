"""
Pure geometry for the flat things that come forward: the badge (it flips), the photo (it tilts up
straight), the notepad (its top page lifts) and the card (it flips), plus the badge's lanyard. No
bpy, so it is unit-tested by test_flat_movers.py.

Each pivot's frame has +Z out of the face you see when the object is out and +Y toward its top.
Metres and degrees.
"""

import math
import random

import movers as MV

BADGE = (0.054, 0.086, 0.003)  # width, length, thickness
BADGE_CLIP = (0.012, 0.014, 0.0026)
PHOTO = (0.13, 0.18, 0.018)  # width, height, depth
PRINT = (0.105, 0.15)
PAD = (0.148, 0.21, 0.008)  # A5, the top page included
PAGE_T = 0.0003
SKETCH = (0.138, 0.2)
PEN = (0.0045, 0.14)  # radius, length
PEN_AT = (PAD[0] / 2 + PEN[0] + 0.002, -0.01, 0.0035)  # along the right edge, on the mat
CARD = (0.085, 0.055, 0.0006)
LEAN_DEG = -12.0  # how far the photo leans back at rest

# Each pivot at rest: its location and XYZ rotation. The desk's top is 0.75, the mat's 0.753.
REST = {
    "badge": ((-0.34, 0.06, 0.753 + BADGE[2] / 2), (0.0, 0.0, 25.0)),
    "photo": ((0.5, 0.48, 0.84), (90.0, 0.0, -18.0)),
    "notepad": ((-0.5, -0.1, 0.75 + PAD[2] / 2), (0.0, 0.0, 8.0)),
    "card": ((0.28, -0.22, 0.753 + CARD[2] / 2), (0.0, 0.0, -12.0)),
}

# clip: (the part that carries it, seconds, its local axis, from, to)
CLIPS = {
    "badge_flip": ("badge_flip", 0.6, "Y", 0.0, 180.0),
    "photo_tilt": ("photo_tilt", 0.4, "X", LEAN_DEG, 0.0),
    "notepad_lift": ("notepad_page", 0.7, "X", 0.0, -165.0),  # negative: the front edge up and back
    "card_flip": ("card_flip", 0.6, "Y", 0.0, 180.0),
}


def eased(clips, clip, t):
    """Degrees at clip time t (0-1)."""
    _, _, _, a, b = clips[clip]
    return a + (b - a) * MV.ease(t)


def angle(clip: str, t: float) -> float:
    return eased(CLIPS, clip, t)


def turn(p, axis, deg):
    """p turned about a local axis through the origin (right-handed)."""
    x, y, z = p
    c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
    if axis == "X":
        return (x, y * c - z * s, y * s + z * c)
    if axis == "Y":
        return (x * c + z * s, y, -x * s + z * c)
    return (x * c - y * s, x * s + y * c, z)


def _back(w, h, d):
    """The back's corners in the part's frame, in the order they're seen after a flip about Y:
    top-left, top-right, bottom-right, bottom-left."""
    x, y, z = w / 2, h / 2, -d / 2
    return ((x, y, z), (-x, y, z), (-x, -y, z), (x, -y, z))


FACES = {"badge": ("badge_card", _back(*BADGE)), "card": ("card_body", _back(*CARD))}

# The photo tips on the back edge of its foot, which is the edge it rests on while it leans.
PHOTO_HINGE = turn((0.0, -PHOTO[1] / 2, -PHOTO[2] / 2), "X", LEAN_DEG)

BADGE_MARGIN = 0.08
BADGE_INKS = ("#A9B0B8", "#3A3C40", "#8A8D92", "#23314F")


def badge_front_marks():
    """A photo block, two bars and a stripe (unit page, y down): nothing to read."""
    return [(0.24, 0.12, 0.76, 0.50), (0.16, 0.58, 0.84, 0.635), (0.24, 0.68, 0.76, 0.72), (0.08, 0.81, 0.92, 0.90)]


SKETCH_MARGIN = 0.06


def sketch_strokes(seed=11):
    """A rough drawing of the desk (unit page, x right, y down), as polylines only."""
    rng = random.Random(seed)

    def rough(*pts, steps=5, wobble=0.0035):
        out = []
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            for i in range(steps):
                t = i / steps
                out.append((ax + (bx - ax) * t + rng.uniform(-wobble, wobble), ay + (by - ay) * t + rng.uniform(-wobble, wobble)))
        out.append(pts[-1])
        return out

    def oval(cx, cy, rx, ry, a=0, b=360, n=18):
        return rough(*[(cx + rx * math.cos(math.radians(d)), cy + ry * math.sin(math.radians(d))) for d in (a + (b - a) * i / n for i in range(n + 1))], steps=1)

    lines = [
        rough((0.09, 0.80), (0.22, 0.45), (0.80, 0.45), (0.91, 0.80), (0.09, 0.80)),  # the desk
        rough((0.10, 0.83), (0.90, 0.83)),
        rough((0.27, 0.38), (0.26, 0.13), (0.75, 0.13), (0.74, 0.38), (0.27, 0.38)),  # the monitor
        rough((0.505, 0.15), (0.505, 0.36)),
        rough((0.48, 0.38), (0.48, 0.49), (0.41, 0.51), (0.60, 0.51), (0.53, 0.49), (0.53, 0.38)),
        rough((0.30, 0.71), (0.33, 0.60), (0.66, 0.60), (0.68, 0.71), (0.30, 0.71)),  # the keyboard
    ]
    lines += [rough((0.34, y), (0.65, y)) for y in (0.627, 0.655, 0.683)]
    lines += [rough((0.33, y), (0.46 + dx, y)) for y, dx in ((0.19, 0.0), (0.22, -0.04), (0.25, -0.02), (0.28, -0.07))]
    lines += [oval(0.77, 0.60, 0.04, 0.016), rough((0.73, 0.60), (0.74, 0.68), (0.80, 0.68), (0.81, 0.60)), oval(0.812, 0.637, 0.026, 0.025, -80, 80, 8)]  # the mug
    return lines


# The lanyard: a flat strap from the ring at the badge's clip to a loose coil beside it, on the mat.
MAT = (-0.45, -0.26, 0.45, 0.14)  # x0, y0, x1, y1
MAT_TOP = 0.753
STRAP = (0.015, 0.0008)  # width, thickness
RING = (0.005, 0.001)  # radius to the middle of the wire, the wire's radius: 12 mm across


def ring_centre():
    (x, y, _), (_, _, yaw) = REST["badge"]
    dx, dy, _ = turn((0.0, BADGE[1] / 2 + BADGE_CLIP[1] * 0.75, 0.0), "Z", yaw)
    return (x + dx, y + dy, MAT_TOP + RING[1])


def lanyard_path():
    a = ring_centre()[:2]
    b, c, d = (-0.335, 0.126), (-0.285, 0.121), (-0.243, 0.121)
    pts = []
    for i in range(16):
        t = i / 16
        w = ((1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t**3)
        x, y = (sum(k * p[j] for k, p in zip(w, (a, b, c, d))) for j in range(2))
        pts.append((x, y, MAT_TOP + 0.0002))
    turns, n = 1.4, 56
    for i in range(n + 1):
        done = turns * i / n
        th, k = math.pi / 2 - 2 * math.pi * done, 1 - 0.32 * done
        pts.append((d[0] + 0.040 * k * math.cos(th), 0.083 + 0.038 * k * math.sin(th), MAT_TOP + 0.0002 + 0.0012 * done))
    return pts


def ribbon(path, width, thick):
    """A flat strap along path, lying on it: (verts, quads), four verts a step, faces outward."""
    verts = []
    for i, (x, y, z) in enumerate(path):
        (px, py, _), (qx, qy, _) = path[max(i - 1, 0)], path[min(i + 1, len(path) - 1)]
        tx, ty = qx - px, qy - py
        k = width / 2 / math.hypot(tx, ty)
        lx, ly = -ty * k, tx * k
        verts += [(x + lx, y + ly, z), (x - lx, y - ly, z), (x - lx, y - ly, z + thick), (x + lx, y + ly, z + thick)]
    faces = [(0, 1, 2, 3)]
    for i in range(0, 4 * (len(path) - 1), 4):
        for k in range(4):
            j = (k + 1) % 4
            faces.append((i + k, i + 4 + k, i + 4 + j, i + j))
    last = 4 * (len(path) - 1)
    faces.append((last + 3, last + 2, last + 1, last))
    return verts, faces
