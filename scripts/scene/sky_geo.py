"""
The sky behind the window, without bpy: the live desk's backdrop plane (bake.py builds it) and the
patch of it the window shows, where the weather is drawn (export_bounds.py writes that patch's
corners on the still as quads.sky, and its place on the plane's UVs as skyUv).

The plane stands upright (normal along y) at CENTER, SIZE wide (x) and tall (z). Its UVs run
u = 0→1 with x and v = 0→1 with z, as Blender's primitive plane lays them out.
"""

CENTER = (1.0, 1.7, 1.6)
SIZE = (6.0, 5.0)
# How far the patch reaches past the window opening, as a share of its size on each side: the
# glances and lean-ins look through the opening at slightly different angles.
MARGIN = 0.12


def plane_bounds():
    """(x0, x1, z0, z1) of the plane."""
    (cx, _, cz), (w, h) = CENTER, SIZE
    return cx - w / 2, cx + w / 2, cz - h / 2, cz + h / 2


def uv_of(x, z):
    x0, x1, z0, z1 = plane_bounds()
    return (x - x0) / (x1 - x0), (z - z0) / (z1 - z0)


def onto_plane(eye, p):
    """Where the ray from the eye through point p meets the plane (y = CENTER[1])."""
    y = CENTER[1]
    t = (y - eye[1]) / (p[1] - eye[1])
    if t <= 0:
        raise ValueError("the plane is behind the eye")
    return eye[0] + (p[0] - eye[0]) * t, eye[2] + (p[2] - eye[2]) * t


def window_patch(eye, opening, view=None):
    """The window opening as seen from the eye, on the plane, cut to what the camera's frame shows
    (view: the frame's corners as world points far along their rays) when given, grown by MARGIN
    and kept on the plane: (x0, x1, z0, z1)."""
    pts = [onto_plane(eye, p) for p in opening]
    x0, x1 = min(x for x, _ in pts), max(x for x, _ in pts)
    z0, z1 = min(z for _, z in pts), max(z for _, z in pts)
    if view:
        seen = [onto_plane(eye, p) for p in view]
        x0, x1 = max(x0, min(x for x, _ in seen)), min(x1, max(x for x, _ in seen))
        z0, z1 = max(z0, min(z for _, z in seen)), min(z1, max(z for _, z in seen))
    dx, dz = (x1 - x0) * MARGIN, (z1 - z0) * MARGIN
    px0, px1, pz0, pz1 = plane_bounds()
    return max(px0, x0 - dx), min(px1, x1 + dx), max(pz0, z0 - dz), min(pz1, z1 + dz)


def patch_corners(patch):
    """The patch's world corners: top-left, top-right, bottom-right, bottom-left (as seen from the
    room, looking along +y: x grows to the right)."""
    x0, x1, z0, z1 = patch
    y = CENTER[1]
    return [(x0, y, z1), (x1, y, z1), (x1, y, z0), (x0, y, z0)]


def patch_uv(patch):
    x0, x1, z0, z1 = patch
    (u0, v0), (u1, v1) = uv_of(x0, z0), uv_of(x1, z1)
    return {"u0": round(u0, 5), "v0": round(v0, 5), "u1": round(u1, 5), "v1": round(v1, 5)}
