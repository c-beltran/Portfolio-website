"""
Builds Carlos's workspace scene headlessly (DESK_SPEC.md §2, §6; M3a).

    Blender -b --factory-startup --python scripts/scene/build_scene.py -- --out ~/Portfolio-assets/blend/workspace.blend

Units are metres. +X is right, +Y is away from the camera (towards the wall), +Z is up.
The desk top is at z = DESK_TOP. Interactive objects are named obj_*; decoration deco_*.
Complex objects (keyboard, laptop, monitor, mug, bottle, glass, phone) are imported from
pinned glTF downloads listed in assets.json; until a download exists, a true-size proxy block
stands in (named proxy_*), so the layout and cameras can be reviewed first.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ASSETS_DIR = Path.home() / "Portfolio-assets"
DESK_TOP = 0.75


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(ASSETS_DIR / "blend" / "workspace.blend"))
    return p.parse_args(argv)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def box(name, size, loc, coll, rot=(0, 0, 0), bevel=0.002):
    """A bevelled box: size (x, y, z) in metres, loc is the centre of its base."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    o.location = (loc[0], loc[1], loc[2] + size[2] / 2)
    o.rotation_euler = [math.radians(a) for a in rot]
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 3
        m.limit_method = "ANGLE"
    move_to(o, coll)
    return o


def cylinder(name, r, h, loc, coll, rot=(0, 0, 0), verts=48, bevel=0.0015):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.location = (loc[0], loc[1], loc[2] + h / 2)
    o.rotation_euler = [math.radians(a) for a in rot]
    if bevel:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
    move_to(o, coll)
    return o


def plane(name, size, loc, coll, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    bpy.ops.object.transform_apply(scale=True)
    move_to(o, coll)
    return o


def move_to(o, coll):
    for c in o.users_collection:
        c.objects.unlink(o)
    coll.objects.link(o)


def set_parent(child, par):
    """Attach without moving: keep the child's world transform."""
    bpy.context.view_layer.update()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def parent(children, name, coll):
    e = bpy.data.objects.new(name, None)
    coll.objects.link(e)
    for c in children:
        set_parent(c, e)
    return e


# ---------------------------------------------------------------- room

def build_room(coll):
    # Floor and the back wall (left part, plain); the window fills the right part.
    plane("room_floor", (8, 8), (0, 0, 0), coll)
    plane("room_wall_back", (2.2, 2.8), (-1.2, 0.95, 1.4), coll, rot=(90, 0, 0))
    plane("room_wall_left", (4, 2.8), (-2.3, -1.0, 1.4), coll, rot=(90, 0, 90))
    # Window: frame and mullions in front of a generic sky plane (privacy: never a real view).
    x0, x1, z0, z1, y = -0.1, 2.2, 0.55, 2.7, 0.95
    frame = []
    for i, x in enumerate([x0, 0.65, 1.4, x1]):
        frame.append(box(f"window_mullion_{i}", (0.06, 0.08, z1 - z0), (x, y, z0), coll, bevel=0.004))
    frame.append(box("window_sill", (x1 - x0 + 0.06, 0.25, 0.04), ((x0 + x1) / 2, y - 0.05, z0 - 0.04), coll))
    frame.append(box("window_head", (x1 - x0 + 0.06, 0.08, 0.06), ((x0 + x1) / 2, y, z1), coll))
    frame.append(box("window_transom", (x1 - x0, 0.06, 0.05), ((x0 + x1) / 2, y, 1.45), coll))
    parent(frame, "window_frame", coll)
    sky = plane("window_sky", (6, 3.4), (1.0, 3.5, 1.6), coll, rot=(90, 0, 0))
    sky["role"] = "sky"


# ---------------------------------------------------------------- desk and simple objects (built in code)

def build_desk(coll):
    top = box("deco_desk_top", (1.6, 0.9, 0.025), (0, 0.12, DESK_TOP - 0.025), coll, bevel=0.003)
    legs = [
        box(f"deco_desk_leg_{i}", (0.06, 0.7, 0.02), (x, 0.12, 0.0), coll)
        for i, x in enumerate([-0.72, 0.72])
    ] + [box(f"deco_desk_column_{i}", (0.07, 0.05, DESK_TOP - 0.045), (x, 0.12, 0.02), coll) for i, x in enumerate([-0.72, 0.72])]
    parent([top] + legs, "deco_desk", coll)
    mat = box("deco_mat", (0.9, 0.4, 0.003), (0.0, -0.06, DESK_TOP), coll, bevel=0.001)
    mat["role"] = "mat"


def build_simple_objects(coll):
    t = DESK_TOP + 0.003  # on the mat
    # Notepad (A5, spiral side up) and pen, front left.
    pad = box("obj_notepad", (0.148, 0.21, 0.008), (-0.6, -0.12, DESK_TOP), coll, rot=(0, 0, 8), bevel=0.001)
    # cylinder() lifts by half its length (for upright use); the pen lies flat.
    pen = cylinder("deco_pen", 0.0045, 0.14, (-0.57, -0.13, DESK_TOP + 0.013 - 0.07), coll, rot=(0, 90, 20))
    set_parent(pen, pad)
    # Business card (85×55 mm), front right of the keyboard.
    box("obj_card", (0.085, 0.055, 0.0006), (0.28, -0.22, t), coll, rot=(0, 0, -12), bevel=0.0002)
    # ID badge (CR80 card in a sleeve) lying by the laptop stand, lanyard coiled beside it.
    badge = box("obj_badge", (0.054, 0.086, 0.003), (-0.46, 0.0, DESK_TOP), coll, rot=(0, 0, 25), bevel=0.0008)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.05, minor_radius=0.004, location=(-0.42, 0.07, DESK_TOP + 0.004))
    lan = bpy.context.active_object
    lan.name = "deco_lanyard"
    lan.scale = (1, 0.6, 0.3)
    move_to(lan, coll)
    # Small framed photo (13×18 cm frame) leaning against the wall right of the monitor.
    frame = box("obj_photo", (0.13, 0.018, 0.18), (0.42, 0.5, DESK_TOP), coll, rot=(-12, 0, -8), bevel=0.002)
    frame["role"] = "photo_frame"
    # Backflow test-kit case (hard case with handle) beside the laptop, on the desk.
    case = box("obj_kit", (0.30, 0.21, 0.10), (-0.33, 0.3, DESK_TOP), coll, rot=(0, 0, -14), bevel=0.012)
    handle = box("deco_kit_handle", (0.11, 0.025, 0.02), (-0.33, 0.3, DESK_TOP + 0.10), coll, rot=(0, 0, -14), bevel=0.006)
    set_parent(handle, case)
    # Walnut wrist rest in front of the keyboard (from the reference photo).
    box("deco_wrist_rest", (0.33, 0.075, 0.018), (-0.03, -0.205, t), coll, bevel=0.006)
    return {"pad": pad, "case": case}


# ---------------------------------------------------------------- complex objects (imported glTF, or a proxy)

# Each imported model: rotation that makes it lie Z-up and face the camera (-Y), the true width
# (X extent after rotation, metres) to scale to, where its footprint centre sits on the desk,
# and names of junk meshes to drop. The proxy size is used until the download exists.
COMPLEX = {
    "monitor": dict(proxy=(0.81, 0.10, 0.37), rot=(0, 0, -90), width=0.81, at=(-0.04, 0.42, DESK_TOP - 0.15)),
    "laptop": dict(proxy=(0.31, 0.22, 0.20), rot=(12, 0, 8), width=0.31, at=(-0.6, 0.2, DESK_TOP + 0.06)),
    "keyboard": dict(proxy=(0.33, 0.13, 0.035), rot=(0, 0, 0), level=True, width=0.33, at=(-0.03, -0.1, DESK_TOP + 0.003)),
    "mouse": dict(proxy=(0.065, 0.12, 0.04), rot=(0, 0, -90), width=0.065, at=(0.27, -0.08, DESK_TOP + 0.003)),
    "phone": dict(proxy=(0.072, 0.15, 0.008), rot=(-90, 0, 15), width=0.072, at=(0.17, 0.06, DESK_TOP + 0.003)),
    "mug": dict(proxy=(0.12, 0.09, 0.095), rot=(0, 0, 200), width=0.12, at=(0.48, -0.02, DESK_TOP)),
    "glass": dict(proxy=(0.075, 0.075, 0.12), rot=(0, 0, 0), width=0.075, at=(0.4, 0.2, DESK_TOP)),
    "bottle": dict(proxy=(0.11, 0.11, 0.24), rot=(0, 0, 0), width=0.11, at=(0.58, 0.2, DESK_TOP), drop_materials=("Stick",)),
}
# Interactive vs decoration naming for the complex objects.
NAMES = {"monitor": "obj_monitor", "phone": "obj_phone"}


def load_assets():
    p = HERE / "assets.json"
    return json.loads(p.read_text()) if p.exists() else {"models": []}


def world_bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def level_rotation(objs):
    """For a model saved at an angle: map its longest axis to X, its thinnest to Z (PCA of the
    vertices), with the busier side (keycaps) facing up."""
    import numpy as np
    from mathutils import Matrix

    bpy.context.view_layer.update()
    pts = np.array([tuple(o.matrix_world @ v.co) for o in objs if o.type == "MESH" for v in o.data.vertices])
    c = pts - pts.mean(axis=0)
    _, vecs = np.linalg.eigh(np.cov(c.T))  # ascending variance
    x, z = vecs[:, 2], vecs[:, 0]
    if (c @ z > 0).sum() > (c @ z < 0).sum():  # keycaps are the busier side: put it up (+Z)
        z = -z
    y = np.cross(z, x)
    m = Matrix([list(x), list(y), list(z)])  # rows: world axes expressed in the new frame
    return m.to_quaternion()


def import_or_proxy(key, coll, assets):
    cfg = COMPLEX[key]
    name = NAMES.get(key, f"deco_{key}")
    entry = next((m for m in assets.get("models", []) if m.get("slot") == key), None)
    path = ASSETS_DIR / "downloads" / entry["file"] if entry else None
    if not (path and path.exists()):
        o = box(f"proxy_{key}", cfg["proxy"], cfg["at"], coll, rot=(0, 0, cfg["rot"][2]), bevel=0.004)
        o["proxy_for"] = name
        return o
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    junk = set(cfg.get("drop_materials", ()))
    for o in [o for o in new if o.type == "MESH" and any(m and m.name.split(".")[0] in junk for m in o.data.materials)]:
        new.remove(o)
        bpy.data.objects.remove(o, do_unlink=True)
    root = bpy.data.objects.new(name, None)
    coll.objects.link(root)
    for o in new:
        move_to(o, coll)
        if o.parent is None:
            o.parent = root
    # 1. orient, 2. scale to the true width, 3. centre the footprint on its spot, base on the desk.
    if cfg.get("level"):
        root.rotation_mode = "QUATERNION"
        root.rotation_quaternion = level_rotation(new)
    else:
        root.rotation_euler = [math.radians(v) for v in cfg["rot"]]
    lo, hi = world_bounds(new)
    s = cfg["width"] / max(1e-9, hi.x - lo.x)
    root.scale = (s, s, s)
    lo, hi = world_bounds(new)
    at = Vector(cfg["at"])
    root.location += Vector(((at.x - (lo.x + hi.x) / 2), (at.y - (lo.y + hi.y) / 2), at.z - lo.z))
    return root


def build_laptop_stand(coll):
    # Aluminium laptop stand (simple object, built in code): a tilted plate on two side legs.
    plate = box("deco_laptop_stand", (0.26, 0.24, 0.006), (-0.6, 0.2, DESK_TOP + 0.045), coll, rot=(12, 0, 8), bevel=0.002)
    for i, dx in enumerate((-0.11, 0.11)):
        leg = box(f"deco_laptop_stand_leg_{i}", (0.012, 0.2, 0.07), (-0.6 + dx, 0.21, DESK_TOP), coll, rot=(0, 0, 8), bevel=0.003)
        set_parent(leg, plate)
    return plate


def build_light_bar(coll):
    # Monitor light bar: a slim bar resting on the monitor's top edge, at its front.
    mon = bpy.data.objects.get("obj_monitor")
    parts = [o for o in mon.children_recursive if o.type == "MESH"] if mon else []
    if parts:
        lo, hi = world_bounds(parts)
        screen = [o for o in parts if (world_bounds([o])[1] - world_bounds([o])[0]).x > 0.6]
        slo, shi = world_bounds(screen or parts)
        x, y, z = (slo.x + shi.x) / 2, slo.y + 0.02, shi.z
    else:
        x, y, z = -0.04, 0.3, DESK_TOP + 0.5
    # cylinder() lifts by half its length (for upright use); this one lies along X.
    bar = cylinder("obj_lightbar", 0.015, 0.5, (x, y - 0.01, z + 0.012 - 0.25), coll, rot=(0, 90, 0), verts=32)
    print(f"light bar at ({x:.3f}, {y:.3f}, {z:.3f})")
    return bar


# ---------------------------------------------------------------- cameras

def build_cameras(coll):
    target = Vector((-0.02, 0.24, 0.95))
    eye = Vector((0.16, -1.55, 1.36))

    def cam(name, sensor_fit, sensor):
        data = bpy.data.cameras.new(name)
        data.lens = 35
        data.sensor_fit = sensor_fit
        if sensor_fit == "VERTICAL":
            data.sensor_height = sensor
        else:
            data.sensor_width = sensor
        o = bpy.data.objects.new(name, data)
        coll.objects.link(o)
        o.location = eye
        o.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()
        return o

    overview = cam("cam_overview", "HORIZONTAL", 36)
    # Phone crop: same position, same vertical field of view as the 16:9 overview, portrait aspect.
    cam("cam_phone_crop", "VERTICAL", 36 * 9 / 16)
    bpy.context.scene.camera = overview


def main():
    a = args()
    reset()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    room, desk, objs, cams = (collection(n) for n in ("room", "desk", "objects", "cameras"))
    build_room(room)
    build_desk(desk)
    build_simple_objects(objs)
    assets = load_assets()
    for key in COMPLEX:
        import_or_proxy(key, objs, assets)
    build_laptop_stand(objs)
    build_light_bar(objs)
    build_cameras(cams)
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=a.out)
    print(f"saved {a.out}")


main()
