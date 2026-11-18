"""
Projects each interactive object through the overview camera and writes content/scene/bounds.json
(M3a Task 4): normalized 0–1 boxes, y down, plus minCollisionFreeWidth (see content/scene/bounds.ts,
which re-derives it in the unit test).

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/export_bounds.py -- \
        --out content/scene/bounds.json

A report, not a gate: objects are never moved to make hotspots fit. The box is each object's
projected hull (its meshes and its children's), clipped to the frame; occlusion is not removed.
The monitor is the exception: its hotspot is its screen. The licensed model's arm, post and desk
clamp run from the top of the frame to the desk, and a box around them would cover the kit case,
badge and phone.
"""

import argparse
import json
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view

OBJECTS = ["obj_monitor", "obj_kit", "obj_phone", "obj_badge", "obj_photo", "obj_notepad", "obj_card", "obj_lightbar"]
MIN_TARGET = 44
MAX_WIDTH = 4000


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    return p.parse_args(argv)


def meshes(o):
    out = [m for m in [o, *o.children_recursive] if m.type == "MESH"]
    if o.name == "obj_monitor":
        out = [m for m in out if any(mat and mat.get("screen") for mat in m.data.materials)]
        if not out:
            raise SystemExit("obj_monitor: no mesh with a screen material")
    return out


def project(scene, cam, o, depsgraph):
    xs, ys = [], []
    for m in meshes(o):
        ev = m.evaluated_get(depsgraph)
        mesh = ev.to_mesh()
        mw = ev.matrix_world
        for v in mesh.vertices:
            p = world_to_camera_view(scene, cam, mw @ v.co)
            if p.z > 0:
                xs.append(p.x)
                ys.append(1 - p.y)
        ev.to_mesh_clear()
    if not xs:
        raise SystemExit(f"{o.name}: nothing in front of the camera")
    c = lambda v: round(min(1.0, max(0.0, v)), 5)
    return {"x0": c(min(xs)), "y0": c(min(ys)), "x1": c(max(xs)), "y1": c(max(ys))}


def grow(lo, hi):
    pad = max(0.0, MIN_TARGET - (hi - lo)) / 2
    return lo - pad, hi + pad


def colliding(boxes, width, aspect):
    h = width * aspect
    keys = sorted(boxes)
    spots = []
    for k in keys:
        b = boxes[k]
        x0, x1 = grow(b["x0"] * width, b["x1"] * width)
        y0, y1 = grow(b["y0"] * h, b["y1"] * h)
        spots.append((x0, y0, x1, y1))
    pairs = []
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, b = spots[i], spots[j]
            if a[0] < b[2] and b[0] < a[2] and a[1] < b[3] and b[1] < a[3]:
                pairs.append((keys[i], keys[j]))
    return pairs


def min_free_width(boxes, aspect):
    free = None
    for w in range(MAX_WIDTH, 0, -1):
        if colliding(boxes, w, aspect):
            break
        free = w
    return free


def main():
    a = args()
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = 2560, 1440
    scene.render.resolution_percentage = 100
    cam = bpy.data.objects["cam_overview"]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    aspect = scene.render.resolution_y / scene.render.resolution_x
    boxes = {name: project(scene, cam, bpy.data.objects[name], depsgraph) for name in OBJECTS}
    width = min_free_width(boxes, aspect)
    data = {"camera": cam.name, "aspect": aspect, "objects": boxes, "minCollisionFreeWidth": width}
    with open(a.out, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"wrote {a.out}; minCollisionFreeWidth = {width}")
    for w in (500, 720, 1024, 1440):
        print(f"  at {w}px: {colliding(boxes, w, aspect) or 'no overlaps'}")
    if width is None:
        print(f"  overlapping at every width: {colliding(boxes, MAX_WIDTH, aspect)}")


main()
