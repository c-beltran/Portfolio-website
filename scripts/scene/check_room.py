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

for p in problems:
    print("CHECK_ROOM", p)
if problems:
    sys.exit(1)
print("CHECK_ROOM OK")
