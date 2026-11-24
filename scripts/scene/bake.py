"""
Bakes the workspace's lighting for the live scene and exports its geometry.

    Blender -b --factory-startup ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/bake.py -- \
        [--out-dir ~/Portfolio-assets/bake] [--glb ~/Portfolio-assets/glb/scene-raw.glb] [--samples 512] [--scale 1]

Groups of static meshes share one lightmap atlas each (one UV layout from all their faces, texel
density by area). Each group is baked once per mode (Cycles COMBINED without transmission: the
render's light, colour and a view-independent sheen) and saved through the scene's colour management
(AgX, Punchy, the mode's exposure), so an unlit texture in three.js shows the render's look.
The monitor screen bakes on its own UVs at full size (the close-up reads it). The window gets a
backdrop plane carrying the sky gradient.

The movers (the kit case and the phone, which come forward) bake on their
own: each rigid part becomes one mesh under its pivot (kit_base and kit_lid; phone_body), one bake
UV is packed across a mover's parts, and each mover is baked twice per mode: at rest (frame 0),
and in its opened pose (opened.canonical_pose in front of the seat, its clip at the last frame),
one mover at a time. They export to their own GLB with the hierarchy and the clips.

Never saves the .blend: the scene is changed in memory only. Outputs:
  <out-dir>/<group>-<mode>.png, <out-dir>/<mover>-open-<mode>.png,
  <glb> (meshes named room, desk, monitor, props, screen, sky; one UV map, the
  bake's; placeholder materials) and <movers-glb> (obj_kit › kit_base, kit_lid; obj_phone ›
  phone_spin › phone_body, phone_screen; the clips kit_open and phone_turn; no materials).
"""

import argparse
import math
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import movers as MV  # noqa: E402
import opened as OP  # noqa: E402
import render as R  # noqa: E402  (mode settings: world, lights, screen strength, exposure)
from bake_logic import GROUPS, MOVERS, backdrop_covers, group_for, lift_for  # noqa: E402

ASSETS = Path.home() / "Portfolio-assets"
# Atlas sizes (px). The screen keeps the editor image's aspect (3440x1440).
SIZES = {"room": (1024, 1024), "desk": (2048, 2048), "monitor": (2048, 2048), "props": (2048, 2048),
         "screen": (2048, 858), "sky": (256, 256), "kit": (1024, 1024), "phone": (512, 512)}
# The movers opened, close to the eye: on demand (public/opened/bake), not the first load.
OPEN_SIZES = {"kit": (2048, 2048), "phone": (1024, 1024)}
# Each mover's rigid parts: one mesh each, under the part's parent (an Empty part takes its parent's
# origin). kit_lid keeps its hinge origin and the clip kit_open.
PARTS = {"kit": ("kit_base", "kit_lid"), "phone": ("phone_body",)}
CLIP_END = {"kit": MV.frames(MV.KIT_OPEN_S), "phone": MV.frames(MV.PHONE_TURN_S)}
HEAVY_TRIS = 50000  # decimate an imported model above this (the mouse and phone ship ~100k+; the monitor keeps its 45k)
HEAVY_TARGET = 8000


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out-dir", default=str(ASSETS / "bake"))
    p.add_argument("--glb", default=str(ASSETS / "glb" / "scene-raw.glb"))
    p.add_argument("--movers-glb", default=str(ASSETS / "glb" / "movers-raw.glb"))
    p.add_argument("--samples", type=int, default=512)
    p.add_argument("--scale", type=float, default=1.0, help="atlas size factor (0.25 for a quick check)")
    p.add_argument("--modes", default="day,lamp")
    p.add_argument("--skip-gloss", action="store_true")
    return p.parse_args(argv)


def is_screen(o):
    return o.type == "MESH" and any(m and m.get("screen") and m.name.startswith("screen_monitor") for m in o.data.materials)


def top(o):
    while o.parent:
        o = o.parent
    return o


def groups():
    """Static meshes by group, from the build's names (bake_logic.group_for)."""
    scene_objs = [o for o in bpy.context.scene.objects if o.type in ("MESH", "CURVE") and not o.hide_render]
    g = {k: [] for k in GROUPS}
    for o in scene_objs:
        k = group_for(o.name, top(o).name, is_screen(o))
        if k is not None:
            g[k].append(o)
    for k in ("room", "desk", "monitor", "props", "screen"):
        if not g[k]:
            raise SystemExit(f"bake: group {k} is empty (object names changed?)")
    return g


def lift(objs):
    """Separate faces that share a plane (bake_logic.LIFTS): in memory only, the still is untouched."""
    for o in objs:
        if lift_for(o.name):
            o.location.z += lift_for(o.name)
            print(f"  lift {o.name} {lift_for(o.name) * 1000:.1f} mm")


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


def one_texture_uv(objs):
    """Before a join: every slot has a material, and each mesh keeps one texture UV map, named
    UVMap, so the join keeps them all."""
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


def join_group(objs, name):
    """One mesh per group, so Cycles bakes it in one pass (it bakes each selected object
    separately)."""
    one_texture_uv(objs)
    select(objs)
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    o.data.uv_layers["UVMap"].active_render = True
    return [o]


def merged_mesh(objs, frame, name):
    """One mesh of objs (modifiers applied), in the local space of a frame (its world matrix)."""
    deps = bpy.context.evaluated_depsgraph_get()
    inv = frame.inverted()
    tmp = []
    for o in objs:
        me = bpy.data.meshes.new_from_object(o.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
        me.transform(inv @ o.matrix_world)
        t = bpy.data.objects.new(f"tmp_{o.name}", me)
        bpy.context.scene.collection.objects.link(t)
        tmp.append(t)
    one_texture_uv(tmp)
    select(tmp, tmp[0])
    bpy.ops.object.join()
    j = bpy.context.object
    me = j.data
    me.name = name
    bpy.data.objects.remove(j, do_unlink=True)
    return me


def prepare_movers():
    """Each mover's rigid parts as one mesh each, kept under their parents (PARTS); the heavy
    import decimated as to_plain_meshes does. Returns {mover: [part objects]}."""
    bpy.context.view_layer.update()
    out = {}
    for mover, parts in PARTS.items():
        out[mover] = []
        for name in parts:
            root = bpy.data.objects[name]
            under = [root, *root.children_recursive]
            meshes = [o for o in under if o.type in ("MESH", "CURVE") and not o.hide_render]
            tris = sum(len(p.vertices) - 2 for o in meshes if o.type == "MESH" for p in o.data.polygons)
            if tris > HEAVY_TRIS:
                print(f"  decimate {name}: {tris} -> ~{HEAVY_TARGET} tris")
                for o in meshes:
                    o.modifiers.new("decimate", "DECIMATE").ratio = max(0.02, HEAVY_TARGET / tris)
            if root.type == "MESH":
                me = merged_mesh(meshes, root.matrix_world.copy(), name)
                for o in root.children_recursive:
                    bpy.data.objects.remove(o, do_unlink=True)
                root.modifiers.clear()
                root.data = me
                part = root
            else:  # an Empty over an imported model: a new mesh in its parent's frame
                par = root.parent
                me = merged_mesh(meshes, par.matrix_world.copy(), name)
                for o in [o for o in under]:
                    bpy.data.objects.remove(o, do_unlink=True)
                part = bpy.data.objects.new(name, me)
                for c in par.users_collection:
                    c.objects.link(part)
                part.parent = par
            out[mover].append(part)
            print(f"  mover part {name}: {len(part.data.polygons)} faces")
    return out


class joined_copy:
    """A temporary single mesh of objs at their current world poses, for one bake pass (they share
    the bake UV; baking them as separate objects would let one's margin overwrite the other)."""

    def __init__(self, objs):
        self.objs = objs

    def __enter__(self):
        bpy.context.view_layer.update()
        copies = []
        for o in self.objs:
            c = o.copy()
            c.data = o.data.copy()
            c.animation_data_clear()
            c.parent = None
            c.matrix_world = o.matrix_world.copy()
            bpy.context.scene.collection.objects.link(c)
            copies.append(c)
        for o in self.objs:
            o.hide_render = True  # the original stays out of its own copy's light
        select(copies, copies[0])
        bpy.ops.object.join()
        self.tmp = bpy.context.object
        self.tmp.data.uv_layers.active = self.tmp.data.uv_layers["bake"]
        return self.tmp

    def __exit__(self, *exc):
        bpy.data.objects.remove(self.tmp, do_unlink=True)
        for o in self.objs:
            o.hide_render = False


def pose_open(mover, eye, forward, up):
    """Put a mover in its opened pose (pivot at opened.canonical_pose, its clip at the last frame).
    Returns a function that puts it back."""
    scene = bpy.context.scene
    pivot = bpy.data.objects[MOVERS[mover]]
    saved = (pivot.location.copy(), pivot.rotation_mode, pivot.rotation_euler.copy(), pivot.rotation_quaternion.copy())
    loc, q = OP.canonical_pose(mover, eye, forward, up)
    pivot.rotation_mode = "QUATERNION"
    pivot.rotation_quaternion = q
    pivot.location = loc
    scene.frame_set(CLIP_END[mover])

    def restore():
        pivot.location, pivot.rotation_mode, pivot.rotation_euler, pivot.rotation_quaternion = saved
        scene.frame_set(0)
        bpy.context.view_layer.update()

    return restore


def seat():
    """The seat camera's eye, forward and up (Blender axes): the opened poses sit in front of it."""
    return OP.seat_axes(bpy.data.objects["cam_seat"].matrix_world)


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


# The frame each camera renders (export_cameras.py, stills): what world_to_camera_view projects into.
FRAMES = {"cam_overview": (2560, 1440), "cam_phone": (1080, 1080), "cam_monitor": (2560, 1440)}


def window_corners():
    """The window opening (the frame's outer bounds, in its plane), read before the room is joined."""
    from mathutils import Vector

    frame = bpy.data.objects["window_frame"]
    parts = [c for c in frame.children_recursive if c.type == "MESH"]
    pts = [c.matrix_world @ Vector(v) for c in parts for v in c.bound_box]
    x0, x1 = min(p.x for p in pts), max(p.x for p in pts)
    z0, z1 = min(p.z for p in pts), max(p.z for p in pts)
    y = sum(p.y for p in pts) / len(pts)
    return [Vector((x0, y, z0)), Vector((x1, y, z0)), Vector((x1, y, z1)), Vector((x0, y, z1))]


def check_backdrop(sky, scene, window):
    """The backdrop must fill the window opening in every camera, or the bake shows its edge."""
    from bpy_extras.object_utils import world_to_camera_view

    plane = [sky.matrix_world @ v.co for v in sky.data.vertices]
    plane = [plane[i] for i in (0, 1, 3, 2)]  # primitive plane vertex order -> a loop
    res = (scene.render.resolution_x, scene.render.resolution_y, scene.camera)
    try:
        for name, (w, h) in FRAMES.items():
            cam = bpy.data.objects[name]
            scene.render.resolution_x, scene.render.resolution_y = w, h
            proj = lambda ps: [tuple(world_to_camera_view(scene, cam, p))[:2] for p in ps]  # noqa: E731
            if not backdrop_covers(proj(window), proj(plane)):
                raise SystemExit(f"bake: the sky backdrop does not fill the window from {name}")
            print(f"  backdrop covers the window from {name}")
    finally:
        scene.render.resolution_x, scene.render.resolution_y, scene.camera = res


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


# Roughness masks (Non-Color): the live shader's reflection probe term reads them on the bake UVs.
GLOSS = {"desk": (512, 512)}  # the props' probe term measured worse than none (LiveScene GLOSSY)


def bake_roughness(objs, name, size, out_path):
    """Cycles ROUGHNESS bake into the group's atlas, written as raw 8-bit values (no view transform)."""
    hdr = bpy.data.images.new(f"rough-{name}", *size, float_buffer=True, alpha=False)
    select(objs)
    target_image(objs, hdr.name, hdr.size)
    bpy.ops.object.bake(type="ROUGHNESS", margin=4, use_clear=True, target="IMAGE_TEXTURES")
    img = bpy.data.images.new(f"gloss-{name}", *size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(list(hdr.pixels))
    img.filepath_raw = str(out_path)
    img.file_format = "PNG"
    img.save()
    print(f"  baked {out_path.name} {size[0]}x{size[1]}")


def export_movers(movers, glb):
    """The movers on their own: pivots, parts and phone_screen, with the clips. The parts keep only
    the bake UV (as UVMap); phone_screen keeps its own 0-1 UV for the clip."""
    keep = []
    for mover, pivot in MOVERS.items():
        p = bpy.data.objects[pivot]
        keep += [p, *p.children_recursive]
    for o in keep:
        if o.type != "MESH":
            continue
        me = o.data
        if "bake" in me.uv_layers:
            for u in [u for u in me.uv_layers if u.name != "bake"]:
                me.uv_layers.remove(u)
            me.uv_layers["bake"].name = "UVMap"
        me.materials.clear()
    bpy.context.scene.frame_set(0)
    select(keep)
    Path(glb).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(glb), export_format="GLB", export_yup=True, export_apply=True,
                              export_materials="NONE", export_normals=False, export_cameras=False,
                              export_lights=False, use_selection=True, export_animations=True,
                              export_animation_mode="ACTIONS", export_force_sampling=True)
    print(f"exported {glb}: {', '.join(o.name for o in keep)}")


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

    scene.frame_set(0)
    window = window_corners()
    g = groups()
    for k in MOVERS:
        g.pop(k)
    movers = prepare_movers()
    eye, forward, up = seat()
    lift([o for objs in g.values() for o in objs])
    for k in g:
        g[k] = join_group(to_plain_meshes(g[k]), k) if g[k] else []
    for k in ("room", "desk", "monitor", "props"):
        add_bake_uv(g[k])
    add_bake_uv(g["screen"], unwrap=False)
    for parts in movers.values():
        add_bake_uv(parts)
    sky = sky_backdrop()
    check_backdrop(sky, scene, window)
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
        combined = {"DIRECT", "INDIRECT", "DIFFUSE", "GLOSSY", "EMIT"}
        for mover, parts in movers.items():
            for tag, sizes in (("", SIZES), ("-open", OPEN_SIZES)):
                w, h = (max(64, int(v * a.scale)) for v in sizes[mover])
                img = bpy.data.images.new(f"{mover}{tag}-{mode}", w, h, float_buffer=True, alpha=False)
                restore = pose_open(mover, eye, forward, up) if tag else (lambda: None)
                t = time.time()
                with joined_copy(parts) as tmp:
                    bake([tmp], img, "COMBINED", combined, out / f"{mover}{tag}-{mode}.png", scene)
                restore()
                times[f"{mover}{tag}-{mode}"] = round(time.time() - t)
    print("bake times (s):", times)
    if not a.skip_gloss:
        for name, size in GLOSS.items():
            bake_roughness(g[name], name, tuple(max(64, int(v * a.scale)) for v in size), out / f"gloss-{name}.png")
    export_movers(movers, a.movers_glb)
    export(g, a.glb)


main()
