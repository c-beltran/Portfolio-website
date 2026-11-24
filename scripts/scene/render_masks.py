"""
Renders a silhouette mask of each clickable object from the seat, for the hover glow,
which follows the object's shape:

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/render_masks.py -- \
        [--out ~/Portfolio-assets/renders/masks]

Workbench, flat: the object white, everything else black (so what stands in front of it cuts it,
as on the still), at a quarter of the master's resolution (framing.py). The monitor's screen is one
mask, mask-screen.png; encode_glow.mjs splits it into its two halves (How I build, the CV). The window's
sky is mask-sky.png, for the weather (encode_sky.mjs). Writes mask-<item>.png (--only <item> for one). Never saves the .blend.
"""

import argparse
import os
import sys
from pathlib import Path

import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import framing  # noqa: E402

ITEMS = {
    "kit": "obj_kit",
    "phone": "obj_phone",
    "badge": "obj_badge",
    "photo": "obj_photo",
    "notepad": "obj_notepad",
    "card": "obj_card",
    "lightbar": "obj_lightbar",
    # the room
    "car": "obj_car",
    "ball": "obj_ball",
    "board": "obj_board",
    "mug": "obj_mug",  # Coffee
}


def is_screen(o):
    return o.type == "MESH" and any(m and m.get("screen") and m.name.startswith("screen_monitor") for m in o.data.materials)


def main():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(Path.home() / "Portfolio-assets" / "renders" / "masks"))
    p.add_argument("--only", help="render just this mask (an item, screen or sky)")
    a = p.parse_args(argv)
    Path(a.out).mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light = "FLAT"
    sh.color_type = "OBJECT"
    scene.display.render_aa = "16"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.render.dither_intensity = 0  # no ±1 noise on the black: clean masks compress to nothing
    scene.camera = bpy.data.objects[framing.CAMERA]
    w, h = framing.resolution()
    scene.render.resolution_x, scene.render.resolution_y = w // 4, h // 4
    scene.render.resolution_percentage = 100
    scene.frame_set(0)
    meshes = [o for o in scene.objects if o.type in ("MESH", "CURVE") and not o.hide_render]
    targets = {item: set([bpy.data.objects[name], *bpy.data.objects[name].children_recursive]) for item, name in ITEMS.items()}
    targets["screen"] = {o for o in meshes if is_screen(o)}
    # The window's sky: everything black, so the only see-through pixels are the window's, with the
    # frame, monitor, light bar and plant cutting them as on the still (the room is closed; the sky
    # is the world). encode_sky.mjs reads it from the alpha.
    targets["sky"] = set()
    if a.only:
        targets = {a.only: targets[a.only]}
    for item, mine in targets.items():
        if not mine and item != "sky":
            raise SystemExit(f"render_masks: nothing for {item}")
        for o in meshes:
            o.color = (1, 1, 1, 1) if o in mine else (0, 0, 0, 1)
        scene.render.filepath = str(Path(a.out) / f"mask-{item}.png")
        bpy.ops.render.render(write_still=True)
        print(f"mask {item}")


main()
