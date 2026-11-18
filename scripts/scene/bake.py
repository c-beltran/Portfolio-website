"""
Bakes the workspace's lighting for the live scene (M3b) and exports its geometry.

    Blender -b --factory-startup ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/bake.py -- \
        [--out-dir ~/Portfolio-assets/bake] [--glb ~/Portfolio-assets/glb/scene-raw.glb] [--samples 512] [--scale 1]

Groups of static meshes share one lightmap atlas each (one UV layout from all their faces, texel
density by area). Each group is baked once per mode (Cycles COMBINED without transmission: the
render's light, colour and a view-independent sheen) and saved through the scene's colour management
(AgX, Punchy, the mode's exposure), so an unlit texture in three.js shows the render's look.
The monitor screen bakes on its own UVs at full size (the close-up reads it). The window gets a
backdrop plane carrying the sky gradient. Glass and water are not baked (no real-time transmission,
spec §6): they export as plain meshes and the live scene fakes them.

Never saves the .blend: the scene is changed in memory only. Outputs:
  <out-dir>/<group>-<mode>.png   and   <glb> (meshes named room, desk, monitor, props, screen,
  sky, glass, water; one UV map, the bake's; placeholder materials).
"""

import argparse
import math
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import render as R  # noqa: E402  (mode settings: world, lights, screen strength, exposure)

ASSETS = Path.home() / "Portfolio-assets"
# Atlas sizes (px). The screen keeps the editor image's aspect (3440x1440).
SIZES = {"room": (1024, 1024), "desk": (2048, 2048), "monitor": (2048, 2048), "props": (2048, 2048),
         "screen": (2048, 858), "sky": (256, 256)}
HEAVY_TRIS = 50000  # decimate an imported model above this (the mouse and phone ship ~100k+; the monitor keeps its 45k)
HEAVY_TARGET = 8000


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out-dir", default=str(ASSETS / "bake"))
    p.add_argument("--glb", default=str(ASSETS / "glb" / "scene-raw.glb"))
    p.add_argument("--samples", type=int, default=512)
    p.add_argument("--scale", type=float, default=1.0, help="atlas size factor (0.25 for a quick check)")
    p.add_argument("--modes", default="day,lamp")
    return p.parse_args(argv)


def is_screen(o):
    return o.type == "MESH" and any(m and m.get("screen") and m.name.startswith("screen_monitor") for m in o.data.materials)


def top(o):
    while o.parent:
        o = o.parent
    return o


def groups():
    """Static meshes by group, from the build's names (room_*, deco_*, obj_*)."""
    scene_objs = [o for o in bpy.context.scene.objects if o.type in ("MESH", "CURVE") and not o.hide_render]
    g = {k: [] for k in ("room", "desk", "monitor", "props", "screen", "glass", "water")}
    for o in scene_objs:
        t = top(o).name
        if o.name.startswith("room_") or t == "window_frame" or o.name.startswith("window"):
            g["room"].append(o)
        elif t in ("deco_desk", "deco_mat"):
            g["desk"].append(o)
        elif t == "obj_monitor":
            g["screen" if is_screen(o) else "monitor"].append(o)
        elif t == "obj_lightbar":
            g["monitor"].append(o)
        elif t == "deco_glass":
            g["glass"].append(o)
        elif t == "deco_water_glass":
            g["water"].append(o)
        else:
            g["props"].append(o)
    for k in ("room", "desk", "monitor", "props", "screen"):
        if not g[k]:
            raise SystemExit(f"bake: group {k} is empty (object names changed?)")
    return g


def select(objs, active=None):
    bpy.ops.object.mode_set(mode="OBJECT") if bpy.context.object and bpy.context.object.mode != "OBJECT" else None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or objs[0]


def to_plain_meshes(objs):
    """Single-user meshes with modifiers applied, curves converted, no parents (world kept),
    the heavy imports decimated. Returns the resulting objects (conversion keeps the names)."""
    names = [o.name for o in objs]
    # Decimate by model (an import's meshes together): the mouse spreads ~140k tris over parts.
    tris = {o.name: sum(len(p.vertices) - 2 for p in o.data.polygons) if o.type == "MESH" else 0 for o in objs}
    per_model = {}
    for o in objs:
        per_model.setdefault(top(o).name, []).append(o.name)
    ratio = {}
    for model, members in per_model.items():
        total = sum(tris[n] for n in members)
        if total > HEAVY_TRIS:
            print(f"  decimate {model}: {total} -> ~{HEAVY_TARGET} tris")
            for n in members:
                ratio[n] = max(0.02, HEAVY_TARGET / total)
    select(objs)
    bpy.ops.object.make_single_user(object=True, obdata=True)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    out = [bpy.data.objects[n] for n in names]
    for o in out:
        if o.name in ratio and o.type == "MESH":
            o.modifiers.new("decimate", "DECIMATE").ratio = ratio[o.name]
    select(out)
    bpy.ops.object.convert(target="MESH")
    return [bpy.data.objects[n] for n in names]


def fallback_material():
    m = bpy.data.materials.get("bake_fallback") or bpy.data.materials.new("bake_fallback")
    m.use_nodes = True
    return m


def add_bake_uv(objs, unwrap=True):
    for o in objs:
        me = o.data
        if not me.materials:
            me.materials.append(fallback_material())
        for i, slot in enumerate(me.materials):
            if slot is None:
                me.materials[i] = fallback_material()
        render_uv = next((u for u in me.uv_layers if u.active_render), None)
        uv = me.uv_layers.new(name="bake")
        if not unwrap and render_uv:  # the screen bakes on its own image UVs, normalized to 0-1:
            # the model's run outside 0-1 (Blender repeats images), which quantized glTF UVs can't hold
            us = [d.uv.copy() for d in render_uv.data]
            lo_u, hi_u = min(v.x for v in us), max(v.x for v in us)
            lo_v, hi_v = min(v.y for v in us), max(v.y for v in us)
            for d, v in zip(uv.data, us):
                d.uv = ((v.x - lo_u) / (hi_u - lo_u), (v.y - lo_v) / (hi_v - lo_v))
        me.uv_layers.active = uv  # the bake target; textures keep reading active_render
        if render_uv:
            render_uv.active_render = True
    if unwrap:
        select(objs)
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0, scale_to_bounds=False)
        bpy.ops.uv.pack_islands(rotate=True, margin=0.004)
        bpy.ops.object.mode_set(mode="OBJECT")


def join_group(objs, name):
    """One mesh per group, so Cycles bakes it in one pass (it bakes each selected object
    separately). Each part's texture UVs are renamed UVMap first, so the join keeps them."""
    for o in objs:
        me = o.data
        if not me.materials:
            me.materials.append(fallback_material())
        for i, slot in enumerate(me.materials):
            if slot is None:
                me.materials[i] = fallback_material()
        keep = next((u for u in me.uv_layers if u.active_render), None) or (me.uv_layers[0] if me.uv_layers else None)
        for u in [u for u in me.uv_layers if u != keep]:
            me.uv_layers.remove(u)
        if keep is None:
            keep = me.uv_layers.new(name="UVMap")
        keep.name = "UVMap"
    select(objs)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.uv_layers["UVMap"].active_render = True
    return [o]


def target_image(objs, name, size):
    img = bpy.data.images.get(name) or bpy.data.images.new(name, *size, float_buffer=True, alpha=False)
    for o in objs:
        for m in o.data.materials:
            m.use_nodes = True
            nodes = m.node_tree.nodes
            node = nodes.get("bake_target") or nodes.new("ShaderNodeTexImage")
            node.name = "bake_target"
            node.image = img
            nodes.active = node
    return img


def sky_backdrop():
    """A plane beyond the window with the sky's gradient (the world shades by view direction;
    from the desk, a point's height over the eye line at ~2.6 m gives the same direction)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=(1.0, 1.7, 1.6), rotation=(math.radians(90), 0, 0))
    o = bpy.context.object
    o.name = "sky"
    o.scale = (6, 5, 1)
    bpy.ops.object.transform_apply(scale=True)
    for attr in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter", "visible_shadow"):
        setattr(o, attr, False)
    m = bpy.data.materials.new("sky_backdrop")
    m.use_nodes = True
    o.data.materials.append(m)
    return o


def sky_material_for(o, world):
    wt = world.node_tree
    wramp = next(n for n in wt.nodes if n.type == "VALTORGB")
    strength = next(n for n in wt.nodes if n.type == "BACKGROUND").inputs["Strength"].default_value
    nt = o.data.materials[0].node_tree
    nt.nodes.clear()
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    sub = nt.nodes.new("ShaderNodeMath")
    sub.operation, sub.inputs[1].default_value = "SUBTRACT", 1.2
    sq = nt.nodes.new("ShaderNodeMath")
    sq.operation = "MULTIPLY"
    add = nt.nodes.new("ShaderNodeMath")
    add.operation, add.inputs[1].default_value = "ADD", 2.6 ** 2
    root = nt.nodes.new("ShaderNodeMath")
    root.operation = "SQRT"
    div = nt.nodes.new("ShaderNodeMath")
    div.operation = "DIVIDE"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = wramp.color_ramp.interpolation
    els = ramp.color_ramp.elements
    while len(els) < len(wramp.color_ramp.elements):
        els.new(0.5)
    for e, w in zip(els, wramp.color_ramp.elements):
        e.position, e.color = w.position, w.color
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    L = nt.links.new
    L(geo.outputs["Position"], sep.inputs["Vector"])
    L(sep.outputs["Z"], sub.inputs[0])
    L(sub.outputs[0], sq.inputs[0])
    L(sub.outputs[0], sq.inputs[1])
    L(sq.outputs[0], add.inputs[0])
    L(add.outputs[0], root.inputs[0])
    L(sub.outputs[0], div.inputs[0])
    L(root.outputs[0], div.inputs[1])
    L(div.outputs[0], ramp.inputs["Fac"])
    L(ramp.outputs["Color"], em.inputs["Color"])
    L(em.outputs[0], out.inputs["Surface"])


def bake(objs, img, kind, filters, out_path, scene):
    select(objs)
    target_image(objs, img.name, img.size)
    t = time.time()
    bpy.ops.object.bake(type=kind, pass_filter=filters, margin=4, use_clear=True, target="IMAGE_TEXTURES")
    img.save_render(str(out_path), scene=scene)  # applies AgX, the look and the mode's exposure
    print(f"  baked {out_path.name} {img.size[0]}x{img.size[1]} in {time.time() - t:.0f}s")


def export(g, glb):
    keep = []
    for name, objs in g.items():
        if not objs:
            continue
        select(objs)
        bpy.ops.object.join()
        o = bpy.context.object
        o.name = name
        me = o.data
        if name not in ("glass", "water"):
            for u in [u for u in me.uv_layers if u.name != "bake"]:
                me.uv_layers.remove(u)
            me.uv_layers["bake"].name = "UVMap"
        me.materials.clear()
        keep.append(o)
    for o in [o for o in bpy.context.scene.objects if o not in keep]:
        bpy.data.objects.remove(o, do_unlink=True)
    Path(glb).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_yup=True, export_apply=True,
                              export_materials="NONE", export_normals=False, export_cameras=False,
                              export_lights=False, use_selection=False)
    print(f"exported {glb}: {', '.join(o.name for o in keep)}")


def main():
    a = args()
    out = Path(a.out_dir)
    out.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    R.use_gpu(scene)
    scene.cycles.samples = a.samples
    scene.view_settings.view_transform = "AgX"

    g = groups()
    for k in g:
        g[k] = join_group(to_plain_meshes(g[k]), k) if g[k] else []
    for k in ("room", "desk", "monitor", "props"):
        add_bake_uv(g[k])
    add_bake_uv(g["screen"], unwrap=False)
    sky = sky_backdrop()
    g["sky"] = [sky]
    sky.data.uv_layers[0].name = "bake"  # the plane's own UVs fill 0-1

    times = {}
    for mode in a.modes.split(","):
        R.set_mode(scene, mode)
        sky_material_for(sky, scene.world)
        for name in ("room", "desk", "monitor", "props", "screen", "sky"):
            w, h = (max(64, int(v * a.scale)) for v in SIZES[name])
            img = bpy.data.images.new(f"{name}-{mode}", w, h, float_buffer=True, alpha=False)
            if name == "sky":
                kind, filters = "EMIT", set()
            elif name == "screen":
                kind, filters = "EMIT", set()
            else:
                kind, filters = "COMBINED", {"DIRECT", "INDIRECT", "DIFFUSE", "GLOSSY", "EMIT"}
            t = time.time()
            bake(g[name], img, kind, filters, out / f"{name}-{mode}.png", scene)
            times[f"{name}-{mode}"] = round(time.time() - t)
    print("bake times (s):", times)
    export(g, a.glb)


main()
