"""
Renders one view of workspace.blend (M3a).

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/render.py -- \
        --mode clay|day|lamp --camera overview|phone-crop --out <png> [--samples N]

clay: one neutral grey material and a simple sun and sky, for the layout checkpoint.
"""

import argparse
import sys

import bpy


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :]
    p = argparse.ArgumentParser()
    p.add_argument("--mode", choices=["clay", "day", "lamp"], required=True)
    p.add_argument("--camera", choices=["overview", "phone-crop"], default="overview")
    p.add_argument("--out", required=True)
    p.add_argument("--samples", type=int, default=0)
    return p.parse_args(argv)


def use_gpu(scene):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"


def clay(scene):
    grey = bpy.data.materials.new("clay")
    grey.use_nodes = True
    bsdf = grey.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.62, 0.62, 0.62, 1)
    bsdf.inputs["Roughness"].default_value = 0.6
    for o in scene.objects:
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(grey)
    # The sky plane glows softly so the window reads as the light source.
    sky = bpy.data.objects.get("window_sky")
    if sky:
        glow = bpy.data.materials.new("clay_sky")
        glow.use_nodes = True
        nt = glow.node_tree
        nt.nodes.clear()
        em = nt.nodes.new("ShaderNodeEmission")
        em.inputs["Strength"].default_value = 3.0
        out = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(em.outputs[0], out.inputs[0])
        sky.data.materials.clear()
        sky.data.materials.append(glow)
    world = bpy.data.worlds.new("clay_world")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.35
    scene.world = world
    sun = bpy.data.objects.new("clay_sun", bpy.data.lights.new("clay_sun", "SUN"))
    sun.data.energy = 2.5
    sun.data.angle = 0.2
    sun.rotation_euler = (1.1, 0.0, 2.6)
    scene.collection.objects.link(sun)


# Per-mode settings: which light collection renders, the sky, screen brightness, exposure.
MODES = {
    "day": dict(world="sky_day", show="lights_day", hide="lights_lamp", screen=0.8, exposure=0.55),
    "lamp": dict(world="sky_night", show="lights_lamp", hide="lights_day", screen=1.5, exposure=0.6),
}


def set_mode(scene, mode):
    m = MODES[mode]
    scene.world = bpy.data.worlds[m["world"]]
    for name, hidden in ((m["show"], False), (m["hide"], True)):
        c = bpy.data.collections.get(name)
        if c:
            c.hide_render = hidden
    for mat in bpy.data.materials:
        if mat.get("screen") and mat.use_nodes:
            for n in mat.node_tree.nodes:
                if n.type == "BSDF_PRINCIPLED":
                    n.inputs["Emission Strength"].default_value = m["screen"]
    scene.view_settings.exposure = m["exposure"]
    try:
        scene.view_settings.look = "AgX - Medium High Contrast"
    except TypeError:
        pass


def main():
    a = args()
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    use_gpu(scene)
    scene.cycles.use_denoising = True
    scene.view_settings.view_transform = "AgX"
    portrait = a.camera == "phone-crop"
    scene.render.resolution_x, scene.render.resolution_y = (1080, 1920) if portrait else (2560, 1440)
    scene.render.resolution_percentage = 100
    scene.camera = bpy.data.objects["cam_phone_crop" if portrait else "cam_overview"]
    if a.mode == "clay":
        clay(scene)
        scene.cycles.samples = a.samples or 96
    else:
        set_mode(scene, a.mode)
        scene.cycles.samples = a.samples or 384
    scene.render.filepath = a.out
    bpy.ops.render.render(write_still=True)
    print(f"rendered {a.out}")


main()
