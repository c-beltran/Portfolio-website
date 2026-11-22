"""
Renders the live scene's reflection probe: an equirectangular Cycles panorama from
above the desk's centre, per mode, through the same colour management as the bakes. The live
shader looks it up along the reflected view ray for the desk's sheen and the phone's glass (Cycles
bakes are view-independent).

    Blender -b --factory-startup ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/probe.py -- \
        [--out-dir ~/Portfolio-assets/bake] [--samples 256] [--modes day,lamp]

The camera looks along +Y (towards the window wall), up +Z: the image centre is +Y, its top is up.
Never saves the .blend. Outputs
<out-dir>/probe-<mode>.png at 1024x512.
"""

import argparse
import math
import sys
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import render as R  # noqa: E402

ASSETS = Path.home() / "Portfolio-assets"
AT = (0.0, 0.15, 0.95)  # metres, Blender axes: over the desk's centre, 20 cm above the top
SIZE = (1024, 512)
HIDE = ()  # the drinking glass and its water are gone


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out-dir", default=str(ASSETS / "bake"))
    p.add_argument("--samples", type=int, default=256)
    p.add_argument("--modes", default="day,lamp")
    return p.parse_args(argv)


def top(o):
    while o.parent:
        o = o.parent
    return o


def main():
    a = args()
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    R.use_gpu(scene)
    scene.cycles.samples = a.samples
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    scene.render.resolution_x, scene.render.resolution_y = SIZE
    scene.render.resolution_percentage = 100
    for o in scene.objects:
        if top(o).name in HIDE:
            o.hide_render = True

    cam = bpy.data.objects.new("cam_probe", bpy.data.cameras.new("cam_probe"))
    scene.collection.objects.link(cam)
    cam.location = AT
    cam.rotation_euler = (math.radians(90), 0, 0)
    cam.data.type = "PANO"
    cam.data.panorama_type = "EQUIRECTANGULAR"
    scene.camera = cam

    for mode in a.modes.split(","):
        R.set_mode(scene, mode)
        scene.render.filepath = str(out / f"probe-{mode}.png")
        bpy.ops.render.render(write_still=True)
        print(f"probe {mode}: {scene.render.filepath}")


main()
