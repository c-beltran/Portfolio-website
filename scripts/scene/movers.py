"""
Pure geometry for the two objects that come forward:
the backflow test-kit case, whose lid opens on Carlos's kit
(the gauge with its three hoses, brass fittings and a
screwdriver), and the phone, which turns to landscape. No bpy, so it is unit-tested by
test_movers.py.

The kit's frame is the case's own: origin at its centre, +X along its width, +Y away from the
seat (the hinge side), +Z up. Metres.
"""

import math

FPS = 60
KIT_OPEN_S = 0.8
PHONE_TURN_S = 0.5
LID_OPEN_DEG = 105
PHONE_TURN_DEG = 90

# The case: 0.26 × 0.18 × 0.085 m, resting at (-0.33, 0.30, 0.7925), turned −14°.
KIT_SIZE = (0.26, 0.18, 0.085)
KIT_REST = {"location": (-0.33, 0.30, 0.7925), "rot_z_deg": -14.0}
LID_H = 0.030
KIT_BEVEL = 0.012
WALL = 0.008  # the base's rim
FLOOR = 0.010  # the base's floor under the foam
FOAM_DROP = 0.012  # the foam sits this far below the rim, so the hoses lie on it
ITEM_CLEAR = 0.006  # nothing rises closer than this to the rim: the lid's egg-crate clears it
HOSE_R = 0.003
HOSES = ("red", "blue", "yellow")  # left to right on the manifold, as on his gauge; red loops outside
# His gauge's face: the needle turns about a pivot low on the face, under an arc of ticks across
# the top (unit-disc coordinates, +y up the face).
DIAL_PIVOT = (0.0, -0.45)
DIAL_ARC = (1.0, 1.1)  # the ticks' radii from the pivot (the long ones start nearer it)
DIAL_SWEEP = 80.0  # degrees, centred on straight up


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


def lying(centre, r, length, rot_z_deg, z):
    """A cylinder lying along its rot_z_deg direction, its axis at height z."""
    return {"kind": "lying", "centre": (centre[0], centre[1], z), "size": (length, 2 * r, 2 * r), "rot_z_deg": rot_z_deg, "r": r}


def upright(kind, centre, r, h, top):
    """A round (or hex) part standing on its axis, its top at height top."""
    return {"kind": kind, "centre": (centre[0], centre[1], top - h / 2), "size": (2 * r, 2 * r, h), "rot_z_deg": 0.0, "r": r}


def hose_path(start, z, centre, a, b, fillet=0.008, sweep=300.0, step=0.003):
    """A hose from its valve: straight towards the front, a quarter turn, then counter-clockwise
    round an ellipse (centre, semi-axes a, b) for sweep degrees. Points every step or less."""
    x0, y0 = start
    cx, cy = centre
    ts = -math.acos(max(-1.0, min(1.0, (x0 + fillet - cx) / a)))  # where the turn meets the loop
    ys = cy + b * math.sin(ts)
    pts = [(x0, y0, z)]
    run = y0 - (ys + fillet)
    n = max(1, math.ceil(run / step))
    pts += [(x0, y0 - run * i / n, z) for i in range(1, n + 1)]
    n = max(2, math.ceil(fillet * math.pi / 2 / step))
    for i in range(1, n + 1):
        ang = math.pi + math.pi / 2 * i / n
        pts.append((x0 + fillet + fillet * math.cos(ang), ys + fillet + fillet * math.sin(ang), z))
    n = math.ceil(math.radians(sweep) * max(a, b) / step)
    for i in range(1, n + 1):
        t = ts + math.radians(sweep) * i / n
        pts.append((cx + a * math.cos(t), cy + b * math.sin(t), z))
    return pts, ts + math.radians(sweep)


def kit_layout():
    """Where the kit's insides go, in the case frame (+Y towards the hinge, the back). Each content
    is a box: kind, centre, size (x, y, z before its turn), rot_z_deg (and r for round parts). The
    hoses are paths. Scaled to today's case, about 0.6 of his. Nothing rises above item_top, so the
    lid shuts."""
    w, d, _ = KIT_SIZE
    _, _, _, _, hinge = split_case(KIT_SIZE, LID_H)
    top = hinge[2]
    floor = -KIT_SIZE[2] / 2 + FLOOR
    foam_top = top - FOAM_DROP
    item_top = top - ITEM_CLEAR
    inner = (w - 2 * WALL, d - 2 * WALL)
    c = {}

    # The gauge lies face up on the left: a black bezel ringing a recessed face, the needle on a
    # pivot low on the face (DIAL_PIVOT), pointing up at the scale.
    dx, dy = -0.03, 0.012
    bezel_r, face_r, bezel_h, recess = 0.034, 0.029, 0.026, 0.002
    face_z = item_top - recess
    c["gauge"] = {**upright("ring", (dx, dy), bezel_r, bezel_h, item_top), "r_in": face_r, "recess": recess}
    c["gauge_face"] = {"kind": "disc", "centre": (dx, dy, face_z), "size": (2 * face_r, 2 * face_r, 0.0), "rot_z_deg": 0.0, "r": face_r}
    na, length, tail = 97.0, 0.98 * face_r, 0.14 * face_r
    px, py = dx + DIAL_PIVOT[0] * face_r, dy + DIAL_PIVOT[1] * face_r
    mid = (length - tail) / 2
    c["needle"] = {"kind": "box", "centre": (px + mid * math.cos(math.radians(na)), py + mid * math.sin(math.radians(na)), face_z + 0.0004), "size": (length + tail, 0.0011, 0.0005), "rot_z_deg": na}
    c["needle_cap"] = upright("upright", (px, py), 0.0021, 0.0012, face_z + 0.0012)
    # The small supply gauge on its left, on a short brass arm.
    sx, sy = -0.075, 0.025
    sg_r, sg_face, sg_h = 0.010, 0.0082, 0.016
    c["minigauge"] = {**upright("ring", (sx, sy), sg_r, sg_h, item_top - 0.001), "r_in": sg_face, "recess": 0.0015}
    c["minigauge_face"] = {"kind": "disc", "centre": (sx, sy, item_top - 0.0025), "size": (2 * sg_face, 2 * sg_face, 0.0), "rot_z_deg": 0.0, "r": sg_face}
    gap = math.hypot(dx - sx, dy - sy) - bezel_r - sg_r
    ux, uy = (dx - sx) / math.hypot(dx - sx, dy - sy), (dy - sy) / math.hypot(dx - sx, dy - sy)
    arm_mid = sg_r + gap / 2
    c["brass_arm"] = lying((sx + ux * arm_mid, sy + uy * arm_mid), 0.0025, gap + 0.004, math.degrees(math.atan2(uy, ux)), item_top - 0.006)
    # The manifold under the dial's lower edge, its three valve knobs pointing to the front.
    bottom = dy - bezel_r
    c["manifold"] = {"kind": "box", "centre": (dx, bottom + 0.0025, item_top - 0.002 - 0.005), "size": (0.050, 0.015, 0.010), "rot_z_deg": 0.0}
    knob_y = bottom - 0.005 - 0.006
    hose_z = foam_top + HOSE_R - 0.001
    knobs = {k: dx + 0.016 * (i - 1) for i, k in enumerate(HOSES)}
    for k, kx in knobs.items():
        c[f"knob_{k}"] = lying((kx, knob_y), 0.004, 0.012, 90.0, item_top - 0.004)
        c[f"brass_nipple_{k}"] = lying((kx, knob_y - 0.009), 0.0028, 0.006, 90.0, hose_z)

    # The hoses coil round the gauge, red outside, each from its knob, ending in a brass nut.
    centre = (-0.0365, 0.0)
    loops = {"red": (0.081, 0.077), "blue": (0.0735, 0.0695), "yellow": (0.066, 0.062)}
    hoses = {}
    for k in HOSES:
        a, b = loops[k]
        path, end = hose_path((knobs[k], knob_y - 0.012), hose_z, centre, a, b)
        hoses[k] = {"r": HOSE_R, "path": path}
        tx, ty = -a * math.sin(end), b * math.cos(end)
        tl = math.hypot(tx, ty)
        ex, ey, _ = path[-1]
        c[f"brass_end_{k}"] = lying((ex + tx / tl * 0.006, ey + ty / tl * 0.006), 0.0038, 0.012, math.degrees(math.atan2(ty, tx)), hose_z)

    # His screwdriver along the right, handle to the front: black grip, yellow collar, steel shaft
    # and a flat tip, on one axis, each in its own pocket.
    rot = 92.0
    ux, uy = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    ox, oy = 0.064, 0.0
    axis_z = item_top - 0.0085
    for name, s0, s1, r in (("screwdriver", -0.070, -0.022, 0.0085), ("screwdriver_collar", -0.022, -0.008, 0.0068), ("screwdriver_shaft", -0.008, 0.058, 0.0019)):
        m = (s0 + s1) / 2
        c[name] = lying((ox + ux * m, oy + uy * m), r, s1 - s0, rot, axis_z)
    c["screwdriver_tip"] = {"kind": "box", "centre": (ox + ux * 0.064, oy + uy * 0.064, axis_z), "size": (0.012, 0.0045, 0.0012), "rot_z_deg": rot}

    # Four brass fittings in a column beside it, standing in their pockets.
    for i, (fy, r, nr) in enumerate(((-0.054, 0.0075, 0.0052), (-0.018, 0.0068, 0.0046), (0.018, 0.0075, 0.0050), (0.054, 0.0064, 0.0044))):
        c[f"brass_fitting_{i}"] = upright("hex", (0.103, fy), r, 0.008, item_top - 0.004)
        c[f"brass_neck_{i}"] = upright("upright", (0.103, fy), nr, 0.006, item_top)

    foam = {"kind": "box", "centre": (0.0, 0.0, (floor + foam_top) / 2), "size": (inner[0] - 0.001, inner[1] - 0.001, foam_top - floor), "rot_z_deg": 0.0}
    tray = {"kind": "box", "centre": (0.0, 0.0, (floor + top) / 2 + 0.005), "size": (*inner, top - floor + 0.01), "rot_z_deg": 0.0}
    pad = {"kind": "box", "centre": (0.0, -d / 2, 0.0), "size": (inner[0] - 0.004, inner[1] - 0.004, ITEM_CLEAR - 0.001), "rot_z_deg": 0.0}
    return {"top": top, "foam_top": foam_top, "item_top": item_top, "foam": foam, "tray": tray, "pad": pad, "contents": c, "hoses": hoses}


def egg_crate(sx, sy, period=0.02, depth=0.005, step=0.0025):
    """The lid's egg-crate foam as a grid (verts, quads), centred on the origin: its surface hangs
    below z = 0 (the lid's underside) by up to depth, in bumps period apart."""
    nx, ny = max(2, round(sx / step)), max(2, round(sy / step))
    verts = []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x, y = -sx / 2 + sx * i / nx, -sy / 2 + sy * j / ny
            bump = math.sin(2 * math.pi * x / period) * math.sin(2 * math.pi * y / period)
            verts.append((x, y, -depth / 2 - depth / 2 * bump))
    # wound clockwise seen from above, so each face points down, out of the lid
    faces = [(j * (nx + 1) + i, (j + 1) * (nx + 1) + i, (j + 1) * (nx + 1) + i + 1, j * (nx + 1) + i + 1) for j in range(ny) for i in range(nx)]
    return verts, faces


def dial_ticks(n=31):
    """His gauge's scale, on a unit disc: n ticks on an arc across the top of the face, radial from
    the needle's pivot (DIAL_PIVOT), every fifth longer. Tick marks only: no numerals, no brand."""
    px, py = DIAL_PIVOT
    r_long, r_out = DIAL_ARC
    out = []
    for i in range(n):
        a = math.radians(90 + DIAL_SWEEP / 2 - DIAL_SWEEP * i / (n - 1))
        r0 = r_long if i % 5 == 0 else (r_long + r_out) / 2
        out.append(((px + r0 * math.cos(a), py + r0 * math.sin(a)), (px + r_out * math.cos(a), py + r_out * math.sin(a))))
    return out


def small_dial_ticks(n=40):
    """The small gauge's marks, on a unit disc: n ticks over a 270° sweep, every fifth longer.
    Tick marks only: no numerals, no brand."""
    out = []
    for i in range(n):
        a = math.radians(225 - 270 * i / (n - 1))
        r0 = 0.72 if i % 5 == 0 else 0.82
        out.append(((r0 * math.cos(a), r0 * math.sin(a)), (0.93 * math.cos(a), 0.93 * math.sin(a))))
    return out
