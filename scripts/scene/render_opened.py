"""
Renders an object that comes forward (design 2026-11-19 §5.5: "each object also gets a Cycles render
in its opened pose, so Tier 1 visitors see the same art when they click"), or the patch that hides
it on the seat still while it is out.

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/render_opened.py -- \
        --object kit|phone --mode day|lamp --out <png> [--patch] [--samples 384]

Opened (the default): the mover's pivot at opened.canonical_pose and its clip at the last frame;
the camera at the seat's eye, turned as the seat camera is (so it looks straight at the pivot),
its field of view putting the opened object's farthest projected point at 80% of the half-frame. Every other
object still lights and shadows it but isn't drawn (film transparent). The sidecar <png>.json
records focalPx (the frame's focal length in px), and for the phone `screen`: its clip quad's
corners in px, TL TR BR BL as the clip shows (by the quad's UVs).

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
import framing  # noqa: E402
import movers as MV  # noqa: E402
import opened as OP  # noqa: E402
import render as R  # noqa: E402

PIVOTS = {"kit": "obj_kit", "phone": "obj_phone"}
CLIP_END = {"kit": MV.frames(MV.KIT_OPEN_S), "phone": MV.frames(MV.PHONE_TURN_S)}
# Square frame of the opened render, large enough that each object's crop is at least 1600 px wide,
# so the 1600 px file is a downscale, never an upscale.
SIZE = 3300
FILL = 0.8
PATCH_PAD = 0.015
BOUNDS = HERE.parent.parent / "content" / "scene" / "bounds-seat.json"


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--object", choices=list(PIVOTS), required=True)
    p.add_argument("--mode", choices=["day", "lamp"], required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--patch", action="store_true")
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
    return side


def patch(a, scene):
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
    side = patch(a, scene) if a.patch else opened(a, scene)
    scene.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    with open(f"{a.out}.json", "w") as f:
        json.dump(side, f, indent=2)
    print(f"rendered {a.out}")


if __name__ == "__main__":
    main()
