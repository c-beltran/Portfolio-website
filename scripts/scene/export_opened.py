"""
Writes content/scene/opened-poses.json: each mover's opened pose (opened.canonical_pose, the one
the bake and the opened renders use), in three.js axes, with its clip, plus the seat's eye and
forward it was made for. The live scene's presentPose turns that pose to wherever the panel's
slot puts the object (design 2026-11-19 §4.1).

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/export_opened.py -- \
        --out content/scene/opened-poses.json
"""

import argparse
import json
import os
import sys

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import movers as MV  # noqa: E402
import opened as OP  # noqa: E402

CLIPS = {"kit": ("kit_open", MV.KIT_OPEN_S), "phone": ("phone_turn", MV.PHONE_TURN_S)}


def r(v):
    return [round(x, 6) for x in v]


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="content/scene/opened-poses.json")
    a = p.parse_args(argv)
    eye, forward, up = OP.seat_axes(bpy.data.objects["cam_seat"].matrix_world)
    out = {}
    for name, (clip, seconds) in CLIPS.items():
        loc, q = OP.canonical_pose(name, eye, forward, up)
        out[name] = {
            "pose": {"position": r(OP.to_three(loc)), "quaternion": r(OP.quat_to_three(q))},
            "d0": OP.PRESENT[name]["d0"],
            "clip": clip,
            "clipMs": round(seconds * 1000),
        }
    out["eye"] = r(OP.to_three(eye))
    out["forward"] = r(OP.to_three(forward))
    out["up"] = r(OP.to_three(up))
    with open(a.out, "w") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    print(f"wrote {a.out}")


main()
