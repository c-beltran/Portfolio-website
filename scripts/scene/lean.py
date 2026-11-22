"""
Where a lean-in's camera stands: square to what it shows, a short step back on the seat's side.
No bpy, so it is unit-tested by test_lean.py.
"""

import math

LEAN_DISTANCE = 0.45  # metres


def lean_camera(corners, seat_eye):
    """(eye, target) for a quad's corners in order round it: the target is their centroid, the eye
    LEAN_DISTANCE out along the normal of their best-fit plane, on the seat's side."""
    target = tuple(sum(p[i] for p in corners) / len(corners) for i in range(3))
    n = [0.0, 0.0, 0.0]  # Newell's normal
    for a, b in zip(corners, [*corners[1:], corners[0]]):
        for i in range(3):
            j, k = (i + 1) % 3, (i + 2) % 3
            n[i] += (a[j] - b[j]) * (a[k] + b[k])
    size = math.sqrt(sum(c * c for c in n))
    side = 1 if sum(c * (s - t) for c, s, t in zip(n, seat_eye, target)) >= 0 else -1
    return tuple(t + side * LEAN_DISTANCE * c / size for t, c in zip(target, n)), target
