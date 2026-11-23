"""
The opened pose of each object that comes forward: a pose
for the object, not for the camera. Pure Python, no bpy:
python3 -I scripts/scene/test_opened.py.

The canonical pose puts a mover's pivot d0 in front of the seat's eye, on its view axis, with its
face turned to the eye and then tipped up by tilt_deg (so you look into the open case), and its up
axis toward the camera's up. The bake (bake.py), the opened renders (render_opened.py) and the live
scene (opened-poses.json, written by export_opened.py) all use this one function.

Blender axes throughout; quaternions are (w, x, y, z). to_three / quat_to_three convert to
three.js's Y-up axes the way export_cameras.py and the glTF exporter do: (x, y, z) -> (x, z, -y).
"""

import math

FILL = 0.8  # of a square frame's half-width, where an opened render's or a lean-in's farthest point sits

# The axes are the pivot's local axes (build_scene.py): the kit's +Z is the inside of the case
# and +Y its hinge side; the phone's +Z is out of the screen and +Y toward its top; a flat thing's
# +Z is out of its face. The car, ball and mug stand level (+Z up), so their tilt is from looking
# straight down: the car's 70° is 20° above side-on, the mug's 35° looks into the coffee.
PRESENT = {
    "kit": {"face": "+Z", "up": "+Y", "tilt_deg": 40, "d0": 0.42},
    "phone": {"face": "screen", "up": "long", "tilt_deg": 0, "d0": 0.30},
    "badge": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.22},
    "photo": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.36},
    "notepad": {"face": "+Z", "up": "+Y", "tilt_deg": 40, "d0": 0.42},
    "card": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.22},
    "car": {"face": "+Z", "up": "+Y", "tilt_deg": 70, "d0": 0.38},
    "ball": {"face": "+Z", "up": "+Y", "tilt_deg": 0, "d0": 0.40},
    "mug": {"face": "+Z", "up": "+Y", "tilt_deg": 35, "d0": 0.34},
}
AXES = {"+X": (1.0, 0.0, 0.0), "+Y": (0.0, 1.0, 0.0), "+Z": (0.0, 0.0, 1.0), "screen": (0.0, 0.0, 1.0), "long": (0.0, 1.0, 0.0)}


def _add(a, b):
    return tuple(x + y for x, y in zip(a, b))


def _scale(a, k):
    return tuple(x * k for x in a)


def _dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def _cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _unit(a):
    n = math.sqrt(_dot(a, a))
    return _scale(a, 1.0 / n)


def _quat_from_basis(cols):
    """The unit quaternion (w, x, y, z) of the rotation whose matrix has these columns."""
    (m00, m10, m20), (m01, m11, m21), (m02, m12, m22) = cols
    tr = m00 + m11 + m22
    if tr > 0:
        s = math.sqrt(tr + 1.0) * 2
        q = (0.25 * s, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s)
    elif m00 > m11 and m00 > m22:
        s = math.sqrt(1.0 + m00 - m11 - m22) * 2
        q = ((m21 - m12) / s, 0.25 * s, (m01 + m10) / s, (m02 + m20) / s)
    elif m11 > m22:
        s = math.sqrt(1.0 + m11 - m00 - m22) * 2
        q = ((m02 - m20) / s, (m01 + m10) / s, 0.25 * s, (m12 + m21) / s)
    else:
        s = math.sqrt(1.0 + m22 - m00 - m11) * 2
        q = ((m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, 0.25 * s)
    q = _unit(q)
    return q if q[0] >= 0 else _scale(q, -1.0)


def rotate(q, v):
    """v rotated by the quaternion q (w, x, y, z)."""
    w, x, y, z = q
    u = (x, y, z)
    t = _scale(_cross(u, v), 2.0)
    return _add(_add(v, _scale(t, w)), _cross(u, t))


def canonical_pose(name, eye, forward, up):
    """(location, quaternion) of the mover's pivot in its opened pose, for a camera at eye looking
    along forward with up up (unit vectors, Blender axes)."""
    p = PRESENT[name]
    f, u = _unit(forward), _unit(up)
    t = math.radians(p["tilt_deg"])
    face = _unit(_add(_scale(f, -math.cos(t)), _scale(u, math.sin(t))))  # toward the eye, tipped up
    upw = _unit(_add(_scale(u, math.cos(t)), _scale(f, math.sin(t))))
    # Map the local (face, up, up × face) frame onto the world one: R = W · Lᵀ.
    a, b = AXES[p["face"]], AXES[p["up"]]
    c = _cross(b, a)
    A, B = face, upw
    C = _cross(B, A)
    cols = []
    for e in ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0), (0.0, 0.0, 1.0)):
        # R e = A (a·e) + B (b·e) + C (c·e)
        cols.append(_add(_add(_scale(A, _dot(a, e)), _scale(B, _dot(b, e))), _scale(C, _dot(c, e))))
    return _add(eye, _scale(f, p["d0"])), _quat_from_basis(cols)


def seat_axes(matrix_world):
    """(eye, forward, up) of a Blender camera from its 4×4 world matrix (rows, as mathutils iterates
    it): the camera looks along its local −Z with +Y up."""
    m = [list(r) for r in matrix_world]
    eye = (m[0][3], m[1][3], m[2][3])
    forward = _unit((-m[0][2], -m[1][2], -m[2][2]))
    up = _unit((m[0][1], m[1][1], m[2][1]))
    return eye, forward, up


def to_three(v):
    return (v[0], v[2], -v[1])


def quat_to_three(q):
    """A Blender quaternion (w, x, y, z) as three's (x, y, z, w) in Y-up axes."""
    w, x, y, z = q
    return (x, z, -y, w)
