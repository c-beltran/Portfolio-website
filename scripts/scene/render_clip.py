"""
Renders a camera transition as frames (M3b live-vs-clips test): from one scene camera to another,
easing out (easeOutCubic) over N frames. Eye, target, horizontal field of view and lens shift are
interpolated exactly as the live scene does (components/lab: lerpLookAt with the same curve).

    Blender -b --factory-startup ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/render_clip.py -- \
        --from overview --to monitor --frames 54 --res 1920 1080 --out ~/Portfolio-assets/clips/overview-monitor [--samples 128] [--mode day]
"""

import argparse
import math
import sys
import time
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import render as R  # noqa: E402

TARGET_DISTANCE = 1.0  # as export_cameras.py


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--from", dest="src", required=True)
    p.add_argument("--to", dest="dst", required=True)
    p.add_argument("--frames", type=int, default=54)
    p.add_argument("--res", type=int, nargs=2, default=[1920, 1080])
    p.add_argument("--samples", type=int, default=128)
    p.add_argument("--mode", default="day")
    p.add_argument("--out", required=True)
    return p.parse_args(argv)


def ease_out_cubic(t):
    return 1 - (1 - t) ** 3


def pose(name):
    o = bpy.data.objects[f"cam_{name}"]
    eye = o.matrix_world.translation.copy()
    target = eye + (o.matrix_world.to_quaternion() @ Vector((0, 0, -1))) * TARGET_DISTANCE
    hfov = 2 * math.atan(o.data.sensor_width / 2 / o.data.lens)
    return eye, target, hfov, (o.data.shift_x, o.data.shift_y)


def main():
    a = args()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    R.use_gpu(scene)
    scene.cycles.use_denoising = True
    scene.cycles.samples = a.samples
    scene.view_settings.view_transform = "AgX"
    R.set_mode(scene, a.mode)
    scene.render.resolution_x, scene.render.resolution_y = a.res
    scene.render.resolution_percentage = 100
    cam = bpy.data.objects.new("cam_clip", bpy.data.cameras.new("cam_clip"))
    scene.collection.objects.link(cam)
    cam.data.sensor_fit = "HORIZONTAL"
    cam.data.sensor_width = 36
    scene.camera = cam
    e0, t0, h0, s0 = pose(a.src)
    e1, t1, h1, s1 = pose(a.dst)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    start = time.time()
    for i in range(a.frames):
        k = ease_out_cubic(i / (a.frames - 1))
        eye, target = e0.lerp(e1, k), t0.lerp(t1, k)
        cam.location = eye
        cam.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()
        cam.data.lens = 36 / 2 / math.tan((h0 + (h1 - h0) * k) / 2)
        cam.data.shift_x = s0[0] + (s1[0] - s0[0]) * k
        cam.data.shift_y = s0[1] + (s1[1] - s0[1]) * k
        scene.render.filepath = str(out / f"frame_{i:03d}.png")
        bpy.ops.render.render(write_still=True)
    n = a.frames
    print(f"rendered {n} frames to {out} in {time.time() - start:.0f}s ({(time.time() - start) / n:.1f}s/frame)")


main()
