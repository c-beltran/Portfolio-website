"""
The seat framing, Blender side: the Python twin of content/scene/framing.ts, read from the same
content/scene/framing.json (design 2026-11-19 §3.2). The seat camera renders a master frame whose
safe frame (the part that must always show) sits at its bottom edge, centred. Portrait windows pan
across the safe frame, so they need no camera of their own.

Sizes are in safe-frame heights; rects are normalised to the master, y down.
"""

import json
import math
import os

_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "content", "scene", "framing.json")

with open(_JSON) as f:
    FRAME = json.load(f)

CAMERA = FRAME["camera"]


def ratio(s):
    a, _, b = s.partition("/")
    return float(a) / (float(b) if b else 1.0)


def master():
    """(w, h, safe): the master's size and its safe frame, as framing.ts master()."""
    s = ratio(FRAME["safeAspect"])
    lo, hi = (ratio(r) for r in FRAME["range"])
    w = max(hi, s)
    h = max(1.0, s / lo)
    safe = {"x0": (w - s) / 2 / w, "y0": 1 - 1 / h, "x1": (w + s) / 2 / w, "y1": 1}
    return w, h, safe


def resolution():
    """The master render's pixel size, from safeHeightPx."""
    w, h, _ = master()
    px = FRAME["safeHeightPx"]
    return round(px * w), round(px * h)


def camera_for(safe_hfov, sensor_width=36.0):
    """(sensor_width, lens, shift_x, shift_y) for a horizontal-fit camera whose optical axis is
    the safe frame's centre: the master is wider by w / safe aspect, and shifted up so the safe
    frame sits on its bottom edge. Blender's shift is a fraction of the frame's larger side."""
    w, h, _ = master()
    s = ratio(FRAME["safeAspect"])
    hfov = 2 * math.atan(math.tan(safe_hfov / 2) * w / s)
    lens = sensor_width / 2 / math.tan(hfov / 2)
    return sensor_width, lens, 0, (h - 1) / (2 * max(w, h))
