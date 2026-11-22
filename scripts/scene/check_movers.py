"""
Checks the two movers in workspace.blend (design 2026-11-19 §4.2, §6 Animation):

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/check_movers.py

Exits 1 and prints what's missing unless the kit case and the phone have their pivots, rigid
parts and clips: kit_open lifts the lid, phone_turn turns the phone a quarter about its screen.
Nothing is saved.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import movers as MV  # noqa: E402

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
}
CLIPS = {"kit_open": ("kit_lid", MV.frames(MV.KIT_OPEN_S)), "phone_turn": ("phone_spin", MV.frames(MV.PHONE_TURN_S))}

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

if problems:
    print("CHECK_MOVERS FAIL")
    for p in problems:
        print(" -", p)
    sys.stdout.flush()
    os._exit(1)
print("CHECK_MOVERS OK")
