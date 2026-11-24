"""Points on the monitor's screen and the magnet board, in world space (bpy)."""

import bpy
from mathutils import Vector
from mathutils.geometry import barycentric_transform, intersect_point_tri_2d


def screen_meshes(monitor):
    out = [m for m in [monitor, *monitor.children_recursive]
           if m.type == "MESH" and any(mat and mat.get("screen") for mat in m.data.materials)]
    if not out:
        raise SystemExit(f"{monitor.name}: no mesh with a screen material")
    return out


def screen_triangles(monitor, depsgraph):
    """The screen's triangles as (uv triangle, world triangle), plus its UV extent."""
    tris, us, vs = [], [], []
    for m in screen_meshes(monitor):
        ev = m.evaluated_get(depsgraph)
        me = ev.to_mesh()
        mw = ev.matrix_world
        me.calc_loop_triangles()
        uvl = me.uv_layers.active.data
        for t in me.loop_triangles:
            mat = me.materials[t.material_index]
            if not (mat and mat.get("screen")):
                continue
            uv = tuple(uvl[li].uv.copy() for li in t.loops)
            tris.append((uv, tuple(mw @ me.vertices[vi].co for vi in t.vertices)))
            us += [c.x for c in uv]
            vs += [c.y for c in uv]
        ev.to_mesh_clear()
    return tris, (min(us), max(us)), (min(vs), max(vs))


def screen_point(tris, u, v):
    """The world point on the screen showing UV (u, v)."""
    p = Vector((u, v))
    for (a, b, c), (A, B, C) in tris:
        if intersect_point_tri_2d(p, a, b, c):
            return barycentric_transform(p.to_3d(), a.to_3d(), b.to_3d(), c.to_3d(), A, B, C)
    raise SystemExit(f"monitor screen: no face shows uv ({u:.4f}, {v:.4f})")


def screen_rect(monitor, depsgraph):
    """(triangles, (u0, u1, v0, v1), inset): the UV outline isn't a perfect rectangle, so inset
    until the corners and the midline's ends are on it."""
    tris, (u0, u1), (v0, v1) = screen_triangles(monitor, depsgraph)
    covered = lambda u, v: any(intersect_point_tri_2d(Vector((u, v)), *t[0]) for t in tris)
    for eps in (1e-4, 5e-4, 1e-3, 2e-3, 5e-3, 1e-2, 2e-2):
        a, b, lo, hi = u0 + eps, u1 - eps, v0 + eps, v1 - eps
        if all(covered(u, v) for u in (a, 0.5, b) for v in (lo, hi)):
            return tris, (a, b, lo, hi), eps
    raise SystemExit("monitor screen: its UVs don't cover a rectangle")


def half_corners(monitor, depsgraph, half):
    """The world points showing that half's image corners ("left" or "right"): top-left, top-right,
    bottom-right, bottom-left."""
    tris, (u0, u1, v0, v1), _ = screen_rect(monitor, depsgraph)
    a, b = (u0, 0.5) if half == "left" else (0.5, u1)
    z = lambda v: screen_point(tris, 0.5, v).z
    top, bottom = (v0, v1) if z(v0) > z(v1) else (v1, v0)
    return [screen_point(tris, u, v) for u, v in ((a, top), (b, top), (b, bottom), (a, bottom))]


def board_corners(face, depsgraph):
    """The board face's front corners, in the same order."""
    ev = face.evaluated_get(depsgraph)
    pts = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    (x0, y, z0) = (min(p[i] for p in pts) for i in range(3))
    (x1, _, z1) = (max(p[i] for p in pts) for i in range(3))
    return [Vector(c) for c in ((x0, y, z1), (x1, y, z1), (x1, y, z0), (x0, y, z0))]


def lean_corners(depsgraph):
    """What each lean-in shows, by its id, for those that are built."""
    get = bpy.data.objects.get
    out = {}
    monitor = get("obj_monitor")
    if monitor and any(m and m.get("screen") for o in [monitor, *monitor.children_recursive] if o.type == "MESH" for m in o.data.materials):
        out["monitor"] = half_corners(monitor, depsgraph, "left")
        out["cv"] = half_corners(monitor, depsgraph, "right")
    if get("board_face"):
        out["board"] = board_corners(get("board_face"), depsgraph)
    if get("obj_diploma"):
        out["diploma"] = diploma_corners()
    return out


def diploma_corners():
    """The diploma's frame, outside edge, on its front face, TL TR BR BL: the lean-in frames it
    whole (the page lays the degree on its paper, room.diploma_paper_corners)."""
    import room

    (cx, cy, cz), (w, h) = room.DIPLOMA["centre"], room.DIPLOMA["size"]
    y = cy - room.DIPLOMA["depth"] / 2
    return [Vector(c) for c in ((cx - w / 2, y, cz + h / 2), (cx + w / 2, y, cz + h / 2), (cx + w / 2, y, cz - h / 2), (cx - w / 2, y, cz - h / 2))]
