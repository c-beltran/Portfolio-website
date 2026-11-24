"""
Builds Carlos's workspace scene headlessly.

    Blender -b --factory-startup --python scripts/scene/build_scene.py -- --out ~/Portfolio-assets/blend/workspace.blend

Units are metres. +X is right, +Y is away from the camera (towards the wall), +Z is up.
The desk top is at z = DESK_TOP. Interactive objects are named obj_*; decoration deco_*.
Complex objects (keyboard, laptop, monitor, mouse, mug, phone) are imported from glTF
downloads pinned by sha256 in assets.json (checked by pins.py; the build stops on a missing or
changed download). With --allow-proxy, a missing download becomes a true-size proxy block
(named proxy_*), for reviewing layout and cameras only.
"""

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import flat_movers as FM  # noqa: E402
import room as RM  # noqa: E402  (where the car, the plant, the ball and the board go)
ASSETS_DIR = Path.home() / "Portfolio-assets"
DESK_TOP = 0.75


def args():
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(ASSETS_DIR / "blend" / "workspace.blend"))
    p.add_argument("--allow-proxy", action="store_true", help="stand in a block for a missing download")
    return p.parse_args(argv)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def collection(name):
    c = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(c)
    return c


def box(name, size, loc, coll, rot=(0, 0, 0), bevel=0.002):
    """A bevelled box: size (x, y, z) in metres, loc is the centre of its base."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Origin stays at the box centre, with rotation kept on the object (they animate).
    o.location = (loc[0], loc[1], loc[2] + size[2] / 2)
    o.rotation_euler = [math.radians(a) for a in rot]
    if bevel:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 3
        m.limit_method = "ANGLE"
    move_to(o, coll)
    return o


def cylinder(name, r, h, loc, coll, rot=(0, 0, 0), verts=48, bevel=0.0015):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts)
    o = bpy.context.active_object
    o.name = name
    o.location = (loc[0], loc[1], loc[2] + h / 2)
    o.rotation_euler = [math.radians(a) for a in rot]
    if bevel:
        m = o.modifiers.new("bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
        m.limit_method = "ANGLE"
    move_to(o, coll)
    return o


def plane(name, size, loc, coll, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.location = loc
    o.rotation_euler = [math.radians(a) for a in rot]
    move_to(o, coll)
    return o


def move_to(o, coll):
    for c in o.users_collection:
        c.objects.unlink(o)
    coll.objects.link(o)


def set_parent(child, par):
    """Attach without moving: keep the child's world transform."""
    bpy.context.view_layer.update()
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def parent(children, name, coll):
    e = bpy.data.objects.new(name, None)
    coll.objects.link(e)
    for c in children:
        set_parent(c, e)
    return e


# ---------------------------------------------------------------- room

def build_room(coll):
    # Floor and the back wall (left part, plain); the window fills the right part.
    plane("room_floor", (4.6, 3.6), (0, -0.85, 0), coll)  # inside the room only (nothing visible outside)
    plane("room_wall_back", (2.2, 2.8), (-1.2, 0.95, 1.4), coll, rot=(90, 0, 0))
    plane("room_wall_left", (4, 2.8), (-2.3, -1.0, 1.4), coll, rot=(90, 0, 90))
    # Window: frame and mullions in front of a generic sky plane (privacy: never a real view).
    x0, x1, z0, z1, y = -0.1, 2.2, 0.55, 2.7, 0.95
    frame = []
    for i, x in enumerate([x0, 0.65, 1.4, x1]):
        frame.append(box(f"window_mullion_{i}", (0.06, 0.08, z1 - z0), (x, y, z0), coll, bevel=0.004))
    frame.append(box("window_sill", (x1 - x0 + 0.06, 0.25, 0.04), ((x0 + x1) / 2, y - 0.05, z0 - 0.04), coll))
    frame.append(box("window_head", (x1 - x0 + 0.06, 0.08, 0.06), ((x0 + x1) / 2, y, z1), coll))
    frame.append(box("window_transom", (x1 - x0, 0.06, 0.05), ((x0 + x1) / 2, y, 1.45), coll))
    parent(frame, "window_frame", coll)
    # Enclose the room so light enters only through the window (the sky is the world).
    plane("room_ceiling", (8, 8), (0, 0, 2.8), coll, rot=(180, 0, 0))
    plane("room_wall_right", (4, 2.8), (2.3, -1.0, 1.4), coll, rot=(90, 0, -90))
    plane("room_wall_front", (5, 2.8), (0, -2.6, 1.4), coll, rot=(90, 0, 180))
    plane("room_wall_under_window", (x1 - x0 + 0.1, z0), ((x0 + x1) / 2, y + 0.02, z0 / 2), coll, rot=(90, 0, 0))
    plane("room_wall_over_window", (x1 - x0 + 0.1, 2.8 - z1), ((x0 + x1) / 2, y + 0.02, (z1 + 2.8) / 2), coll, rot=(90, 0, 0))


# ---------------------------------------------------------------- desk and simple objects (built in code)

def build_desk(coll):
    top = box("deco_desk_top", (1.6, 0.9, 0.025), (0, 0.12, DESK_TOP - 0.025), coll, bevel=0.003)
    legs = [
        box(f"deco_desk_leg_{i}", (0.06, 0.7, 0.02), (x, 0.12, 0.0), coll)
        for i, x in enumerate([-0.72, 0.72])
    ] + [box(f"deco_desk_column_{i}", (0.07, 0.05, DESK_TOP - 0.045), (x, 0.12, 0.02), coll) for i, x in enumerate([-0.72, 0.72])]
    parent([top] + legs, "deco_desk", coll)
    mat = box("deco_mat", (0.9, 0.4, 0.003), (0.0, -0.06, DESK_TOP), coll, bevel=0.001)
    mat["role"] = "mat"


def build_simple_objects(coll):
    t = DESK_TOP + 0.003  # on the mat
    build_flat_movers(coll)
    case = build_kit(coll)  # the backflow test-kit case beside the laptop, on the desk
    # Walnut wrist rest in front of the keyboard (from the reference photo).
    box("deco_wrist_rest", (0.33, 0.075, 0.018), (-0.03, -0.205, t), coll, bevel=0.006)
    return {"case": case}


def apply_modifiers(o):
    """Fold an object's modifiers into its own mesh, so a boolean can cut a bevelled shape."""
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(o.evaluated_get(deps), preserve_all_data_layers=True, depsgraph=deps)
    old = o.data
    o.modifiers.clear()
    o.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def cut(o, cutters):
    """Boolean-subtract the cutters from o (both already placed), then drop the cutters."""
    for c in cutters:
        m = o.modifiers.new(f"cut_{c.name}", "BOOLEAN")
        m.operation, m.object, m.solver = "DIFFERENCE", c, "EXACT"
    apply_modifiers(o)
    for c in cutters:
        bpy.data.objects.remove(c, do_unlink=True)


def disc(name, r, loc, coll, verts=64):
    """A flat disc facing +Z with UVs mapping the unit square onto it (for a dial image)."""
    pts = [(r * math.cos(2 * math.pi * i / verts), r * math.sin(2 * math.pi * i / verts), 0.0) for i in range(verts)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(pts, [], [list(range(verts))])
    uv = me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        x, y, _ = pts[loop.vertex_index]
        uv.data[loop.index].uv = (0.5 + x / (2 * r), 0.5 + y / (2 * r))
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    o.location = loc
    return o


def reparent(o, par):
    """Move o under a new parent without moving it in the world (set_parent assumes no parent yet)."""
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = par
    o.matrix_parent_inverse.identity()
    o.matrix_world = mw


def under(o, par):
    """Parent with the child's transform read in the parent's frame (no parent inverse)."""
    o.parent = par
    o.matrix_parent_inverse.identity()
    return o


def tube(name, pts, r, coll):
    """A hose: a round tube along pts, as a smooth-shaded mesh (the bake joins meshes)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    sp = cu.splines.new("POLY")
    sp.points.add(len(pts) - 1)
    for pt, q in zip(sp.points, pts):
        pt.co = (*q, 1.0)
    cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = r, 2, True
    tmp = bpy.data.objects.new(name + "_curve", cu)
    coll.objects.link(tmp)
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(tmp.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.curves.remove(cu)
    for poly in me.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    return o


def ring_mesh(name, r_out, r_in, h, recess, coll, verts=64, chamfer=0.0008):
    """A gauge's bezel, origin at its centre: a round rim of height h, open at the top on a floor
    just under its face (recess down), built directly rather than by a boolean."""
    import bmesh

    floor = h / 2 - recess - 0.0003  # just under the face disc
    profile = [(r_out, -h / 2), (r_out, h / 2 - chamfer), (r_out - chamfer, h / 2), (r_in, h / 2), (r_in, floor)]
    bm = bmesh.new()
    rings = [[bm.verts.new((r * math.cos(2 * math.pi * k / verts), r * math.sin(2 * math.pi * k / verts), z)) for k in range(verts)] for r, z in profile]
    for a, b in zip(rings, rings[1:]):
        for k in range(verts):
            bm.faces.new((a[k], a[(k + 1) % verts], b[(k + 1) % verts], b[k])).smooth = True
    bm.faces.new(rings[-1])
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    return o


def pivot(name, loc, coll, rot=(0, 0, 0), par=None):
    """An unscaled Empty, its transform read in its parent's frame."""
    e = bpy.data.objects.new(name, None)
    coll.objects.link(e)
    if par:
        under(e, par)
    e.location = loc
    e.rotation_euler = [math.radians(a) for a in rot]
    return e


def part(name, size, centre, par, coll, bevel=0.0):
    """A box centred at centre in its parent's frame."""
    o = under(box(name, size, (0, 0, 0), coll, bevel=bevel), par)
    o.location = centre
    return o


def build_flat_movers(coll):
    """The badge, the photo, the notepad with its pen, and the card as movers: each a pivot where it
    lies, an owner for its clip, and rigid parts (flat_movers.py)."""
    roots = {k: pivot(f"obj_{k}", loc, coll, rot) for k, (loc, rot) in FM.REST.items()}

    w, h, d = FM.BADGE
    flip = pivot("badge_flip", (0, 0, 0), coll, par=roots["badge"])
    card = part("badge_card", FM.BADGE, (0, 0, 0), flip, coll, bevel=0.0008)
    front = under(plane("badge_front", (w - 0.004, h - 0.004), (0, 0, 0), coll), card)
    front.location = (0, 0, d / 2 + 0.0001)
    part("badge_clip", FM.BADGE_CLIP, (0, h / 2 + FM.BADGE_CLIP[1] / 4, 0), card, coll, bevel=0.0005)

    w, h, d = FM.PHOTO
    tilt = pivot("photo_tilt", FM.PHOTO_HINGE, coll, (FM.LEAN_DEG, 0, 0), roots["photo"])
    frame = part("photo_frame", FM.PHOTO, (0, h / 2, d / 2), tilt, coll, bevel=0.002)
    frame["role"] = "photo_frame"
    prt = under(plane("photo_print", FM.PRINT, (0, 0, 0), coll), frame)
    prt.location = (0, 0, d / 2 + 0.0005)

    w, h, d = FM.PAD
    top = d / 2 - FM.PAGE_T  # the block's top, under the page
    mid = (top - d / 2) / 2
    block = part("notepad_block", (w, h, d - FM.PAGE_T), (0, 0, mid), roots["notepad"], coll, bevel=0.001)
    sheet = part("notepad_page", (w, h, FM.PAGE_T), (0, h / 2, top), roots["notepad"], coll)
    sheet.data.transform(Matrix.Translation((0, -h / 2, FM.PAGE_T / 2)))  # its origin on the spiral edge
    sketch = under(plane("notepad_sketch", FM.SKETCH, (0, 0, 0), coll), block)
    sketch.location = (0, 0, top + 0.00005 - mid)
    r, length = FM.PEN
    x, y, z = FM.PEN_AT
    pen = under(cylinder("notepad_pen", r, length, (0, 0, 0), coll, rot=(90, 0, 0)), block)
    pen.location = (x, y, z - mid)

    flip = pivot("card_flip", (0, 0, 0), coll, par=roots["card"])
    part("card_body", FM.CARD, (0, 0, 0), flip, coll, bevel=0.0002)


def build_lanyard(coll):
    """The badge's lanyard, coiled on the mat: a flat strap and a steel ring at the clip. It stays."""
    o = grid_mesh("deco_lanyard", *FM.ribbon(FM.lanyard_path(), *FM.STRAP), coll)
    for poly in o.data.polygons:
        poly.use_smooth = False
    major, minor = FM.RING
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=32, minor_segments=8, location=FM.ring_centre())
    ring = bpy.context.active_object
    ring.name = "deco_lanyard_ring"
    for poly in ring.data.polygons:
        poly.use_smooth = True
    move_to(ring, coll)


def grid_mesh(name, verts, faces, coll):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    for poly in me.polygons:
        poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    coll.objects.link(o)
    return o


def build_kit(coll):
    """The backflow test-kit case as a mover: a pivot at the case's centre
    with today's rest pose; a base whose foam holds Carlos's kit (the gauge
    with its hoses, brass fittings and his screwdriver); and a lid hinged on the base's back top
    edge, lined with egg-crate foam. Every part is placed in the case's own frame (movers.py); the
    clip kit_open is keyed in key_clips()."""
    import movers as MV

    w, d, h = MV.KIT_SIZE
    base_size, base_z, lid_size, _, hinge = MV.split_case(MV.KIT_SIZE, MV.LID_H)
    L = MV.kit_layout()
    kit = bpy.data.objects.new("obj_kit", None)
    coll.objects.link(kit)
    kit.location = MV.KIT_REST["location"]
    kit.rotation_euler = (0, 0, math.radians(MV.KIT_REST["rot_z_deg"]))

    def at(b):  # a layout box's base centre, as box() and cylinder() take it
        x, y, z = b["centre"]
        return (x, y, z - b["size"][2] / 2)

    # The base: a bevelled shell with a tray cut into it, origin at the case's centre.
    base = under(box("kit_base", base_size, (0, 0, 0), coll, bevel=MV.KIT_BEVEL), kit)
    base.data.transform(Matrix.Translation((0, 0, base_z)))
    base.location = (0, 0, 0)
    tray = under(box("cut_tray", L["tray"]["size"], at(L["tray"]), coll, bevel=0.004), kit)
    cut(base, [tray])
    for i, dx in enumerate((-0.075, 0.075)):  # two latches on the front face, across the seam
        under(box(f"kit_latch_{i}", (0.028, 0.008, 0.022), (dx, -d / 2 - 0.001, -h / 2 + 0.045), coll, bevel=0.002), base)

    def make(name, b, grow=0.0, rise=0.0, bevel=None):
        """One layout box as a mesh, grown by grow all round (a pocket) and raised at the top by rise."""
        x, y, z = b["centre"]
        sx, sy, sz = b["size"]
        k = b["kind"]
        if k == "lying":
            r, ln = b["r"] + grow, sx + 2 * grow
            return cylinder(name, r, ln, (x, y, z - ln / 2), coll, rot=(0, 90, b["rot_z_deg"]), verts=32, bevel=0.0006 if bevel is None else bevel)
        if k in ("upright", "ring", "hex"):
            hh = sz + 2 * grow + rise
            sides = 6 if k == "hex" and not grow else (64 if b["r"] > 0.008 else 24)
            return cylinder(name, b["r"] + grow, hh, (x, y, z - sz / 2 - grow), coll, verts=sides, bevel=0.0005 if bevel is None else bevel)
        size = (sx + 2 * grow, sy + 2 * grow, sz + 2 * grow + rise)
        return box(name, size, (x, y, z - sz / 2 - grow), coll, rot=(0, 0, b["rot_z_deg"]), bevel=0.0004 if bevel is None else bevel)

    C = L["contents"]
    foam = under(box("kit_foam", L["foam"]["size"], at(L["foam"]), coll, bevel=0), base)
    # Every solid part sits in a pocket cut through the foam's top; the hoses lie on it.
    pockets = [under(make(f"cut_{n}", b, grow=0.0015, rise=0.02, bevel=0), base) for n, b in C.items() if b["kind"] != "disc" and n not in ("needle", "needle_cap")]
    cut(foam, pockets)

    parts = {}
    for n, b in C.items():
        if b["kind"] == "disc":
            o = disc(f"kit_{n}", b["r"], b["centre"], coll)
        elif b["kind"] == "ring":  # a bezel round its recessed face
            o = ring_mesh(f"kit_{n}", b["r"], b["r_in"], b["size"][2], b["recess"], coll)
            o.location = b["centre"]
        else:
            o = make(f"kit_{n}", b)
        parts[n] = under(o, base)
    for n in ("gauge_face", "needle", "needle_cap"):
        reparent(parts[n], parts["gauge"])
    for k, hose in L["hoses"].items():
        under(tube(f"kit_hose_{k}", hose["path"], hose["r"], coll), base)

    # The lid: origin on the hinge, so kit_open is one rotation about its local X.
    lid = under(box("kit_lid", lid_size, (0, 0, 0), coll, bevel=MV.KIT_BEVEL), kit)
    lid.data.transform(Matrix.Translation((0, -d / 2, MV.LID_H / 2)))
    lid.location = hinge
    under(box("kit_handle", (0.1, 0.022, 0.018), (0, -d / 2, MV.LID_H), coll, bevel=0.006), lid)
    pad = L["pad"]
    crate = under(grid_mesh("kit_lid_pad", *MV.egg_crate(pad["size"][0], pad["size"][1]), coll), lid)
    crate.location = pad["centre"]
    return kit


def build_ball(coll):
    """The soccer ball on the floor by the left wall: one smooth mesh of
    white hexagons and black pentagons (room.soccer_ball), material 0 white, 1 black. No brand."""
    import room as RM

    verts, tris, black, _ = RM.soccer_ball(RM.BALL["r"])
    me = bpy.data.meshes.new("ball_skin")
    me.from_pydata(verts, [], tris)
    for poly, b in zip(me.polygons, black):
        poly.material_index = 1 if b else 0
        poly.use_smooth = True
    o = bpy.data.objects.new("ball_skin", me)
    coll.objects.link(o)
    root = pivot("obj_ball", RM.BALL["at"], coll)
    under(o, pivot("ball_roll", (0, 0, 0), coll, par=root))
    return root


def build_board(coll):
    """The magnet board on the back wall, left of the monitor: a painted
    steel face in a dark frame (four boxes, no booleans), and a magnet per place, each a short
    cylinder with its icon printed on a disc just in front, facing the room (-Y)."""
    import room as RM

    (cx, cy, cz), (w, h) = RM.BOARD["centre"], RM.BOARD["size"]
    d, f = RM.BOARD["depth"], RM.BOARD["frame"]
    board = bpy.data.objects.new("obj_board", None)
    coll.objects.link(board)
    parts = [box("board_face", (w, d, h), (cx, cy, cz - h / 2), coll, bevel=0.001)]
    fy = cy - 0.002  # the frame stands a little proud of the face
    for i, (sx, sz, x, z) in enumerate(((w, f, cx, cz + h / 2 - f), (w, f, cx, cz - h / 2), (f, h - 2 * f, cx - w / 2 + f / 2, cz - h / 2 + f), (f, h - 2 * f, cx + w / 2 - f / 2, cz - h / 2 + f))):
        parts.append(box(f"board_frame_{i}", (sx, d + 0.004, sz), (x, fy, z), coll, bevel=0.002))
    front = cy - d / 2
    t = RM.MAGNET["t"]
    for m in RM.board_layout():
        (x, z), r = m["centre"], m["r"]
        body = cylinder(f"magnet_{m['place']}", r, t, (x, front - t / 2, z), coll, rot=(90, 0, 0), verts=48, bevel=0.0012)
        body.location = (x, front - t / 2, z)
        face = disc(f"magnet_{m['place']}_face", r * 0.93, (x, front - t - 0.0003, z), coll)
        face.rotation_euler = (math.radians(90), 0, 0)
        parts += [body, face]
    for o in parts:
        set_parent(o, board)
    return board


def build_diploma(coll):
    """The framed diploma above the board (room.diploma_parts): a dark frame, a mat, cream paper,
    lines that read as a certificate's but say nothing, and a plain gold seal. No words or crest."""
    import room as RM

    root = bpy.data.objects.new("obj_diploma", None)
    coll.objects.link(root)
    for p in RM.diploma_parts():
        x, y, z = p["centre"]
        if p["kind"] == "box":
            sx, sy, sz = p["size"]
            o = box(p["name"], (sx, sy, sz), (x, y, z - sz / 2), coll, bevel=0.0015 if p["name"].startswith("diploma_frame") else 0)
        else:
            o = disc(p["name"], p["r"], (x, y, z), coll)
            o.rotation_euler = (math.radians(90), 0, 0)
        set_parent(o, root)
    return root


def make_phone_mover(coll):
    """The phone as a mover: obj_phone, an Empty at its bounding-box centre turned with it (local
    +Y along its length, +Z out of its screen); phone_spin under it, which phone_turn turns a
    quarter about the screen; the imported model as phone_body; and phone_screen, a quad just over
    the glass for the clip (UV 0–1, U along the length). Cycles never draws the quad."""
    body = bpy.data.objects.get("obj_phone") or bpy.data.objects.get("proxy_phone")
    if not body:
        return None
    body.name = "phone_body"
    yaw = math.radians(COMPLEX["phone"]["rot"][2])
    to_local = Matrix.Rotation(-yaw, 4, "Z")
    meshes = [o for o in [body, *body.children_recursive] if o.type == "MESH"]
    bpy.context.view_layer.update()

    def local_pts(objs):
        return [to_local @ (o.matrix_world @ v.co) for o in objs for v in o.data.vertices]

    pts = local_pts(meshes)
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    centre = Matrix.Rotation(yaw, 4, "Z") @ ((lo + hi) / 2)
    pivot = bpy.data.objects.new("obj_phone", None)
    coll.objects.link(pivot)
    pivot.location = centre
    pivot.rotation_euler = (0, 0, yaw)
    spin = under(bpy.data.objects.new("phone_spin", None), pivot)
    coll.objects.link(spin)
    set_parent(body, spin)

    def with_material(prefix):
        return [o for o in meshes if any(m and m.name.startswith(prefix) for m in o.data.materials)]

    centre_l = (lo + hi) / 2
    display = with_material("Lock_Screen")
    if display:
        dp = [p - centre_l for p in local_pts(display)]
        top = max(p.z for p in [q - centre_l for q in local_pts(display + with_material("Glass"))])
        x0, x1 = min(p.x for p in dp), max(p.x for p in dp)
        y0, y1 = min(p.y for p in dp), max(p.y for p in dp)
    else:  # a proxy block: its top face, inset
        x0, x1, y0, y1 = lo.x - centre_l.x + 0.003, hi.x - centre_l.x - 0.003, lo.y - centre_l.y + 0.003, hi.y - centre_l.y - 0.003
        top = hi.z - centre_l.z
    z = top + 0.0005
    quad = [(x0, y0, z), (x1, y0, z), (x1, y1, z), (x0, y1, z)]
    me = bpy.data.meshes.new("phone_screen")
    me.from_pydata(quad, [], [[0, 1, 2, 3]])
    uv = me.uv_layers.new(name="UVMap")
    for loop in me.loops:
        x, y, _ = quad[loop.vertex_index]
        # landscape after the turn: U runs down the length (the top goes left), V across it
        uv.data[loop.index].uv = ((y1 - y) / (y1 - y0), (x - x0) / (x1 - x0))
    screen = under(bpy.data.objects.new("phone_screen", me), spin)
    coll.objects.link(screen)
    screen.hide_render = True
    return pivot


def make_import_mover(root_name, owner, body_name, place, coll):
    """An imported model as a mover, once it has its materials: its meshes joined into one part,
    with the import's scale and yaw applied, under an owner for the clip and an unscaled pivot.
    place(meshes, lo, hi) gives the pivot's and the owner's world positions."""
    root = bpy.data.objects.get(root_name)
    if not root:
        return None
    tree = [root, *root.children_recursive]
    meshes = [o for o in tree if o.type == "MESH"]
    others = [o for o in tree if o.type != "MESH"]
    at, owner_at = place(meshes, *vertex_bounds(meshes))
    to_owner = Matrix.Translation(-owner_at)
    worlds = {o: o.matrix_world.copy() for o in meshes}
    for o in meshes:
        m = to_owner @ worlds[o]
        o.parent = None
        o.matrix_world = Matrix.Identity(4)
        o.data = o.data.copy()
        o.data.transform(m)
        if m.determinant() < 0:  # a mirrored node: keep its faces outward
            o.data.flip_normals()
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    for o in others:
        bpy.data.objects.remove(o, do_unlink=True)
    body.name = body.data.name = body_name
    new_root = pivot(root_name, at, coll)
    under(body, pivot(owner, owner_at - at, coll, par=new_root))
    return new_root


def make_room_movers(coll):
    """The Corolla, pivoted at its centre, and the mug, at the cup's axis (not the handle's box)."""

    def car_at(meshes, lo, hi):
        mid = (lo + hi) / 2
        return mid, mid

    def mug_at(meshes, lo, hi):
        coffee = [o for o in meshes if any(m and m.name.startswith("Coffee") for m in o.data.materials)] or meshes
        a, b = vertex_bounds(coffee)
        x, y = (a.x + b.x) / 2, (a.y + b.y) / 2
        return Vector((x, y, (lo.z + hi.z) / 2)), Vector((x, y, lo.z))

    make_import_mover("obj_car", "car_turn", "car_body", car_at, coll)
    make_import_mover("obj_mug", "mug_tip", "mug_body", mug_at, coll)


def key_clips():
    """Key the movers' clips at 60 fps from frame 0, each frame from movers.py's easing (linear
    between keys, so any sampler reads the same curve), and leave the scene at rest on frame 0."""
    import movers as MV
    import room_movers as RV

    scene = bpy.context.scene
    scene.render.fps = MV.FPS
    scene.frame_start = 0
    bpy.context.preferences.edit.keyframe_new_interpolation_type = "LINEAR"
    get = bpy.data.objects.get
    clips = [
        ("kit_open", "kit_lid", MV.KIT_OPEN_S, 0, MV.lid_rotation_x),
        ("phone_turn", "phone_spin", MV.PHONE_TURN_S, 2, lambda t: math.radians(MV.turn_angle(t))),
    ]
    for module in (FM, RV):
        for clip, (owner, seconds, axis, _, _) in module.CLIPS.items():
            clips.append((clip, owner, seconds, "XYZ".index(axis), lambda t, m=module, c=clip: math.radians(m.angle(c, t))))
    for clip, owner, seconds, index, value in clips:
        o = get(owner)
        if not o:
            continue
        n = MV.frames(seconds)
        for f in range(n + 1):
            o.rotation_euler[index] = value(f / n)
            o.keyframe_insert("rotation_euler", index=index, frame=f)
        o.animation_data.action.name = clip
    scene.frame_end = max(MV.frames(seconds) for _, _, seconds, _, _ in clips)
    scene.frame_set(0)


# ---------------------------------------------------------------- complex objects (imported glTF, or a proxy)

# Each imported model: rotation that makes it lie Z-up and face the camera (-Y), the true width
# (X extent after rotation, metres) to scale to, where its footprint centre sits on the desk,
# and names of junk meshes to drop. The proxy size is used until the download exists.
COMPLEX = {
    "monitor": dict(proxy=(0.81, 0.10, 0.37), rot=(0, 0, -90), width=0.81, at=(-0.04, 0.42, DESK_TOP - 0.15)),
    "laptop": dict(proxy=(0.31, 0.22, 0.20), rot=(12, 0, 8), width=0.31, at=(-0.6, 0.2, DESK_TOP + 0.06)),
    "keyboard": dict(proxy=(0.33, 0.13, 0.035), rot=(0, 0, 0), level=True, width=0.33, at=(-0.03, -0.1, DESK_TOP + 0.003)),
    "mouse": dict(proxy=(0.065, 0.12, 0.04), rot=(0, 0, -90), width=0.065, at=(0.27, -0.08, DESK_TOP + 0.003)),
    "phone": dict(proxy=(0.072, 0.15, 0.008), rot=(-90, 0, 15), width=0.072, at=(0.17, 0.06, DESK_TOP + 0.003)),
    "mug": dict(proxy=(0.12, 0.09, 0.095), rot=(0, 0, 200), width=0.12, at=(0.48, -0.02, DESK_TOP)),
    # The room (room.py): the scale-model Corolla, scaled by its length before the yaw
    # and placed by its vertices (the window mesh's stale bounding box reaches below the tyres); the
    # interior, the plates and the badges dropped. The plant, true size, on the window sill.
    "car": dict(
        proxy=(0.20, 0.08, 0.062), rot=(0, 0, -RM.CAR["heading_deg"]), length=RM.CAR["length"], at=(*RM.CAR["at"], DESK_TOP), by_vertices=True,
        drop_meshes=("Cube.", "interior", "furniture", "dashboard", "steering", "fabric_high"),
        # loose islands inside these boxes (the download's own coordinates) are the badges: the rear
        # emblem, the front emblem (and its backing), and the TOYOTA lettering on the boot
        badge_boxes=(((-0.07, 2.02, 0.87), (0.07, 2.10, 0.97)), ((-0.11, -2.13, 0.55), (0.11, -2.03, 0.72)), ((0.40, 1.92, 0.89), (0.62, 2.04, 0.97))),
    ),
    "plant": dict(proxy=(0.17, 0.19, 0.27), rot=(0, 0, 0), width=0.17, at=RM.PLANT["at"]),
}
# Interactive vs decoration naming for the complex objects.
NAMES = {"monitor": "obj_monitor", "phone": "obj_phone", "car": "obj_car", "mug": "obj_mug"}


def load_assets():
    p = HERE / "assets.json"
    return json.loads(p.read_text()) if p.exists() else {"models": []}


def world_bounds(objs):
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def level_rotation(objs):
    """For a model saved at an angle: map its longest axis to X, its thinnest to Z (PCA of the
    vertices), with the busier side (keycaps) facing up."""
    import numpy as np
    from mathutils import Matrix

    bpy.context.view_layer.update()
    pts = np.array([tuple(o.matrix_world @ v.co) for o in objs if o.type == "MESH" for v in o.data.vertices])
    c = pts - pts.mean(axis=0)
    _, vecs = np.linalg.eigh(np.cov(c.T))  # ascending variance
    x, z = vecs[:, 2], vecs[:, 0]
    # eigh's eigenvector signs are arbitrary (they can differ between numpy/LAPACK builds), which
    # would turn the model 180 degrees. Fix x: its largest component is negative (the intended look).
    if x[np.argmax(np.abs(x))] > 0:
        x = -x
    print("LEVEL x:", [round(float(v), 4) for v in x])
    if (c @ z > 0).sum() > (c @ z < 0).sum():  # keycaps are the busier side: put it up (+Z)
        z = -z
    y = np.cross(z, x)
    m = Matrix([list(x), list(y), list(z)])  # rows: world axes expressed in the new frame
    return m.to_quaternion()


def vertex_bounds(objs):
    """World bounds from the vertices themselves (a mesh's bound_box can be stale)."""
    bpy.context.view_layer.update()
    pts = [o.matrix_world @ v.co for o in objs if o.type == "MESH" for v in o.data.vertices]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return lo, hi


def drop_badges(objs, boxes, largest=0.25):
    """Delete the loose islands lying wholly inside any box (world coordinates at import), each
    smaller than largest across: separate badge and lettering pieces, never a body panel."""
    import bmesh

    bpy.context.view_layer.update()
    for o in [o for o in objs if o.type == "MESH"]:
        mw = o.matrix_world
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bm.verts.ensure_lookup_table()
        seen, doomed = set(), []
        for v in bm.verts:
            if v.index in seen:
                continue
            stack, isl = [v], []
            while stack:
                x = stack.pop()
                if x.index in seen:
                    continue
                seen.add(x.index)
                isl.append(x)
                stack += [e.other_vert(x) for e in x.link_edges if e.other_vert(x).index not in seen]
            pts = [mw @ x.co for x in isl]
            lo = Vector([min(p[i] for p in pts) for i in range(3)])
            hi = Vector([max(p[i] for p in pts) for i in range(3)])
            if (hi - lo).length < largest and any(all(b0[i] <= lo[i] and hi[i] <= b1[i] for i in range(3)) for b0, b1 in boxes):
                doomed += isl
        if doomed:
            bmesh.ops.delete(bm, geom=doomed, context="VERTS")
            bm.to_mesh(o.data)
            print(f"  {o.name}: dropped {len(doomed)} badge vertices")
        bm.free()


def import_or_proxy(key, coll, assets, allow_proxy=False):
    from pins import PinError, verify_download, verify_files

    cfg = COMPLEX[key]
    name = NAMES.get(key, f"deco_{key}")
    entry = next((m for m in assets.get("models", []) if m.get("slot") == key), None)
    try:
        if not entry:
            raise PinError(f"{key}: no model in assets.json")
        if "files" in entry:  # a loose download (Poly Haven), each file pinned
            path = verify_files(ASSETS_DIR / "downloads", entry["file"], entry["files"])
        else:
            path = verify_download(ASSETS_DIR / "downloads", entry["file"], entry["zip_sha256"])
    except PinError as e:
        if not allow_proxy:
            raise SystemExit(f"{e}\n(pass --allow-proxy to build with a placeholder block)")
        print(f"WARNING: {e}; using a proxy block for {key}")
        o = box(f"proxy_{key}", cfg["proxy"], cfg["at"], coll, rot=(0, 0, cfg["rot"][2]), bevel=0.004)
        o["proxy_for"] = name
        return o
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    new = [o for o in bpy.data.objects if o not in before]
    junk = set(cfg.get("drop_materials", ()))
    drop = cfg.get("drop_meshes", ())
    for o in [o for o in new if o.type == "MESH" and (any(m and m.name.split(".")[0] in junk for m in o.data.materials) or any(d in o.name for d in drop))]:
        new.remove(o)
        bpy.data.objects.remove(o, do_unlink=True)
    if cfg.get("badge_boxes"):
        drop_badges(new, cfg["badge_boxes"])
    root = bpy.data.objects.new(name, None)
    coll.objects.link(root)
    for o in new:
        move_to(o, coll)
        if o.parent is None:
            o.parent = root
    bounds = vertex_bounds if cfg.get("by_vertices") else world_bounds
    # 1. orient, 2. scale to the true width (or, before the yaw, the true length), 3. centre the
    # footprint on its spot, base on the desk.
    if "length" in cfg:
        lo, hi = bounds(new)
        s = cfg["length"] / max(1e-9, hi.x - lo.x, hi.y - lo.y)
        root.rotation_euler = [math.radians(v) for v in cfg["rot"]]
    elif cfg.get("level"):
        root.rotation_mode = "QUATERNION"
        root.rotation_quaternion = level_rotation(new)
    else:
        root.rotation_euler = [math.radians(v) for v in cfg["rot"]]
    if "length" not in cfg:
        lo, hi = bounds(new)
        s = cfg["width"] / max(1e-9, hi.x - lo.x)
    root.scale = (s, s, s)
    lo, hi = bounds(new)
    at = Vector(cfg["at"])
    root.location += Vector(((at.x - (lo.x + hi.x) / 2), (at.y - (lo.y + hi.y) / 2), at.z - lo.z))
    return root


def set_dressing(coll):
    """A coaster under the mug, the badge's lanyard, a short book stack, and cables: the clutter of a
    real desk. (No water glass: the portrait behind it shows.)"""
    build_lanyard(coll)
    for key in ("mug",):
        root = bpy.data.objects.get(f"obj_{key}")
        if root:
            lo, hi = world_bounds([o for o in root.children_recursive if o.type == "MESH"])
            cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
            if key == "mug":
                cx -= (hi.x - lo.x) * 0.12  # centre under the cup, not the handle
            cylinder(f"deco_coaster_{key}", 0.05, 0.005, (cx, cy, DESK_TOP), coll, verts=48, bevel=0.001)
            root.location.z += 0.005
    for i, (w, d, t, rz) in enumerate(((0.21, 0.15, 0.028, -6), (0.19, 0.13, 0.022, 4))):
        z = DESK_TOP + sum((0.028, 0.022)[:i])
        box(f"deco_book_{i}", (w, d, t), (0.32, 0.42, z), coll, rot=(0, 0, rz), bevel=0.002)

    def cable(name, pts, r=0.0022):
        cu = bpy.data.curves.new(name, "CURVE")
        cu.dimensions = "3D"
        cu.bevel_depth = r
        cu.bevel_resolution = 3
        sp = cu.splines.new("BEZIER")
        sp.bezier_points.add(len(pts) - 1)
        for bp, p in zip(sp.bezier_points, pts):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = "AUTO"
        o = bpy.data.objects.new(name, cu)
        coll.objects.link(o)
        return o

    z = DESK_TOP + 0.0024
    cable("deco_cable_keyboard", [(-0.03, -0.03, z + 0.01), (-0.02, 0.06, z), (0.06, 0.2, z), (0.1, 0.4, z), (0.08, 0.6, z)])
    cable("deco_cable_laptop", [(-0.52, 0.12, DESK_TOP + 0.03), (-0.47, 0.16, z), (-0.42, 0.34, z), (-0.5, 0.6, z)])
    cable("deco_cable_mouse", [(0.27, -0.03, z + 0.008), (0.25, 0.1, z), (0.2, 0.3, z), (0.12, 0.58, z)], r=0.0016)


def build_laptop_stand(coll):
    # Aluminium laptop stand (simple object, built in code): a tilted plate on two side legs.
    plate = box("deco_laptop_stand", (0.26, 0.24, 0.006), (-0.6, 0.2, DESK_TOP + 0.045), coll, rot=(12, 0, 8), bevel=0.002)
    for i, dx in enumerate((-0.11, 0.11)):
        leg = box(f"deco_laptop_stand_leg_{i}", (0.012, 0.2, 0.07), (-0.6 + dx, 0.21, DESK_TOP), coll, rot=(0, 0, 8), bevel=0.003)
        set_parent(leg, plate)
    return plate


def build_light_bar(coll):
    # Monitor light bar: a slim bar resting on the monitor's top edge, at its front.
    mon = bpy.data.objects.get("obj_monitor")
    parts = [o for o in mon.children_recursive if o.type == "MESH"] if mon else []
    if parts:
        lo, hi = world_bounds(parts)
        screen = [o for o in parts if (world_bounds([o])[1] - world_bounds([o])[0]).x > 0.6]
        slo, shi = world_bounds(screen or parts)
        x, y, z = (slo.x + shi.x) / 2, slo.y + 0.02, shi.z
    else:
        x, y, z = -0.04, 0.3, DESK_TOP + 0.5
    # cylinder() lifts by half its length (for upright use); this one lies along X.
    bar = cylinder("obj_lightbar", 0.015, 0.5, (x, y - 0.01, z + 0.012 - 0.25), coll, rot=(0, 90, 0), verts=32)
    print(f"light bar at ({x:.3f}, {y:.3f}, {z:.3f})")
    return bar


# ---------------------------------------------------------------- cameras

def build_cameras(coll):
    # Tight like the reference photo: closer and lower, the desk surface fills the frame.
    target = Vector((-0.02, 0.2, 0.92))
    eye = Vector((0.12, -1.22, 1.29))

    def cam(name, eye, target, lens, sensor_width):
        data = bpy.data.cameras.new(name)
        data.lens = lens
        data.sensor_fit = "HORIZONTAL"
        data.sensor_width = sensor_width
        o = bpy.data.objects.new(name, data)
        coll.objects.link(o)
        o.location = eye
        o.rotation_euler = (target - eye).to_track_quat("-Z", "Y").to_euler()
        return o

    overview = cam("cam_overview", eye, target, 35, 36)
    # Phone portrait: its own camera, higher and steeper so the
    # desk's depth runs down the screen; a square frame with all eight objects in view.
    phone = cam("cam_phone", Vector((-0.03, -0.85, 1.75)), Vector((-0.06, 0.16, 0.85)), 19.5, 18)
    phone.data.shift_y = 0.033  # crop the floor, keep the light bar's label room
    build_seat_cameras(cam)
    build_lean_cameras(cam)
    bpy.context.scene.camera = overview


# The seat: the eye in Carlos's chair, 0.52 m
# back from the desk edge, in front of the keyboard. The camera renders the master (framing.py); its
# axis is the safe frame's centre, so the safe frame lands on the master's bottom edge. Portrait
# windows pan across the same master, so there is no portrait camera.
SEAT_EYE = Vector((-0.03, -0.85, 1.30))
SEAT_PITCH = 22.5  # degrees down
SEAT_SAFE_HFOV = 73.5  # degrees, across the safe frame


def build_lean_cameras(cam):
    """A camera per lean-in (cam_monitor: the screen's left half; cam_cv: its right; cam_board;
    cam_diploma),
    square to it, its lens putting the farthest corner at opened.FILL of a square frame. The
    lean-in's render looks through it as is."""
    import lean
    import opened
    import screen_geo

    bpy.context.view_layer.update()
    for name, corners in screen_geo.lean_corners(bpy.context.evaluated_depsgraph_get()).items():
        eye, target = (Vector(v) for v in lean.lean_camera(corners, SEAT_EYE))
        o = cam(f"cam_{name}", eye, target, 35, 36)
        bpy.context.view_layer.update()
        inv = o.matrix_world.inverted()
        reach = max(max(abs(p.x), abs(p.y)) / -p.z for p in (inv @ c for c in corners))
        o.data.lens = o.data.sensor_width / 2 * opened.FILL / reach


def build_seat_cameras(cam):
    import framing

    p = math.radians(SEAT_PITCH)
    target = SEAT_EYE + Vector((0, math.cos(p), -math.sin(p)))
    sensor, lens, sx, sy = framing.camera_for(math.radians(SEAT_SAFE_HFOV))
    o = cam(framing.CAMERA, SEAT_EYE, target, lens, sensor)
    o.data.shift_x, o.data.shift_y = sx, sy


# ---------------------------------------------------------------- materials and lights

def apply_materials():
    import materials as M

    C, h = M.principled, M.srgb
    case = C("kit_case", h("#2B3038"), 0.5, spread=0.12)
    foam = C("kit_foam", h("#55585D"), 0.95, spread=0.03)  # grey, as in his case
    steel = C("latch_steel", h("#B8BBBF"), 0.3, metal=1.0)
    chrome = C("chrome", h("#C8CBCF"), 0.15, metal=1.0)
    bezel = C("gauge_bezel", h("#141416"), 0.35, coat=0.3)
    paper = C("paper_pad", h("#F2EFE8"), 0.85, spread=0.05)
    by_prefix = {
        "room_floor": C("floor", h("#8E8781"), 0.55),
        "room_": M.plaster(C("wall", h("#ECEBE8"), 0.85, spread=0.04)),
        "window_": C("window_frame", h("#26221F"), 0.4, metal=0.5),
        "deco_desk_top": M.fine(C("desk_top", h("#1D1D20"), 0.5, spread=0.04)),
        "deco_desk_": C("desk_steel", h("#2B2B2E"), 0.35, metal=1.0),
        "deco_mat": M.desk_mat("desk_mat"),
        "notepad_sketch": M.printed("notepad_sketch", M.sketch_image(), 0.85),
        "notepad_pen": C("pen", h("#151517"), 0.25, coat=0.6),
        "notepad_page": paper,
        "notepad_block": paper,
        "card_body": C("card_stock", h("#F4F1EA"), 0.8, spread=0.05),
        "badge_front": M.printed("badge_front", M.badge_front_image(), 0.3),
        "badge_clip": steel,
        "badge_card": C("badge_plastic", h("#F7F7F5"), 0.3, coat=0.4),
        "deco_lanyard_ring": steel,
        "deco_lanyard": C("lanyard", h("#23314F"), 0.8),
        "photo_frame": C("photo_frame", h("#18181A"), 0.45),
        "photo_print": M.photo_print("photo_print"),
        "board_face": C("board_steel", h("#D3D5D7"), 0.4),
        "diploma_frame_": C("diploma_frame", h("#1C1A18"), 0.45),
        "diploma_mat": C("diploma_mat", h("#ECE6D8"), 0.9, spread=0.04),
        "diploma_paper": C("diploma_paper", h("#F4EDDC"), 0.85, spread=0.05),
        "diploma_stroke_title": C("diploma_ink", h("#5E574F"), 0.7),
        "diploma_stroke_name": C("diploma_ink", h("#5E574F"), 0.7),
        "diploma_stroke_degree": C("diploma_ink", h("#5E574F"), 0.7),
        "diploma_stroke_sign": C("diploma_sign", h("#6E6860"), 0.7),
        "diploma_stroke_": C("diploma_faint", h("#B3ACA1"), 0.8),
        "diploma_seal": C("diploma_seal", h("#C29A45"), 0.3, metal=1.0),
        "board_frame_": C("board_frame", h("#26272A"), 0.35, metal=0.6),
        "magnet_": C("magnet_rim", h("#EDEBE6"), 0.35, coat=0.4),
        "kit_lid_pad": foam,
        "kit_foam": foam,
        "kit_base": case,
        "kit_lid": case,
        "kit_handle": C("kit_handle", h("#141416"), 0.4),
        "kit_latch_": steel,
        # Carlos's kit: the gauge's white face in a black bezel, its
        # aluminium manifold and red, blue and yellow knobs and hoses, brass fittings, and his
        # black-and-yellow screwdriver.
        "kit_gauge_face": M.printed("gauge_face", M.gauge_face_image(), 0.3),
        "kit_minigauge_face": M.printed("minigauge_face", M.small_gauge_face_image(), 0.3),
        "kit_gauge": bezel,
        "kit_minigauge": bezel,
        "kit_needle": C("needle_black", h("#111113"), 0.4),
        "kit_manifold": C("manifold_aluminium", h("#C4C7CB"), 0.35, metal=1.0),
        "kit_knob_red": C("knob_red", h("#A3201B"), 0.35),
        "kit_knob_blue": C("knob_blue", h("#1C2F66"), 0.35),
        "kit_knob_yellow": C("knob_yellow", h("#D9A520"), 0.35),
        "kit_hose_red": C("hose_red", h("#B02A22"), 0.45),
        "kit_hose_blue": C("hose_blue", h("#1F4A9A"), 0.45),
        "kit_hose_yellow": C("hose_yellow", h("#E8B520"), 0.45),
        "kit_brass_": C("brass", h("#B8925A"), 0.3, metal=1.0),
        "kit_screwdriver_collar": C("screwdriver_collar", h("#E6B82A"), 0.2, coat=0.5),
        "kit_screwdriver_shaft": chrome,
        "kit_screwdriver_tip": chrome,
        "kit_screwdriver": C("screwdriver_grip", h("#17171A"), 0.6),
        "deco_laptop_stand": C("aluminium", h("#B9BCC1"), 0.3, metal=1.0),
        "deco_wrist_rest": M.walnut("walnut"),
        "obj_lightbar": C("lightbar", h("#2E2F33"), 0.35, metal=0.8),
        "deco_coaster_": C("cork", h("#9C7651"), 0.85, spread=0.08),
        "deco_book_0": C("book_cover_a", h("#2E3B33"), 0.7),
        "deco_book_1": C("book_cover_b", h("#C8B79A"), 0.75),
        "deco_cable_": C("cable", h("#141416"), 0.5),
    }
    imported_roots = set(NAMES.values()) | {f"deco_{k}" for k in COMPLEX}

    def imported(o):
        while o.parent:
            o = o.parent
            if o.name in imported_roots:
                return True
        return False

    for o in bpy.data.objects:
        if o.type not in ("MESH", "CURVE") or imported(o):
            continue
        mat = next((m for k, m in by_prefix.items() if o.name.startswith(k)), None)
        if mat:
            o.data.materials.clear()
            o.data.materials.append(mat)

    get = bpy.data.objects.get
    # The soccer ball's two panels, the magnet board and its magnets.
    import room as RM

    if get("ball_skin"):
        me = get("ball_skin").data
        me.materials.clear()
        for m in (C("ball_white", h("#F1F0EC"), 0.45, coat=0.3), C("ball_black", h("#161618"), 0.45, coat=0.3)):
            me.materials.append(m)
        # the panels' slots, set once both materials exist (clearing them resets every face to 0)
        _, _, black, _ = RM.soccer_ball(RM.BALL["r"])
        for poly, b in zip(me.polygons, black):
            poly.material_index = 1 if b else 0

    for place in RM.BOARD_PLACES:
        face = get(f"magnet_{place}_face")
        if face:
            m = M.printed(f"magnet_{place}", M.magnet_icon_image(place, 512 if place == RM.HOME else 256), 0.35)
            M.bsdf_of(m).inputs["Coat Weight"].default_value = 0.4
            face.data.materials.clear()
            face.data.materials.append(m)
    car = get("obj_car")
    if car:
        car_mats = {
            "car_paint": C("car_paint", h("#9E1B1B"), 0.3, coat=1.0),
            "car_glass": C("car_glass", h("#15181C"), 0.08, coat=1.0),
            "car_tyre": C("car_tyre", h("#18181A"), 0.8),
            "car_rim": C("car_rim", h("#B7BABE"), 0.3, metal=1.0),
            "car_lamp_front": C("car_lamp_front", h("#DADDE0"), 0.1),
            "car_lamp_rear": C("car_lamp_rear", h("#7A1414"), 0.2),
            "car_trim": C("car_trim", h("#121214"), 0.5),
        }
        for o in [o for o in car.children_recursive if o.type == "MESH"]:
            for i, slot in enumerate(o.material_slots):
                o.material_slots[i].material = car_mats[car_part(o.name, slot.material.name if slot.material else "")]
    black = C("black_plastic", h("#111113"), 0.45)
    if get("obj_monitor"):
        M.remap(get("obj_monitor"), {"Wallpaper": M.emissive_image("screen_monitor", M.editor_image(), 1.0)}, default=black)
    if get("deco_laptop"):
        M.laptop_screen(get("deco_laptop"), M.laptop_image())
    if get("deco_keyboard"):
        M.tint_texture_material(get("deco_keyboard"), "#D8A574")
    if get("deco_mouse"):
        M.set_all(get("deco_mouse"), C("mouse", h("#141416"), 0.42))
    if get("obj_phone"):
        dark_glass = C("phone_glass", h("#050506"), 0.05, coat=1.0)
        M.remap(get("obj_phone"), {"Lock_Screen": dark_glass, "Glass": dark_glass, "Camera_Lens": dark_glass,
                                   "Color": C("phone_body", h("#2C2D31"), 0.3, metal=0.7)}, default=black)
        screen = get("phone_screen")
        if screen:  # the clip's quad: dark glass where it shows at all (Cycles never draws it)
            screen.data.materials.clear()
            screen.data.materials.append(dark_glass)
    if get("obj_mug"):
        M.remap(get("obj_mug"), {"material": C("ceramic", h("#E9E1D3"), 0.25, coat=0.5)})


def car_part(obj, mat):
    """The flat car_* material for one of the Corolla's parts, from its node and imported material
    names (every image texture goes, so no badge or plate survives in one)."""
    if "windows" in obj or mat.startswith("miror"):
        return "car_glass"
    if "wheels" in obj:
        return "car_rim" if mat.startswith("main_paint") else "car_tyre"
    if "frontlights" in obj:
        return {"klosz": "car_lamp_front", "main_paint": "car_rim", "Material.014": "car_lamp_rear"}.get(mat.split("_0")[0], "car_trim")
    if mat.startswith("main_paint"):
        return "car_paint"
    if mat.startswith("Material.005"):
        return "car_lamp_rear"
    if mat.startswith("Material.003"):
        return "car_rim"
    if mat.startswith("klosz"):
        return "car_glass"
    return "car_trim"


def build_lights():
    import materials as M

    both, day, lamp = (collection(n) for n in ("lights_both", "lights_day", "lights_lamp"))
    # Portal at the window opening: guides sampling of the sky (light enters only there).
    portal = M.light("portal_window", "AREA", both, 1.0, loc=(1.05, 0.97, 1.62), aim=(0, -1, 0), size=(2.3, 2.15))
    portal.data.cycles.is_portal = True
    # Day: low warm sun from outside, through the window.
    M.light("sun_dusk", "SUN", day, 0.7, color=(1.0, 0.72, 0.5), loc=(1.5, 4.0, 3.0), aim=(-0.45, -1.0, -0.22), size=8.0)
    # Lamp: the light bar casts a warm pool on the desk.
    bar = bpy.data.objects.get("obj_lightbar")
    bx, by, bz = bar.location if bar else (-0.04, 0.25, 1.3)
    # Asymmetric monitor bar: aimed forward and down onto the mat, never back at the screen.
    M.light("lightbar_pool", "AREA", lamp, 6.0, color=(1.0, 0.84, 0.64), loc=(bx, by - 0.05, bz - 0.02), aim=(0, -0.62, -1), size=(0.42, 0.03), spread=math.radians(55))
    M.sky_world("sky_day", [(0.0, "#E9A277"), (0.03, "#DDBCAE"), (0.1, "#B5BED4"), (0.3, "#8EA3C8"), (1.0, "#5671A3")], 3.0)
    # Day: soft room fill from behind the camera, so the window can keep its sky colour.
    M.light("fill_room", "AREA", day, 8.0, color=(1.0, 0.96, 0.9), loc=(0.2, -1.8, 2.6), aim=(0, 1.0, -0.8), size=(1.6, 1.2))
    M.sky_world("sky_night", [(0.0, "#3A3244"), (0.08, "#1F2439"), (1.0, "#070A16")], 0.22)
    # Lamp: a faint warm room light so the walls, window frame and desk edges still read.
    M.light("fill_room_lamp", "AREA", lamp, 4.0, color=(1.0, 0.82, 0.62), loc=(-0.8, -1.4, 2.6), aim=(0.5, 1.0, -0.9), size=(1.2, 1.2))
    bpy.context.scene.world = bpy.data.worlds["sky_day"]


def main():
    a = args()
    reset()
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    room, desk, objs, cams = (collection(n) for n in ("room", "desk", "objects", "cameras"))
    build_room(room)
    build_desk(desk)
    build_simple_objects(objs)
    assets = load_assets()
    for key in COMPLEX:
        import_or_proxy(key, objs, assets, a.allow_proxy)
    make_phone_mover(objs)
    build_laptop_stand(objs)
    set_dressing(objs)
    build_light_bar(objs)
    build_ball(objs)
    build_board(objs)
    build_diploma(objs)
    apply_materials()
    make_room_movers(objs)  # joined once each part has its material
    build_cameras(cams)  # they find the screen by its material
    build_lights()
    key_clips()
    Path(a.out).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=a.out)
    print(f"saved {a.out}")


main()
