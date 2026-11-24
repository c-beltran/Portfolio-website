"""Pure helpers for bake.py (no bpy), so they can be unit-tested: scripts/scene/test_bake.py."""

# The objects that come forward: each bakes into its own atlas, at rest
# and opened, and exports on its own with its hierarchy and clip (bake.py export_movers).
MOVERS = {m: f"obj_{m}" for m in ("kit", "phone", "badge", "photo", "notepad", "card", "car", "ball", "mug")}
# The statics' atlases (the board and the diploma have their own, so they read close up), then the
# movers'.
STATICS = ("room", "desk", "monitor", "props", "screen", "board", "diploma")
GROUPS = STATICS + tuple(MOVERS)

# Objects lifted in the bake only (metres), where two faces share a plane that a depth buffer
# can't separate. None today.
LIFTS = {}


def group_for(name: str, top: str, is_screen: bool) -> str:
    """The bake group of a mesh, from the build's names (room_*, deco_*, obj_*); top is the name of
    its root parent, is_screen whether it carries the monitor's screen material. None: never baked
    (the phone's clip quad, which shows the clip or a flat colour)."""
    if name == "phone_screen":
        return None
    for group, pivot in MOVERS.items():
        if top == pivot:
            return group
    if name.startswith("room_") or top == "window_frame" or name.startswith("window"):
        return "room"
    if top in ("deco_desk", "deco_mat"):
        return "desk"
    if top == "obj_monitor":
        return "screen" if is_screen else "monitor"
    if top == "obj_lightbar":
        return "monitor"
    if top == "obj_board":
        return "board"
    if top == "obj_diploma":
        return "diploma"
    return "props"


def lift_for(name: str) -> float:
    return LIFTS.get(name, 0.0)


def _clip_to_frame(poly):
    """Sutherland–Hodgman: the polygon clipped to the camera frame (0–1 on both axes)."""
    edges = [(0, 0.0, 1), (0, 1.0, -1), (1, 0.0, 1), (1, 1.0, -1)]  # axis, bound, side
    for axis, bound, side in edges:
        inside = lambda p: (p[axis] - bound) * side >= 0  # noqa: E731
        out, n = [], len(poly)
        for i in range(n):
            a, b = poly[i], poly[(i + 1) % n]
            if inside(a):
                out.append(a)
            if inside(a) != inside(b):
                t = (bound - a[axis]) / (b[axis] - a[axis])
                out.append((a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])))
        poly = out
        if not poly:
            break
    return poly


def _inside_convex(p, quad, eps=1e-9):
    signs = set()
    for i in range(len(quad)):
        (ax, ay), (bx, by) = quad[i], quad[(i + 1) % len(quad)]
        cross = (bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)
        if abs(cross) > eps:
            signs.add(cross > 0)
    return len(signs) <= 1


def backdrop_covers(window_corners_px, plane_corners_px) -> bool:
    """Whether the sky backdrop fills every part of the window opening the camera sees. Both are
    convex quads in camera-frame coordinates (world_to_camera_view's x, y)."""
    seen = _clip_to_frame(list(window_corners_px))
    return all(_inside_convex(p, list(plane_corners_px)) for p in seen)
