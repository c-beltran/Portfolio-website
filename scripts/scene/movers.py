"""
Pure geometry for the two objects that come forward (design 2026-11-19 §4.2, §6 Animation):
the backflow test-kit case, whose lid opens on a gauge, a screwdriver and a generic certificate,
and the phone, which turns to landscape. No bpy, so it is unit-tested by test_movers.py.

The kit's frame is the case's own: origin at its centre, +X along its width, +Y away from the
seat (the hinge side), +Z up. Metres.
"""

import math
import random

FPS = 60
KIT_OPEN_S = 0.8
PHONE_TURN_S = 0.5
LID_OPEN_DEG = 105
PHONE_TURN_DEG = 90

# Today's case (M3a): 0.26 × 0.18 × 0.085 m, resting at (-0.33, 0.30, 0.7925), turned −14°.
KIT_SIZE = (0.26, 0.18, 0.085)
KIT_REST = {"location": (-0.33, 0.30, 0.7925), "rot_z_deg": -14.0}
LID_H = 0.030
KIT_BEVEL = 0.012
WALL = 0.008  # the base's rim
FLOOR = 0.010  # the base's floor under the foam
FOAM_DROP = 0.003  # the foam sits this far below the rim


def frames(seconds: float) -> int:
    return round(seconds * FPS)


def ease(t: float) -> float:
    """Ease in and out (half a cosine), clamped to 0–1."""
    t = min(1.0, max(0.0, t))
    return (1 - math.cos(math.pi * t)) / 2


def lid_angle(t: float) -> float:
    """Degrees the lid has opened at clip time t (0–1)."""
    return LID_OPEN_DEG * ease(t)


def lid_rotation_x(t: float) -> float:
    """The lid's rotation about its hinge (local X), radians: negative tips the front edge up and back."""
    return -math.radians(lid_angle(t))


def turn_angle(t: float) -> float:
    """Degrees the phone has turned about its screen normal at clip time t (0–1)."""
    return PHONE_TURN_DEG * ease(t)


def split_case(size, lid_h):
    """The case cut into a base and a lid: (base_size, base_z, lid_size, lid_z, hinge), the z values
    being the halves' centres and hinge the middle of the base's back top edge, in the case frame."""
    w, d, h = size
    base_h = h - lid_h
    base_z = -h / 2 + base_h / 2
    lid_z = h / 2 - lid_h / 2
    hinge = (0.0, d / 2, -h / 2 + base_h)
    return (w, d, base_h), base_z, (w, d, lid_h), lid_z, hinge


def kit_layout():
    """Where the kit's insides go, in the case frame. Each box: centre, size (x, y, z before its
    turn) and rot_z_deg. Everything nests in foam pockets, below the rim, so the lid shuts."""
    w, d, _ = KIT_SIZE
    _, _, _, _, hinge = split_case(KIT_SIZE, LID_H)
    top = hinge[2]
    floor = -KIT_SIZE[2] / 2 + FLOOR
    foam_top = top - FOAM_DROP
    inner = (w - 2 * WALL, d - 2 * WALL)
    item_top = top - 0.0025

    gauge_r, gauge_h = 0.035, 0.02
    gx, gy = -0.06, -0.022
    gauge_z = item_top - gauge_h / 2
    face_z = item_top + 0.00015

    # The screwdriver lies diagonally on the right: handle then shaft along one axis.
    a = 30.0
    ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
    sx, sy = 0.06, 0.0
    handle_r, handle_l, shaft_r, shaft_l = 0.011, 0.07, 0.0025, 0.06
    total = handle_l + shaft_l
    axis_z = item_top - handle_r
    h_mid = -total / 2 + handle_l / 2
    s_mid = -total / 2 + handle_l + shaft_l / 2

    contents = {
        "gauge": {"centre": (gx, gy, gauge_z), "size": (2 * gauge_r, 2 * gauge_r, gauge_h), "rot_z_deg": 0.0, "r": gauge_r},
        "gauge_face": {"centre": (gx, gy, face_z), "size": (0.06, 0.06, 0.0), "rot_z_deg": 0.0, "r": 0.03},
        # the needle turns about the dial's centre, with a short tail behind it
        "needle": {"centre": (gx + 0.008 * math.cos(math.radians(40)), gy + 0.008 * math.sin(math.radians(40)), face_z + 0.0004), "size": (0.024, 0.0022, 0.0006), "rot_z_deg": 40.0},
        "screwdriver": {
            "centre": (sx + h_mid * ca, sy + h_mid * sa, axis_z),
            "size": (handle_l, 2 * handle_r, 2 * handle_r),
            "rot_z_deg": a,
            "r": handle_r,
        },
        # the shaft lies level with the handle's top, not on its axis, so it shows above the foam
        # (the handle's end, where they'd meet, is hidden in its pocket)
        "shaft": {
            "centre": (sx + s_mid * ca, sy + s_mid * sa, item_top - shaft_r),
            "size": (shaft_l, 2 * shaft_r, 2 * shaft_r),
            "rot_z_deg": a,
            "r": shaft_r,
        },
        "certificate": {"centre": (-0.02, 0.048, foam_top + 0.0004), "size": (0.09, 0.06, 0.0004), "rot_z_deg": 4.0},
    }
    foam = {"centre": (0.0, 0.0, (floor + foam_top) / 2), "size": (inner[0] - 0.001, inner[1] - 0.001, foam_top - floor), "rot_z_deg": 0.0}
    tray = {"centre": (0.0, 0.0, (floor + top) / 2 + 0.005), "size": (*inner, top - floor + 0.01), "rot_z_deg": 0.0}
    pad = {"centre": (0.0, -d / 2, -0.001), "size": (inner[0] - 0.004, inner[1] - 0.004, 0.002), "rot_z_deg": 0.0}
    return {"top": top, "foam_top": foam_top, "foam": foam, "tray": tray, "pad": pad, "contents": contents}


def dial_ticks(n=40):
    """The gauge face's marks, on a unit disc: n ticks over a 270° sweep, every fifth longer.
    Tick marks only: no numerals, no brand."""
    out = []
    for i in range(n):
        a = math.radians(225 - 270 * i / (n - 1))
        r0 = 0.72 if i % 5 == 0 else 0.82
        out.append(((r0 * math.cos(a), r0 * math.sin(a)), (0.93 * math.cos(a), 0.93 * math.sin(a))))
    return out


def certificate_marks(seed=7):
    """A generic certificate as plain shapes on a unit sheet (x right, y down, 0–1 on both
    axes): a heading bar, rows of grey bars standing for lines, a blank box, a signature bar and a
    seal ring. Rects and a ring only, so nothing can be read; all inside a 6% margin."""
    rng = random.Random(seed)
    marks = [
        {"kind": "rect", "x0": 0.26, "y0": 0.10, "x1": 0.74, "y1": 0.17, "grey": 0.35},  # heading
        {"kind": "rect", "x0": 0.36, "y0": 0.21, "x1": 0.64, "y1": 0.24, "grey": 0.55},  # subheading
        {"kind": "rect", "x0": 0.08, "y0": 0.08, "x1": 0.92, "y1": 0.085, "grey": 0.6},  # top rule
    ]
    y = 0.32
    while y < 0.66:
        x1 = 0.66 if y < 0.5 else 0.92
        marks.append({"kind": "rect", "x0": 0.10, "y0": y, "x1": 0.10 + (x1 - 0.10) * rng.uniform(0.55, 1.0), "y1": y + 0.022, "grey": 0.62})
        y += 0.055
    marks.append({"kind": "rect", "x0": 0.70, "y0": 0.30, "x1": 0.90, "y1": 0.47, "grey": 0.8, "outline": True})  # blank box
    marks.append({"kind": "rect", "x0": 0.58, "y0": 0.84, "x1": 0.90, "y1": 0.85, "grey": 0.4})  # signature line
    marks.append({"kind": "ring", "cx": 0.20, "cy": 0.80, "r0": 0.065, "r1": 0.09, "grey": 0.55})  # seal
    return marks
