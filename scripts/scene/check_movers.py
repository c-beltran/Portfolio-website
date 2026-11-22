"""
Checks the movers in workspace.blend:

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/check_movers.py

Exits 1 and prints what's missing unless each object that comes forward has its pivot, rigid
parts and clip, rests where it lay, and ends its clip showing what it should. Nothing is saved.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import movers as MV  # noqa: E402

try:
    import flat_movers as F  # noqa: E402
    import room_movers as RV  # noqa: E402
except ImportError as e:
    print("CHECK_MOVERS FAIL")
    print(" -", e)
    sys.stdout.flush()
    os._exit(1)

# child: (parent it must hang under, type)
TREE = {
    "obj_kit": (None, "EMPTY"),
    "kit_base": ("obj_kit", "MESH"),
    "kit_foam": ("kit_base", "MESH"),
    "kit_gauge": ("kit_base", "MESH"),
    "kit_gauge_face": ("kit_gauge", "MESH"),
    "kit_needle": ("kit_gauge", "MESH"),
    "kit_minigauge": ("kit_base", "MESH"),
    "kit_manifold": ("kit_base", "MESH"),
    "kit_hose_red": ("kit_base", "MESH"),
    "kit_hose_blue": ("kit_base", "MESH"),
    "kit_hose_yellow": ("kit_base", "MESH"),
    "kit_brass_fitting_0": ("kit_base", "MESH"),
    "kit_screwdriver": ("kit_base", "MESH"),
    "kit_screwdriver_collar": ("kit_base", "MESH"),
    "kit_screwdriver_shaft": ("kit_base", "MESH"),
    "kit_screwdriver_tip": ("kit_base", "MESH"),
    "kit_lid": ("obj_kit", "MESH"),
    "kit_lid_pad": ("kit_lid", "MESH"),
    "obj_phone": (None, "EMPTY"),
    "phone_spin": ("obj_phone", "EMPTY"),
    "phone_body": ("phone_spin", None),
    "phone_screen": ("phone_spin", "MESH"),
    "obj_badge": (None, "EMPTY"),
    "badge_flip": ("obj_badge", "EMPTY"),
    "badge_card": ("badge_flip", "MESH"),
    "badge_front": ("badge_card", "MESH"),
    "badge_clip": ("badge_card", "MESH"),
    "obj_photo": (None, "EMPTY"),
    "photo_tilt": ("obj_photo", "EMPTY"),
    "photo_frame": ("photo_tilt", "MESH"),
    "photo_print": ("photo_frame", "MESH"),
    "obj_notepad": (None, "EMPTY"),
    "notepad_page": ("obj_notepad", "MESH"),
    "notepad_block": ("obj_notepad", "MESH"),
    "notepad_sketch": ("notepad_block", "MESH"),
    "notepad_pen": ("notepad_block", "MESH"),
    "obj_card": (None, "EMPTY"),
    "card_flip": ("obj_card", "EMPTY"),
    "card_body": ("card_flip", "MESH"),
    "obj_car": (None, "EMPTY"),
    "car_turn": ("obj_car", "EMPTY"),
    "car_body": ("car_turn", "MESH"),
    "obj_ball": (None, "EMPTY"),
    "ball_roll": ("obj_ball", "EMPTY"),
    "ball_skin": ("ball_roll", "MESH"),
    "obj_mug": (None, "EMPTY"),
    "mug_tip": ("obj_mug", "EMPTY"),
    "mug_body": ("mug_tip", "MESH"),
}
# Where each lay before it became a mover (world boxes, metres): (the parts, min, max). The badge is
# 3 mm higher, on the mat; the pen has moved off the notepad's page.
REST_BOX = {
    "badge": (("badge_card",), (-0.38238, 0.00988, 0.753), (-0.29762, 0.11012, 0.756)),
    "photo": (("photo_frame", "photo_print"), (0.43036, 0.4347, 0.75051), (0.56964, 0.5253, 0.92949)),
    "notepad": (("notepad_block", "notepad_page"), (-0.58775, -0.21414, 0.75), (-0.41225, 0.01414, 0.758)),
    "card": (("card_body",), (0.23275, -0.25569, 0.753), (0.32725, -0.18431, 0.7536)),
    "car": (("car_body",), (0.30353, 0.12513, 0.75), (0.49647, 0.27487, 0.81369)),
    "ball": (("ball_skin",), (-2.06, 0.44, 0.0), (-1.84, 0.66, 0.22)),
    "mug": (("mug_body",), (0.43189, -0.05654, 0.755), (0.5375, 0.02981, 0.84993)),
}
CLIPS = {"kit_open": ("kit_lid", MV.frames(MV.KIT_OPEN_S)), "phone_turn": ("phone_spin", MV.frames(MV.PHONE_TURN_S))}
CLIPS.update({name: (c[0], MV.frames(c[1])) for name, c in {**F.CLIPS, **RV.CLIPS}.items()})

problems = []
get = bpy.data.objects.get
scene = bpy.context.scene


def world_verts(objs):
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        if o.type != "MESH":
            continue
        me = o.evaluated_get(deps).to_mesh()
        m = o.matrix_world
        pts += [tuple(m @ v.co) for v in me.vertices]
        o.evaluated_get(deps).to_mesh_clear()
    return np.array(pts)


def axes(pts):
    """Principal axes: (long, flattest), the largest- and smallest-variance directions."""
    _, vecs = np.linalg.eigh(np.cov((pts - pts.mean(axis=0)).T))
    return vecs[:, 2], vecs[:, 0]


for name, (par, kind) in TREE.items():
    o = get(name)
    if not o:
        problems.append(f"no {name}")
        continue
    if kind and o.type != kind:
        problems.append(f"{name} is a {o.type}, expected {kind}")
    if par and (not o.parent or o.parent.name != par):
        problems.append(f"{name} hangs under {o.parent.name if o.parent else 'nothing'}, expected {par}")

for clip, (owner, n) in CLIPS.items():
    act = bpy.data.actions.get(clip)
    o = get(owner)
    if not act:
        problems.append(f"no action {clip}")
        continue
    lo, hi = act.frame_range
    if (round(lo), round(hi)) != (0, n):
        problems.append(f"{clip} spans frames {lo:g}–{hi:g}, expected 0–{n}")
    if o and (not o.animation_data or not o.animation_data.action or o.animation_data.action.name != clip):
        problems.append(f"{owner} does not carry {clip}")

if scene.render.fps != MV.FPS:
    problems.append(f"scene runs at {scene.render.fps} fps, expected {MV.FPS}")
if scene.frame_current != 0:
    problems.append(f"the scene rests on frame {scene.frame_current}, expected 0 (lid shut)")

if not problems:
    kit, lid = get("obj_kit"), get("kit_lid")
    _, _, _, _, hinge = MV.split_case(MV.KIT_SIZE, MV.LID_H)
    scene.frame_set(0)
    base_top = (kit.matrix_world @ Vector(hinge)).z
    # the lid's front edge: its vertices nearest the seat, in the lid's own frame
    lid_local = np.array([tuple(v.co) for v in lid.data.vertices])
    front = lid_local[lid_local[:, 1] < lid_local[:, 1].min() + 0.002]
    scene.frame_set(CLIPS["kit_open"][1])
    m = lid.matrix_world
    zs = [(m @ Vector(p)).z for p in front]
    if min(zs) <= base_top + 0.1:
        problems.append(f"kit_open: the lid's front edge ends at {min(zs):.3f} m, not well above the base top {base_top:.3f}")

    # Every part of the shut kit sits inside the case (latches and the handle just outside it).
    scene.frame_set(0)
    inv = kit.matrix_world.inverted()
    w, d, h = MV.KIT_SIZE
    for o in [c for c in kit.children_recursive if c.type == "MESH"]:
        p = world_verts([o])
        loc = np.array([tuple(inv @ Vector(q)) for q in p])
        out = (np.abs(loc[:, 0]) > w / 2 + 0.006) | (np.abs(loc[:, 1]) > d / 2 + 0.006) | (loc[:, 2] < -h / 2 - 0.001) | (loc[:, 2] > h / 2 + 0.019)
        if out.any():
            problems.append(f"{o.name} strays outside the case (e.g. at {tuple(np.round(loc[out][0], 3))} in the case frame)")

    body = [o for o in get("phone_body").children_recursive if o.type == "MESH"] or [get("phone_body")]
    screen = get("phone_screen")

    def screen_normal():  # the display's own normal (the body's flattest axis leans with the camera bump)
        n = screen.matrix_world.to_3x3() @ screen.data.polygons[0].normal
        return np.array(n.normalized())

    scene.frame_set(0)
    long0, n0 = axes(world_verts(body))[0], screen_normal()
    scene.frame_set(CLIPS["phone_turn"][1])
    long1, n1 = axes(world_verts(body))[0], screen_normal()
    if abs(float(long0 @ long1)) > math.sin(math.radians(1)):
        problems.append(f"phone_turn: the long axis turns {math.degrees(math.acos(min(1, abs(float(long0 @ long1))))):.1f}°, expected 90°")
    if abs(float(n0 @ n1)) < math.cos(math.radians(1)):
        problems.append("phone_turn: the screen tips out of its plane")
    scene.frame_set(0)

    # The rest lie where they lay.
    for name, (parts, lo, hi) in REST_BOX.items():
        pts = world_verts([get(p) for p in parts])
        off = max(np.abs(pts.min(axis=0) - np.array(lo)).max(), np.abs(pts.max(axis=0) - np.array(hi)).max())
        if off > 0.001:
            problems.append(f"obj_{name}: its box is {off * 1000:.1f} mm off where it lay")
        if max(abs(s - 1) for s in get(f"obj_{name}").matrix_world.to_scale()) > 1e-5:
            problems.append(f"obj_{name}: the pivot is scaled")

    # The pen lies beside the page, on the mat.
    inv = get("obj_notepad").matrix_world.inverted()
    xs = lambda part: [(inv @ Vector(p)).x for p in world_verts([get(part)])]  # noqa: E731
    if min(xs("notepad_pen")) <= max(xs("notepad_page")):
        problems.append("notepad_pen lies over the page")

    # The lanyard stays on the desk.
    strap = get("deco_lanyard")
    if not strap or strap.parent or not get("deco_lanyard_ring"):
        problems.append("no deco_lanyard lying on its own, with its ring")
    elif np.ptp(world_verts([strap])[:, 2]) > 0.006:
        problems.append("deco_lanyard doesn't lie flat")
    elif np.linalg.norm(world_verts([get("deco_lanyard_ring")]).mean(axis=0) - world_verts([get("badge_clip")]).mean(axis=0)) > 0.02:
        problems.append("deco_lanyard_ring is away from the badge's clip")
    coaster = get("deco_coaster_mug")
    if not coaster or coaster.parent:
        problems.append("deco_coaster_mug doesn't stay on the desk")
    for gone in ("deco_pen", "deco_photo_print", "deco_mug"):
        if get(gone):
            problems.append(f"{gone} still exists")

    # The badge and the card end on their backs, facing out of their pivots, the right way up.
    for mover, (part, corners) in F.FACES.items():
        scene.frame_set(CLIPS[f"{mover}_flip"][1])
        m = get(part).matrix_world
        tl, tr, br, bl = (m @ Vector(c) for c in corners)
        frame = get(f"obj_{mover}").matrix_world.to_3x3()
        n = (br - bl).cross(tl - bl).normalized()
        if n.angle(frame @ Vector((0, 0, 1))) > math.radians(1):
            problems.append(f"{mover}_flip: the back doesn't face out of the pivot")
        if (tl - bl).normalized().angle(frame @ Vector((0, 1, 0))) > math.radians(1):
            problems.append(f"{mover}_flip: the back isn't the right way up")

    # The mug ends with its handle on the right.
    scene.frame_set(CLIPS["mug_tip"][1])
    p = world_verts([get("mug_body")])[:, :2]
    axis = get("mug_tip").matrix_world.translation
    d = p - np.array((axis.x, axis.y))
    r = np.hypot(d[:, 0], d[:, 1])
    far = d[r > r.max() - 0.002].mean(axis=0)
    if abs(math.degrees(math.atan2(far[1], far[0]))) > 3:
        problems.append("mug_tip: the handle doesn't end on the right")
    scene.frame_set(0)

if problems:
    print("CHECK_MOVERS FAIL")
    for p in problems:
        print(" -", p)
    sys.stdout.flush()
    os._exit(1)
print("CHECK_MOVERS OK")
