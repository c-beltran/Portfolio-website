"""
Projects each interactive object through a camera and writes its hotspot bounds (the site uses the
seat's, content/scene/bounds-seat.json):
normalized 0–1 boxes, y down, plus minCollisionFreeWidth (see content/scene/bounds.ts,
which re-derives it in the unit test).

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/export_bounds.py -- \
        --camera overview|phone|seat --out content/scene/bounds.json   (bounds-phone.json, bounds-seat.json)

The seat's boxes are normalised to its master (framing.py), and its monitor is split at the screen
image's midline into obj_monitor (left, How I build) and obj_cv (right, the CV page), with the right
half's corners in quads.screen_right; the patch of sky the window shows is quads.sky (its corners)
and skyUv (its place on the live desk's sky plane, sky_geo.py). --check-safe fails unless every box is inside the safe frame.

A report, not a gate: objects are never moved to make hotspots fit. The box is each object's
projected hull (its meshes and its children's), clipped to the frame; occlusion is not removed.
The monitor is the exception: its hotspot is its screen. The licensed model's arm, post and desk
clamp run from the top of the frame to the desk, and a box around them would cover the kit case,
badge and phone.
"""

import argparse
import json
import os
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import framing  # noqa: E402
from screen_geo import screen_meshes, screen_point, screen_rect  # noqa: E402
import sky_geo as SKY  # noqa: E402

OBJECTS = ["obj_monitor", "obj_kit", "obj_phone", "obj_badge", "obj_photo", "obj_notepad", "obj_card", "obj_lightbar",
           "obj_car", "obj_ball", "obj_board", "obj_mug", "obj_diploma"]  # the car, the ball, the board, the diploma
# Decoration projected for the tests only (written under "decor", never a hotspot): the plant must
# show in every window; the board must hang above the laptop.
DECOR = ["deco_plant", "deco_laptop"]
# Shown only in ultrawide windows: exempt from --check-safe.
ULTRAWIDE_ONLY = {"obj_ball"}
# Camera and still resolution per view (matching render.py).
VIEWS = {
    "overview": ("cam_overview", 2560, 1440),
    "phone": ("cam_phone", 1080, 1080),
    # The seat: boxes normalised to the master (framing.py).
    "seat": (framing.CAMERA, *framing.resolution()),
}
# --check-safe: every object inside the safe frame, inset by this share of its size on each side.
SAFE_INSET = 0.02
MIN_TARGET = 44
MAX_WIDTH = 4000


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--camera", choices=list(VIEWS), default="overview")
    p.add_argument("--out", required=True)
    p.add_argument("--check-safe", action="store_true", help="fail unless every object is inside the safe frame")
    return p.parse_args(argv)


def meshes(o):
    if o.name == "obj_monitor":
        return screen_meshes(o)
    return [m for m in [o, *o.children_recursive] if m.type == "MESH"]


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


def to_frame(scene, cam, p):
    """A world point in the frame, normalised, y down."""
    q = world_to_camera_view(scene, cam, p)
    return q.x, 1 - q.y


def monitor_halves(scene, cam, o, depsgraph):
    """The screen split at the image's midline (materials.py: the right half is the CV page):
    boxes for the left half (obj_monitor) and the right (obj_cv), and the right half's corners
    (top-left, top-right, bottom-right, bottom-left), normalised to the frame."""
    tris, (u0, u1, v0, v1), eps = screen_rect(o, depsgraph)
    print(f"  monitor screen: UV rectangle inset by {eps}")
    c = lambda x: round(min(1.0, max(0.0, x)), 5)

    def box(ua, ub, n=24):
        pts = [to_frame(scene, cam, screen_point(tris, ua + (ub - ua) * i / n, v0 + (v1 - v0) * j / n))
               for i in range(n + 1) for j in range(n + 1)]
        return {"x0": c(min(x for x, _ in pts)), "y0": c(min(y for _, y in pts)),
                "x1": c(max(x for x, _ in pts)), "y1": c(max(y for _, y in pts))}

    # Which UV edge is the screen's top: the licensed model's v runs either way.
    y_at = lambda v: to_frame(scene, cam, screen_point(tris, 0.5, v))[1]
    top, bottom = (v1, v0) if y_at(v1) < y_at(v0) else (v0, v1)
    corners = [(0.5, top), (u1, top), (u1, bottom), (0.5, bottom)]
    quad = [[c(x), c(y)] for x, y in (to_frame(scene, cam, screen_point(tris, u, v)) for u, v in corners)]
    if not quad[0][0] < quad[1][0]:
        raise SystemExit(f"monitor screen: the image runs right to left in the frame: {quad}")
    # The curved screen's midline leans a little in the frame: the halves meet at its mean x, so
    # the two hotspots share an edge instead of overlapping by a sliver.
    left, right = box(u0, 0.5), box(0.5, u1)
    mid = c((quad[0][0] + quad[3][0]) / 2)
    left["x1"], right["x0"] = mid, mid
    return left, right, quad


def sky_patch(scene, cam):
    """The patch of the sky plane the window shows in the seat's frame (sky_geo.py): its corners in the
    frame (top-left, top-right, bottom-right, bottom-left; they may reach past the frame) and its
    place on the plane's UVs."""
    from mathutils import Vector

    parts = [c for c in bpy.data.objects["window_frame"].children_recursive if c.type == "MESH"]
    pts = [c.matrix_world @ Vector(v) for c in parts for v in c.bound_box]
    x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
    z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
    y = sum(p.y for p in pts) / len(pts)
    opening = [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)]
    view = [tuple(cam.matrix_world @ p) for p in cam.data.view_frame(scene=scene)]
    patch = SKY.window_patch(tuple(cam.matrix_world.translation), opening, view)
    r = lambda v: round(v, 5)
    quad = [[r(fx), r(fy)] for fx, fy in (to_frame(scene, cam, Vector(p)) for p in SKY.patch_corners(patch))]
    return quad, SKY.patch_uv(patch)


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


def check_safe(boxes):
    """Exit non-zero unless every box lies inside the safe frame, inset by SAFE_INSET."""
    _, _, safe = framing.master()
    dx = (safe["x1"] - safe["x0"]) * SAFE_INSET
    dy = (safe["y1"] - safe["y0"]) * SAFE_INSET
    lo_x, lo_y, hi_x, hi_y = safe["x0"] + dx, safe["y0"] + dy, safe["x1"] - dx, safe["y1"] - dy
    bad = [k for k, b in boxes.items() if k not in ULTRAWIDE_ONLY and (b["x0"] < lo_x or b["y0"] < lo_y or b["x1"] > hi_x or b["y1"] > hi_y)]
    to_safe = lambda v, lo, hi: (v - lo) / (hi - lo)
    for k, b in boxes.items():
        print(f"  {k:14s} in safe frame: x {to_safe(b['x0'], safe['x0'], safe['x1']):+.3f}..{to_safe(b['x1'], safe['x0'], safe['x1']):+.3f}"
              f"  y {to_safe(b['y0'], safe['y0'], safe['y1']):+.3f}..{to_safe(b['y1'], safe['y0'], safe['y1']):+.3f}")
    if bad:
        raise SystemExit(f"outside the safe frame (inset {SAFE_INSET:.0%}): {', '.join(bad)}")
    print("all objects inside the safe frame")


def main():
    a = args()
    scene = bpy.context.scene
    cam_name, scene.render.resolution_x, scene.render.resolution_y = VIEWS[a.camera]
    scene.render.resolution_percentage = 100
    cam = bpy.data.objects[cam_name]
    depsgraph = bpy.context.evaluated_depsgraph_get()
    aspect = scene.render.resolution_y / scene.render.resolution_x
    boxes = {name: project(scene, cam, bpy.data.objects[name], depsgraph) for name in OBJECTS}
    quads = None
    if a.camera == "seat":
        # The seat's monitor is two hotspots: How I build (left) and the CV page (right).
        boxes["obj_monitor"], boxes["obj_cv"], right = monitor_halves(scene, cam, bpy.data.objects["obj_monitor"], depsgraph)
        sky, sky_uv = sky_patch(scene, cam)
        quads = {"screen_right": right, "sky": sky}
    width = min_free_width(boxes, aspect)
    data = {"camera": cam.name, "aspect": aspect, "objects": boxes, "minCollisionFreeWidth": width}
    if quads:
        data["quads"] = quads
        data["skyUv"] = sky_uv
    if a.camera == "seat":
        data["decor"] = {name: project(scene, cam, bpy.data.objects[name], depsgraph) for name in DECOR}
    with open(a.out, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"wrote {a.out}; minCollisionFreeWidth = {width}")
    if a.check_safe:
        if a.camera != "seat":
            raise SystemExit("--check-safe applies to the seat camera only")
        check_safe(boxes)
    # Report widths: for the seat, master widths at the narrowest wide window (500×416), a 320×480
    # portrait window and a 1080p one.
    report = {"phone": (320, 360, 390, 430), "seat": (1111, 1707, 3840)}.get(a.camera, (500, 720, 1024, 1440))
    for w in report:
        print(f"  at {w}px: {colliding(boxes, w, aspect) or 'no overlaps'}")
    if width is None:
        print(f"  overlapping at every width: {colliding(boxes, MAX_WIDTH, aspect)}")


main()
