"""
Writes content/scene/cameras.json (M3b): every scene camera's eye, target, lens, sensor width and
shift, in three.js axes (Y up): Blender (x, y, z) -> three (x, z, -y). The live scene and the
Cycles clips both read it, so they frame the same.

    Blender -b --factory-startup ~/Portfolio-assets/blend/workspace.blend \
        --python scripts/scene/export_cameras.py -- --out content/scene/cameras.json
"""

import argparse
import json
import sys

import bpy
from mathutils import Vector

CAMERAS = {"overview": "cam_overview", "phone": "cam_phone", "monitor": "cam_monitor", "seat": "cam_seat"}
# The target is a point on the view axis this far ahead (the scene's targets are 1-1.5 m away).
TARGET_DISTANCE = 1.0


def three(v):
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--out", required=True)
    a = p.parse_args(argv)
    out = {}
    for key, name in CAMERAS.items():
        o = bpy.data.objects[name]
        if o.data.sensor_fit != "HORIZONTAL":
            raise SystemExit(f"{name}: expected a horizontal sensor fit")
        eye = o.matrix_world.translation
        ahead = o.matrix_world.to_quaternion() @ Vector((0, 0, -1))
        out[key] = {
            "eye": three(eye),
            "target": three(eye + ahead * TARGET_DISTANCE),
            "lens": round(o.data.lens, 4),
            "sensorWidth": round(o.data.sensor_width, 4),
            "shift": [round(o.data.shift_x, 4), round(o.data.shift_y, 4)],
        }
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"wrote {a.out}")


main()
