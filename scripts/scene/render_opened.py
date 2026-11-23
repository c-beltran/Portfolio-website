"""
Renders an object that comes forward, in its opened pose, so Tier 1 visitors see the same art
when they click; the patch that hides it on the seat still while it is out; a lean-in; or a frame
of the resting terminal.

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/render_opened.py -- \
        --object <mover>|monitor|cv|board --mode day|lamp --out <png> [--patch | --loop 1|2|3] [--samples 384]

Opened (the default): the mover's pivot at opened.canonical_pose and its clip at the last frame;
the camera at the seat's eye, turned as the seat camera is (so it looks straight at the pivot),
its field of view putting the opened object's farthest projected point at 80% of the half-frame. Every other
object still lights and shadows it but isn't drawn (film transparent). The sidecar <png>.json
records focalPx (the frame's focal length in px); `screen`, the corners in px (TL TR BR BL) of what
HTML or the clip is laid on (the phone's clip quad, the badge's and the card's backs); and for the
mug, `steam`: where its coffee is (centre and width, px).

A lean-in (monitor, cv, board): through cam_<id> as built, square, the whole scene drawn. The
sidecar records focalPx and `screen`: the corners of what it zooms to.

--loop k: the seat camera with the monitor showing terminal frame k, cropped to the terminal pane
plus PATCH_PAD. The sidecar records that rect, master-normalised, y down.

--patch: the seat camera at the master's resolution (framing.py) with the mover hidden, cropped
to its bounds-seat.json box plus 1.5% of the master on each side. The sidecar records that rect,
master-normalised, y down.
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

HERE = Path(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(HERE))
import flat_movers as FM  # noqa: E402
import framing  # noqa: E402
import movers as MV  # noqa: E402
import opened as OP  # noqa: E402
import render as R  # noqa: E402
import room_movers as RV  # noqa: E402
import screen_art as A  # noqa: E402
import screen_geo  # noqa: E402
from bake_logic import MOVERS as PIVOTS  # noqa: E402

LEANS = ("monitor", "cv", "board")
CLIP_END = {"kit": MV.frames(MV.KIT_OPEN_S), "phone": MV.frames(MV.PHONE_TURN_S),
            **{clip.split("_")[0]: MV.frames(c[1]) for clip, c in {**FM.CLIPS, **RV.CLIPS}.items()}}
# Square frame of the opened render, large enough that each object's crop is at least 1600 px wide,
# so the 1600 px file is a downscale, never an upscale.
SIZE = 3300
FILL = OP.FILL
PATCH_PAD = 0.015
BOUNDS = HERE.parent.parent / "content" / "scene" / "bounds-seat.json"


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--object", choices=[*PIVOTS, *LEANS], required=True)
    p.add_argument("--mode", choices=["day", "lamp"], required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--patch", action="store_true")
    p.add_argument("--loop", type=int, choices=(1, 2, 3))
    p.add_argument("--samples", type=int, default=384)
    return p.parse_args(argv)


def mover_meshes(name):
    p = bpy.data.objects[PIVOTS[name]]
    return [o for o in p.children_recursive if o.type == "MESH"]


def world_points(objs):
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for o in objs:
        ev = o.evaluated_get(deps)
        me = ev.to_mesh()
        pts += [o.matrix_world @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    return pts


def setup(scene, mode, samples):
    scene.render.engine = "CYCLES"
    R.use_gpu(scene)
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    R.set_mode(scene, mode)
    scene.cycles.samples = samples
    scene.render.resolution_percentage = 100


def opened(a, scene):
    eye, forward, up = OP.seat_axes(bpy.data.objects["cam_seat"].matrix_world)
    pivot = bpy.data.objects[PIVOTS[a.object]]
    loc, q = OP.canonical_pose(a.object, eye, forward, up)
    pivot.rotation_mode = "QUATERNION"
    pivot.rotation_quaternion = q
    pivot.location = loc
    scene.frame_set(CLIP_END[a.object])
    bpy.context.view_layer.update()

    seat = bpy.data.objects["cam_seat"]
    cam = bpy.data.objects.new("cam_opened", bpy.data.cameras.new("cam_opened"))
    scene.collection.objects.link(cam)
    cam.matrix_world = seat.matrix_world.copy()  # at the eye, looking along the seat's axis
    cam.data.sensor_fit = "VERTICAL"
    cam.data.shift_x = cam.data.shift_y = 0
    meshes = [o for o in mover_meshes(a.object) if not o.hide_render]
    # Fit the projected object: its farthest point from the frame's centre (the pivot) at FILL of
    # the half-frame, on either axis (a bounding sphere left the open kit at ~40% of the frame).
    inv = cam.matrix_world.inverted()
    reach = 0.0
    for p in world_points(meshes):
        x, y, z = inv @ p
        reach = max(reach, abs(x / z), abs(y / z))
    fov = 2 * math.atan(reach / FILL)
    cam.data.angle = fov
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = "RGBA"
    keep = set(mover_meshes(a.object))
    for o in scene.objects:
        if o.type in ("MESH", "CURVE") and o not in keep:
            o.visible_camera = False  # still lights and shadows the mover
    focal = (SIZE / 2) / math.tan(fov / 2)
    side = {"focalPx": focal, "size": SIZE, "fovDeg": math.degrees(fov)}
    screen = bpy.data.objects.get("phone_screen")
    if a.object == "phone" and screen:
        me = screen.data
        uv = me.uv_layers[0].data
        corner = {}
        for loop in me.loops:
            u, v = uv[loop.index].uv
            co = screen.matrix_world @ me.vertices[loop.vertex_index].co
            x, y, _ = world_to_camera_view(scene, cam, co)
            corner[(round(u), round(v))] = [x * SIZE, (1 - y) * SIZE]
        side["screen"] = [corner[(0, 1)], corner[(1, 1)], corner[(1, 0)], corner[(0, 0)]]
    px = lambda co: [c * SIZE for c in (lambda v: (v.x, 1 - v.y))(world_to_camera_view(scene, cam, co))]  # noqa: E731
    if a.object in FM.FACES:
        part, corners = FM.FACES[a.object]
        m = bpy.data.objects[part].matrix_world
        side["screen"] = [px(m @ Vector(c)) for c in corners]
    if a.object == "mug":
        body = bpy.data.objects["mug_body"]
        me = body.data
        coffee = {i for i, mat in enumerate(me.materials) if mat and mat.name.startswith("Coffee")}
        pts = [px(body.matrix_world @ me.vertices[v].co) for p in me.polygons if p.material_index in coffee for v in p.vertices]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        side["steam"] = {"centre": [(min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2], "width": max(xs) - min(xs)}
    return side


def lean(a, scene):
    cam = bpy.data.objects[f"cam_{a.object}"]
    scene.camera = cam
    scene.render.resolution_x = scene.render.resolution_y = SIZE
    scene.render.film_transparent = False
    scene.frame_set(0)
    fov = 2 * math.atan(cam.data.sensor_width / 2 / cam.data.lens)
    corners = screen_geo.lean_corners(bpy.context.evaluated_depsgraph_get())[a.object]
    to_px = lambda co: (lambda v: [v.x * SIZE, (1 - v.y) * SIZE])(world_to_camera_view(scene, cam, co))  # noqa: E731
    return {"focalPx": (SIZE / 2) / math.tan(fov / 2), "size": SIZE, "fovDeg": math.degrees(fov), "screen": [to_px(c) for c in corners]}


def loop(a, scene):
    import materials as M

    monitor = bpy.data.objects["obj_monitor"]
    deps = bpy.context.evaluated_depsgraph_get()
    tris, _, _ = screen_geo.screen_rect(monitor, deps)
    image = M.editor_image(a.loop)
    for o in screen_geo.screen_meshes(monitor):
        for mat in o.data.materials:
            if mat and mat.get("screen"):
                next(n for n in mat.node_tree.nodes if n.type == "TEX_IMAGE").image = image
    scene.camera = cam = bpy.data.objects[framing.CAMERA]
    w, h = framing.resolution()
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.frame_set(0)
    u0, v0, u1, v1 = A.TERMINAL
    pts = [world_to_camera_view(scene, cam, screen_geo.screen_point(tris, *A.image_uv(u, v))) for u in (u0, u1) for v in (v0, v1)]
    rect = {
        "x0": max(0.0, min(p.x for p in pts) - PATCH_PAD),
        "y0": max(0.0, min(1 - p.y for p in pts) - PATCH_PAD),
        "x1": min(1.0, max(p.x for p in pts) + PATCH_PAD),
        "y1": min(1.0, max(1 - p.y for p in pts) + PATCH_PAD),
    }
    r = scene.render
    r.use_border, r.use_crop_to_border = True, True
    r.border_min_x, r.border_max_x = rect["x0"], rect["x1"]
    r.border_min_y, r.border_max_y = 1 - rect["y1"], 1 - rect["y0"]
    return {"rect": rect, "master": [w, h]}


def patch(a, scene):
    scene.frame_set(0)
    for o in mover_meshes(a.object):
        o.hide_render = True
    scene.camera = bpy.data.objects[framing.CAMERA]
    w, h = framing.resolution()
    scene.render.resolution_x, scene.render.resolution_y = w, h
    b = json.loads(BOUNDS.read_text())["objects"][PIVOTS[a.object]]
    rect = {
        "x0": max(0.0, b["x0"] - PATCH_PAD),
        "y0": max(0.0, b["y0"] - PATCH_PAD),
        "x1": min(1.0, b["x1"] + PATCH_PAD),
        "y1": min(1.0, b["y1"] + PATCH_PAD),
    }
    r = scene.render
    r.use_border, r.use_crop_to_border = True, True
    r.border_min_x, r.border_max_x = rect["x0"], rect["x1"]
    r.border_min_y, r.border_max_y = 1 - rect["y1"], 1 - rect["y0"]  # Blender's border is y up
    return {"patch": rect, "master": [w, h]}


def main():
    a = args()
    scene = bpy.context.scene
    setup(scene, a.mode, a.samples)
    if a.loop:
        side = loop(a, scene)
    elif a.object in LEANS:
        side = lean(a, scene)
    elif a.patch:
        side = patch(a, scene)
    else:
        side = opened(a, scene)
    scene.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    with open(f"{a.out}.json", "w") as f:
        json.dump(side, f, indent=2)
    print(f"rendered {a.out}")


if __name__ == "__main__":
    main()
