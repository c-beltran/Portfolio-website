"""
Checks the room in the built scene:

    Blender -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/check_room.py

Prints each failure and exits 1, else prints CHECK_ROOM OK. Never saves the .blend.
"""

import math
import os
import sys

import bpy
from mathutils import Vector
from mathutils.geometry import barycentric_transform, intersect_point_tri_2d

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import room as R  # noqa: E402

problems = []
get = bpy.data.objects.get

# The water glass goes, with its water and coaster, so the portrait behind it shows. The mug keeps
# its own coaster.
for name in ("deco_glass", "deco_water_glass", "deco_coaster_glass"):
    if get(name):
        problems.append(f"{name} present")
for o in bpy.data.objects:
    root = o
    while root.parent:
        root = root.parent
    if root is not o and root.name in ("deco_glass", "deco_water_glass", "deco_coaster_glass"):
        problems.append(f"{o.name} under {root.name}")
if not get("deco_coaster_mug"):
    problems.append("deco_coaster_mug missing")

# The soccer ball on the floor by the left wall: a sphere of white and black panels.
ball = get("ball_skin")
if not ball:
    problems.append("no ball_skin")
else:
    centre = Vector(R.BALL["at"])
    pts = [ball.matrix_world @ v.co for v in ball.data.vertices]
    worst = max(abs((p - centre).length - R.BALL["r"]) for p in pts)
    if worst > 0.001:
        problems.append(f"obj_ball: a vertex is {worst:.4f} m off its sphere")
    if abs(min(p.z for p in pts)) > 0.001:
        problems.append(f"obj_ball: lowest point at z {min(p.z for p in pts):.4f}, not on the floor")
    mats = [m.name for m in ball.data.materials]
    if mats != ["ball_white", "ball_black"]:
        problems.append(f"obj_ball: materials {mats}")
    black = sum(1 for p in ball.data.polygons if p.material_index == 1)
    if black != 12 * 5 * 16:
        problems.append(f"obj_ball: {black} faces take the black panel, not the 12 pentagons' {12 * 5 * 16}")

# The magnet board on the back wall: eight magnets, each face printed with its place's icon.
board = get("obj_board")
if not board:
    problems.append("no obj_board")
else:
    parts = [o for o in board.children_recursive if o.type == "MESH"]
    back = max((o.matrix_world @ v.co).y for o in parts for v in o.data.vertices)
    if abs(back - 0.95) > 0.002:
        problems.append(f"obj_board: its back at y {back:.4f}, not on the wall (0.95)")
    radius = {m["place"]: m["r"] for m in R.board_layout()}
    for place in R.BOARD_PLACES:
        body = get(f"magnet_{place}")
        if not body:
            problems.append(f"no magnet_{place}")
        elif abs(max(v.co.xy.length for v in body.data.vertices) - radius[place]) > 0.001:
            problems.append(f"magnet_{place}: not {radius[place]} m in radius")
        face = get(f"magnet_{place}_face")
        if not face:
            problems.append(f"no magnet_{place}_face")
            continue
        n = (face.matrix_world.to_3x3() @ face.data.polygons[0].normal).normalized()
        if n.angle(Vector((0, -1, 0))) > math.radians(2):
            problems.append(f"magnet_{place}_face faces {tuple(round(c, 2) for c in n)}, not the room")
        images = [nd.image.name for m in face.data.materials if m and m.use_nodes for nd in m.node_tree.nodes if nd.type == "TEX_IMAGE" and nd.image]
        if f"magnet_{place}" not in images:
            problems.append(f"magnet_{place}_face holds {images}")

# The scale-model Corolla beside the portrait: 20 cm long, on the desk, nose to the desk's centre;
# every material replaced by a flat car_* one (no image textures, so no badge or plate in a texture).
car = get("obj_car")
if not car:
    problems.append("no obj_car")
else:
    meshes = [o for o in car.children_recursive if o.type == "MESH"]
    pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
    h = math.radians(R.CAR["heading_deg"])
    fwd = Vector((-math.sin(h), -math.cos(h), 0))  # the nose's direction: from -Y, turned h towards -X
    along = [p.dot(fwd) for p in pts]
    if abs((max(along) - min(along)) - R.CAR["length"]) > 0.005:
        problems.append(f"obj_car: {max(along) - min(along):.3f} m long along its heading, not {R.CAR['length']}")
    if abs(min(p.z for p in pts) - 0.75) > 0.001:
        problems.append(f"obj_car: lowest point at z {min(p.z for p in pts):.4f}, not on the desk (0.75)")
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    if math.hypot(cx - R.CAR["at"][0], cy - R.CAR["at"][1]) > 0.005:
        problems.append(f"obj_car: footprint centred at ({cx:.3f}, {cy:.3f}), not {R.CAR['at']}")
    lamps = [
        o.matrix_world @ o.data.vertices[i].co
        for o in meshes
        for p in o.data.polygons
        if o.data.materials[p.material_index] and o.data.materials[p.material_index].name == "car_lamp_front"
        for i in set(p.vertices)
    ]
    if not lamps:
        problems.append("obj_car: no car_lamp_front faces")
    else:
        mid = sum(pts, Vector()) / len(pts)
        to_lamps = (sum(lamps, Vector()) / len(lamps) - mid)
        to_lamps.z = 0
        if to_lamps.angle(fwd) > math.radians(10):
            problems.append(f"obj_car: its nose points {math.degrees(to_lamps.angle(fwd)):.0f}° off its heading")
    for o in meshes:
        for m in o.data.materials:
            if not m or not m.name.startswith("car_"):
                problems.append(f"obj_car: {o.name} has material {m.name if m else None}")
            elif m.use_nodes and any(n.type == "TEX_IMAGE" for n in m.node_tree.nodes):
                problems.append(f"obj_car: material {m.name} uses an image texture")

# The plant on the window sill (z 0.55), near the monitor.
plant = get("deco_plant")
if not plant:
    problems.append("no deco_plant")
else:
    pts = [o.matrix_world @ v.co for o in plant.children_recursive if o.type == "MESH" for v in o.data.vertices]
    lo_z, hi_z = min(p.z for p in pts), max(p.z for p in pts)
    if abs(lo_z - 0.55) > 0.001:
        problems.append(f"deco_plant: lowest point at z {lo_z:.4f}, not on the sill (0.55)")
    cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
    cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
    if math.hypot(cx - R.PLANT["at"][0], cy - R.PLANT["at"][1]) > 0.005:
        problems.append(f"deco_plant: footprint centred at ({cx:.3f}, {cy:.3f}), not {R.PLANT['at'][:2]}")
    if not 0.25 <= hi_z - lo_z <= 0.29:
        problems.append(f"deco_plant: {hi_z - lo_z:.3f} m tall")

deps = bpy.context.evaluated_depsgraph_get()


def triangles(o):
    ev = o.evaluated_get(deps)
    me = ev.to_mesh()
    me.calc_loop_triangles()
    uv = me.uv_layers.active.data if me.uv_layers.active else None
    out = [
        (tuple(ev.matrix_world @ me.vertices[v].co for v in t.vertices), tuple(uv[i].uv.copy() for i in t.loops) if uv else None, t.material_index)
        for t in me.loop_triangles
    ]
    ev.to_mesh_clear()
    return out


# The monitor's image is upright: its document pane's title bar (the greyer strip) is at the top.
mon = get("obj_monitor")
screen = [
    (pts, uv, o.data.materials[i])
    for o in (mon.children_recursive if mon else [])
    if o.type == "MESH" and any(m and m.get("screen") for m in o.data.materials)
    for pts, uv, i in triangles(o)
    if o.data.materials[i] and o.data.materials[i].get("screen")
]
if screen:
    image = next(nd.image for nd in screen[0][2].node_tree.nodes if nd.type == "TEX_IMAGE")
    w, h = image.size
    px = image.pixels[:]

    def shown(v):
        p = Vector((0.75, v))
        for pts, uv, _ in screen:
            if intersect_point_tri_2d(p, *uv):
                z = barycentric_transform(p.to_3d(), *[q.to_3d() for q in uv], *pts).z
                i = (int(v * h) * w + int(0.75 * w)) * image.channels
                return z, sum(px[i : i + 3])
        raise SystemExit(f"monitor screen: nothing shows v {v}")

    (high_z, high), (low_z, low) = sorted((shown(0.012), shown(0.985)), reverse=True)
    if not high < low - 0.05:
        problems.append("obj_monitor: the screen's image is upside down")
else:
    problems.append("obj_monitor: no screen")

# The laptop's page covers its screen, the right way round.
laptop = get("deco_laptop")
if laptop:
    body = max((o for o in laptop.children_recursive if o.type == "MESH"), key=lambda o: len(o.data.polygons))
    panel = sorted(
        ((pts, uv) for pts, uv, _ in triangles(body) if (pts[1] - pts[0]).cross(pts[2] - pts[0]).normalized().y < -0.9),
        key=lambda t: -(t[0][1] - t[0][0]).cross(t[0][2] - t[0][0]).length,
    )[:3]
    mat = body.data.materials[0]
    to_page = {}
    for link in mat.node_tree.links:
        if link.from_node.type == "MAP_RANGE" and link.to_node.type == "COMBXYZ":
            lo, hi = link.from_node.inputs["From Min"].default_value, link.from_node.inputs["From Max"].default_value
            src = next(x.from_socket.name for x in mat.node_tree.links if x.to_node == link.from_node and x.to_socket.name == "Value")
            to_page[link.to_socket.name] = (src, lo, hi)
    corners = [(p, uv) for pts, uvs in panel for p, uv in zip(pts, uvs)]
    top = max(p.z for p, _ in corners)
    bottom = min(p.z for p, _ in corners)
    left, right = min(p.x for p, _ in corners), max(p.x for p, _ in corners)
    for p, uv in corners:
        at = []
        for axis in ("X", "Y"):
            src, lo, hi = to_page[axis]
            at.append(((uv.x if src == "X" else uv.y) - lo) / (hi - lo))
        if not all(-0.01 <= a <= 1.01 for a in at):
            problems.append(f"deco_laptop: the page misses the screen at ({p.x:.3f}, {p.z:.3f})")
            break
        for a, v, lo, hi, name in ((at[0], p.x, left, right, "left to right"), (at[1], p.z, bottom, top, "bottom to top")):
            f = (v - lo) / (hi - lo)
            if (f < 0.1 and a > 0.1) or (f > 0.9 and a < 0.9):
                problems.append(f"deco_laptop: the page doesn't run {name} on the screen")
                break
        else:
            continue
        break

# The diploma above the board: on the wall, every part there, no words, and seen from the seat.
diploma = get("obj_diploma")
if not diploma:
    problems.append("no obj_diploma")
else:
    parts = [o for o in diploma.children_recursive if o.type == "MESH"]
    names = {o.name for o in parts}
    for p in R.diploma_parts():
        if p["name"] not in names:
            problems.append(f"no {p['name']}")
    back = max((o.matrix_world @ v.co).y for o in parts for v in o.data.vertices)
    if abs(back - 0.95) > 0.002:
        problems.append(f"obj_diploma: its back at y {back:.4f}, not on the wall (0.95)")
    if any(o.type == "FONT" for o in diploma.children_recursive):
        problems.append("obj_diploma: has text")
    seat = get("cam_seat")
    if seat:
        eye = seat.matrix_world.translation
        corners = R.diploma_paper_corners()
        middle = tuple(sum(q[i] for q in corners) / 4 for i in range(3))
        for c in corners + [middle]:
            d = Vector(c) - eye
            hit, _, _, _, o, _ = bpy.context.scene.ray_cast(deps, eye, d.normalized(), distance=d.length - 0.002)
            if hit:
                problems.append(f"cam_seat: {o.name} hides the diploma at {tuple(round(v, 3) for v in c)}")

# Nothing stands between the board's lean-in camera and any magnet.
cam = get("cam_board")
if not cam:
    problems.append("no cam_board")
elif board:
    eye = cam.matrix_world.translation
    for place in R.BOARD_PLACES:
        face = get(f"magnet_{place}_face")
        if not face:
            continue
        pts = [face.matrix_world @ v.co for v in face.data.vertices]
        mid = sum(pts, Vector()) / len(pts)
        for p in [mid] + [mid.lerp(q, 0.95) for q in pts[::8]]:
            d = p - eye
            hit, _, _, _, o, _ = bpy.context.scene.ray_cast(deps, eye, d.normalized(), distance=d.length + 0.001)
            root = o.original if hit else None
            while root and root.parent:
                root = root.parent
            if root and root.name != "obj_board":
                problems.append(f"cam_board: {o.name} hides magnet_{place}")
                break

for p in problems:
    print("CHECK_ROOM", p)
if problems:
    sys.exit(1)
print("CHECK_ROOM OK")
