"""
Pure geometry for the room's objects: the soccer
ball by the left wall, the magnet board of Carlos's eight places and the framed diploma above it. No bpy, so it is unit-tested
by test_room.py. Blender axes, metres: +X right, +Y towards the back wall, +Z up.
"""

import math

# The ball lies on the floor by the desk's left end, near the left wall (x -2.3): ultrawide only.
BALL = {"at": (-1.95, 0.55, 0.11), "r": 0.11}

# The scale-model Corolla on the desk beside the portrait, where the glass stood: 20 cm long, its
# nose turned 60 degrees from the seat (-Y) towards the desk's centre (-X), front three-quarters.
CAR = {"at": (0.40, 0.20), "length": 0.20, "heading_deg": 60}
# The plant on the window sill (top at z 0.55), on the stretch nearest the monitor that the seat sees.
PLANT = {"at": (0.98, 0.88, 0.55)}

# The board hangs on the back wall (y 0.95) left of the monitor, above the laptop.
BOARD = {"centre": (-0.99, 0.944, 1.15), "size": (0.40, 0.28), "depth": 0.012, "frame": 0.015}
# The diploma hangs above the board, centred on it: a dark frame, a mat and cream paper with lines
# that read as a certificate's but say nothing, and a plain gold seal. No words, crest or logo: the
# page lays the degree on it as HTML when the view leans in.
DIPLOMA = {"centre": (-0.99, 0.944, 1.53), "size": (0.34, 0.28), "depth": 0.012, "frame": 0.018, "mat": 0.03}
MAGNET = {"r": 0.035, "t": 0.006}
HOME_R = 0.042  # a fifth bigger than the others
PLACES = ("egypt", "italy", "colombia", "guatemala", "canada", "mexico", "puerto_rico", "aruba")
# Home: a ninth magnet in the board's middle.
HOME = "el_salvador"
BOARD_PLACES = PLACES + (HOME,)
ROW = 0.075  # the two rows sit this far above and below the centre, leaving home room between them

# A hand-placed look: each magnet sits a few millimetres off its grid point.
_NUDGE = ((0.003, -0.004), (-0.002, 0.005), (0.004, 0.002), (-0.003, -0.003), (0.002, 0.004), (-0.004, -0.002), (0.003, 0.003), (-0.002, -0.005), (0.001, -0.001))


def board_layout():
    """The travel magnets, 4 x 2, row-major from the top left, then home in the middle:
    [{"place", "centre": (x, z), "r"}]."""
    (cx, _, cz), (w, _) = BOARD["centre"], BOARD["size"]
    inner_w = w - 2 * BOARD["frame"]
    out = []
    for i, place in enumerate(PLACES):
        row, col = divmod(i, 4)
        x = cx - inner_w / 2 + inner_w * (col + 0.5) / 4
        z = cz + (ROW if row == 0 else -ROW)
        dx, dz = _NUDGE[i]
        out.append({"place": place, "centre": (x + dx, z + dz), "r": MAGNET["r"]})
    dx, dz = _NUDGE[len(PLACES)]
    out.append({"place": HOME, "centre": (cx + dx, cz + dz), "r": HOME_R})
    return out


def _segment(y0, r=0.95, n=24):
    """The part of the disc of radius r below the chord y = y0, as a polygon (ground, sand, sea)."""
    a0 = math.asin(max(-1.0, min(1.0, y0 / r)))
    a = [math.pi - a0 + (math.pi + 2 * a0) * k / n for k in range(n + 1)]  # left end round to right
    return ("poly", [(r * math.cos(t), r * math.sin(t)) for t in a])


def _comb(x0, x1, y0, y1, n, pier=0.06):
    """Piers between n arches across a band, as one polygon joined along its foot: drawn over the
    band's dark colour, the gaps read as the arcade's openings."""
    w = (x1 - x0) / n
    pts = [(x0, y0)]
    for k in range(n + 1):
        cx = x0 + k * w
        left, right = max(x0, cx - pier / 2), min(x1, cx + pier / 2)
        pts += [(left, y0 + 0.02), (left, y1), (right, y1), (right, y0 + 0.02)]
    pts += [(x1, y0)]
    return pts


def _leaf(scale=0.62, dy=0.05):
    """A maple leaf's outline, after the Canadian flag's: eleven points, then the stem."""
    pts = [
        (0.0, 1.0), (0.18, 0.62), (0.34, 0.72), (0.28, 0.32), (0.66, 0.6), (0.58, 0.42), (0.94, 0.38),
        (0.82, 0.2), (0.9, 0.1), (0.5, -0.12), (0.56, -0.3), (0.06, -0.26), (0.06, -0.72),
        (-0.06, -0.72), (-0.06, -0.26), (-0.56, -0.3), (-0.5, -0.12), (-0.9, 0.1), (-0.82, 0.2),
        (-0.94, 0.38), (-0.58, 0.42), (-0.66, 0.6), (-0.28, 0.32), (-0.34, 0.72), (-0.18, 0.62),
    ]
    return ("poly", [(x * scale, y * scale + dy) for x, y in pts])


def _band(h, r=0.945, n=8):
    """A flag's middle stripe across the disc, its ends following the rim."""
    a = math.asin(h / r)
    right = [-a + 2 * a * k / n for k in range(n + 1)]
    return ("poly", [(r * math.cos(t), r * math.sin(t)) for t in right + [math.pi + t for t in right]])


# El Salvador's arms differ from Nicaragua's by the laurel wreath and the five flags round the
# triangle.
LAUREL = "#45B653"
FLAG_BLUE = "#1450C8"
HOME_FLAGS = ((8, 0.14), (49, 0.16), (90, 0.25), (131, 0.16), (172, 0.14))  # (degrees, where its cloth starts)
_FLAG = {"long": 0.20, "half": 0.06, "stripe": 0.021, "edge": 0.014}


def _along(deg, r, off=0.0):
    t = math.radians(deg)
    return (r * math.cos(t) - off * math.sin(t), r * math.sin(t) + off * math.cos(t))


def flag_points(deg, start):
    """A point on a little flag's blue cloth and one on its white stripe, clear of the triangle."""
    r = start + 0.7 * _FLAG["long"]
    return _along(deg, r, 0.045 if deg >= 90 else -0.045), _along(deg, r)


def _flags():
    out = []
    for deg, start in HOME_FLAGS:
        end = start + _FLAG["long"]
        edge = _FLAG["edge"]  # gold, or the white stripe melts into the white band
        for colour, half, grow in (("#D4AF37", _FLAG["half"] + edge, edge), (FLAG_BLUE, _FLAG["half"], 0.0), ("#FFFFFF", _FLAG["stripe"], 0.0)):
            a, b = start - grow, end + grow
            out.append((colour, ("poly", [_along(deg, a, -half), _along(deg, b, -half), _along(deg, b, half), _along(deg, a, half)])))
    return out


def _wreath():
    """Two laurel branches meeting at the foot, open at the top: leaves as a saw-toothed band."""
    degs = list(range(140, 401, 10))
    outer = [_along(d, 0.475 if k % 2 else 0.43) for k, d in enumerate(degs)]
    inner = [_along(d, 0.34 if k % 2 else 0.375) for k, d in enumerate(degs)]
    return ("poly", outer + inner[::-1])


def _rainbow():
    up = [_along(d, 0.075) for d in range(20, 161, 20)]
    down = [_along(d, 0.052) for d in range(160, 19, -20)]
    return ("poly", [(x, y + 0.02) for x, y in up + down])


# Each place: a background colour and up to six layers of flat shapes, in unit-disc coordinates
# (+y up), every one inside r 0.95. Shapes only: no letters (all words on the site are HTML).
ICONS = {
    "egypt": {"bg": "#9CCBEB", "layers": [
        ("#E2B865", _segment(-0.32)),
        ("#C8913F", ("poly", [(-0.78, -0.32), (0.06, -0.32), (-0.36, 0.42)])),
        ("#A9742F", ("poly", [(-0.36, 0.42), (0.06, -0.32), (-0.14, -0.32)])),
        ("#B98235", ("poly", [(0.0, -0.32), (0.76, -0.32), (0.38, 0.2)])),
        ("#F6D35B", ("circle", 0.5, 0.55, 0.14)),
    ]},
    "italy": {"bg": "#B9D7EC", "layers": [
        ("#7FA65A", _segment(-0.5)),
        # the Colosseum's wall, its top broken away to the right
        ("#D8B98A", ("poly", [(-0.74, -0.52), (0.74, -0.52), (0.74, 0.06), (0.5, 0.06), (0.5, 0.22), (0.2, 0.22), (0.2, 0.4), (-0.74, 0.4)])),
        ("#7A5C3A", ("rect", -0.66, 0.04, 0.42, 0.3)),
        ("#D8B98A", ("poly", _comb(-0.66, 0.42, 0.04, 0.3, 5))),
        ("#7A5C3A", ("rect", -0.66, -0.44, 0.66, -0.06)),
        ("#D8B98A", ("poly", _comb(-0.66, 0.66, -0.44, -0.06, 6))),
    ]},
    "colombia": {"bg": "#F2C94C", "layers": [
        ("#E3DCCB", ("ellipse", 0.0, -0.5, 0.62, 0.13)),
        ("#F7F4EC", ("poly", [(-0.42, 0.18), (0.42, 0.18), (0.32, -0.46), (-0.32, -0.46)])),
        ("#6B3E1E", ("ellipse", 0.0, 0.18, 0.42, 0.08)),
        ("#F7F4EC", ("poly", [(0.38, 0.08), (0.62, 0.06), (0.66, -0.12), (0.5, -0.28), (0.34, -0.26), (0.36, -0.18), (0.48, -0.18), (0.56, -0.08), (0.52, 0.0), (0.38, 0.0)])),
        ("#FFFFFF", ("poly", [(-0.14, 0.3), (-0.06, 0.44), (-0.14, 0.58), (-0.06, 0.72), (-0.12, 0.72), (-0.2, 0.58), (-0.12, 0.44), (-0.2, 0.3)])),
        ("#FFFFFF", ("poly", [(0.1, 0.3), (0.18, 0.44), (0.1, 0.58), (0.18, 0.72), (0.12, 0.72), (0.04, 0.58), (0.12, 0.44), (0.04, 0.3)])),
    ]},
    "guatemala": {"bg": "#A9D6F0", "layers": [
        ("#6F9E4F", _segment(-0.45)),
        ("#5E6B73", ("poly", [(-0.8, -0.45), (-0.16, 0.3), (0.16, 0.3), (0.8, -0.45)])),
        ("#F4F4F2", ("poly", [(-0.16, 0.3), (0.16, 0.3), (0.3, 0.14), (0.1, 0.18), (0.0, 0.1), (-0.12, 0.18), (-0.3, 0.14)])),
        ("#D3D7DA", ("ellipse", -0.02, 0.5, 0.22, 0.12)),
        ("#C2C7CB", ("ellipse", 0.24, 0.66, 0.18, 0.1)),
    ]},
    "canada": {"bg": "#FBFBF8", "layers": [
        ("#D52B1E", _leaf()),
    ]},
    "mexico": {"bg": "#F4D06F", "layers": [
        ("#D9A066", _segment(-0.4)),
        ("#C4A06A", ("poly", [(-0.82, -0.4), (0.22, -0.4), (0.22, -0.24), (0.1, -0.24), (0.1, -0.08), (-0.02, -0.08), (-0.02, 0.08), (-0.14, 0.08), (-0.14, 0.24), (-0.46, 0.24), (-0.46, 0.08), (-0.58, 0.08), (-0.58, -0.08), (-0.7, -0.08), (-0.7, -0.24), (-0.82, -0.24)])),
        ("#9E7E4E", ("rect", -0.36, 0.24, -0.24, 0.36)),
        ("#3E7D3A", ("poly", [(0.5, -0.5), (0.5, 0.5), (0.54, 0.56), (0.6, 0.5), (0.6, 0.08), (0.72, 0.08), (0.72, 0.36), (0.78, 0.4), (0.82, 0.36), (0.82, -0.02), (0.6, -0.02), (0.6, -0.5)])),
        ("#3E7D3A", ("poly", [(0.5, -0.1), (0.36, -0.1), (0.36, 0.24), (0.32, 0.28), (0.28, 0.24), (0.28, -0.18), (0.5, -0.18)])),
    ]},
    "puerto_rico": {"bg": "#8FD0F0", "layers": [
        ("#2E86C1", _segment(-0.5)),
        ("#D9C29A", ("rect", -0.72, -0.56, 0.72, -0.2)),
        ("#E8D7B0", ("rect", -0.18, -0.2, 0.18, 0.26)),
        ("#E8D7B0", ("ellipse", 0.0, 0.26, 0.2, 0.18)),
        ("#3A3328", ("rect", -0.05, -0.08, 0.05, 0.12)),
        ("#E8D7B0", ("circle", 0.0, 0.5, 0.05)),
    ]},
    # Home: the flag's blue-white-blue stripes and, on the white, the coat of arms without its
    # lettering: the laurel wreath, five flags behind the triangle, and in it five volcanoes
    # rising from the sea, the rainbow and the red cap.
    "el_salvador": {"bg": "#0F47AF", "layers": [
        ("#FFFFFF", _band(0.48)),
        (LAUREL, _wreath()),
        *_flags(),
        ("#D4AF37", ("poly", [(-0.24, -0.14), (0.24, -0.14), (0.0, 0.28)])),
        ("#8FC8E8", ("poly", [(-0.19, -0.11), (0.19, -0.11), (0.0, 0.22)])),
        ("#2E7D32", ("poly", [(-0.17, -0.11), (-0.12, -0.035), (-0.09, -0.06), (-0.06, -0.015), (-0.03, -0.05), (0.0, 0.01), (0.03, -0.05), (0.06, -0.015), (0.09, -0.06), (0.12, -0.035), (0.17, -0.11)])),
        ("#1E5AA8", ("rect", -0.17, -0.11, 0.17, -0.075)),
        ("#F2C230", _rainbow()),
        ("#C62828", ("circle", 0.0, 0.135, 0.025)),
    ]},
    "aruba": {"bg": "#7FD3E8", "layers": [
        ("#F2DFA7", _segment(-0.42)),
        ("#6B4A2B", ("poly", [(-0.42, -0.44), (-0.3, -0.44), (-0.12, 0.0), (0.24, 0.24), (0.2, 0.3), (-0.2, 0.06)])),
        ("#4E8A3A", ("ellipse", 0.26, 0.26, 0.48, 0.17)),
        ("#5F9B48", ("ellipse", 0.42, 0.18, 0.3, 0.12)),
    ]},
}


def _inside(shape, x, y):
    kind = shape[0]
    if kind == "circle":
        _, cx, cy, r = shape
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
    if kind == "ellipse":
        _, cx, cy, rx, ry = shape
        return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
    if kind == "rect":
        _, x0, y0, x1, y1 = shape
        return x0 <= x <= x1 and y0 <= y <= y1
    pts, hit = shape[1], False
    for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            hit = not hit
    return hit


def colour_at(place, x, y):
    """The icon's colour at (x, y) in unit-disc coordinates: None outside the disc, else the
    topmost layer that holds the point, else the background."""
    if x * x + y * y > 1:
        return None
    icon = ICONS[place]
    for colour, shape in reversed(icon["layers"]):
        if _inside(shape, x, y):
            return colour
    return icon["bg"]


def _icosahedron():
    p = (1 + math.sqrt(5)) / 2
    v = [(-1, p, 0), (1, p, 0), (-1, -p, 0), (1, -p, 0), (0, -1, p), (0, 1, p), (0, -1, -p), (0, 1, -p), (p, 0, -1), (p, 0, 1), (-p, 0, -1), (-p, 0, 1)]
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8),
         (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
    return v, f


def _lerp(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def soccer_ball(r, subdiv=2):
    """A soccer ball of radius r centred on the origin: the truncated icosahedron (12 pentagons, 20
    hexagons), each face fanned from its centre, each triangle split in four subdiv times and
    pushed onto the sphere, wound outward. Returns (verts, tris, black, face): black[i] marks a
    pentagon's triangle, face[i] the face (0-31) it belongs to."""
    iv, ifaces = _icosahedron()
    cut = {}  # (a, b): the point a third of the way from vertex a towards b

    def point(a, b):
        if (a, b) not in cut:
            cut[(a, b)] = _lerp(iv[a], iv[b], 1 / 3)
        return cut[(a, b)]

    polys = []  # (corners in order, is_pentagon)
    for a in range(12):  # a pentagon round each icosahedron vertex
        ring = [t for t in ifaces if a in t]
        # order the five neighbours by walking the faces around a
        nbrs = []
        tri = ring[0]
        i = tri.index(a)
        prev = tri[(i + 1) % 3]
        for _ in range(5):
            nbrs.append(prev)
            nxt = next(t for t in ring if a in t and prev in t and t[(t.index(a) + 1) % 3] == prev)
            prev = nxt[(nxt.index(a) + 2) % 3]
        polys.append(([point(a, b) for b in nbrs], True))
    for a, b, c in ifaces:  # a hexagon on each icosahedron face
        polys.append(([point(a, b), point(b, a), point(b, c), point(c, b), point(c, a), point(a, c)], False))

    index, verts = {}, []

    def vid(p):
        n = math.sqrt(sum(c * c for c in p))
        q = tuple(r * c / n for c in p)
        key = tuple(round(c, 9) for c in q)
        if key not in index:
            index[key] = len(verts)
            verts.append(q)
        return index[key]

    def split(tri, depth):
        if depth == 0:
            return [tri]
        a, b, c = tri
        ab, bc, ca = _lerp(a, b, 0.5), _lerp(b, c, 0.5), _lerp(c, a, 0.5)
        out = []
        for t in ((a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)):
            out += split(t, depth - 1)
        return out

    tris, black, face = [], [], []
    for fi, (corners, pent) in enumerate(polys):
        centre = tuple(sum(p[k] for p in corners) / len(corners) for k in range(3))
        for k in range(len(corners)):
            for t in split((centre, corners[k], corners[(k + 1) % len(corners)]), subdiv):
                ids = [vid(p) for p in t]
                a, b, c = (verts[i] for i in ids)
                n = (
                    (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
                    (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
                    (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
                )
                if sum(n[j] * (a[j] + b[j] + c[j]) for j in range(3)) < 0:
                    ids = [ids[0], ids[2], ids[1]]
                tris.append(tuple(ids))
                black.append(pent)
                face.append(fi)
    return verts, tris, black, face


def _diploma_layers():
    """The diploma's sizes and the y of each layer's front face (the wall is at y 0.95)."""
    (cx, cy, cz), (w, h) = DIPLOMA["centre"], DIPLOMA["size"]
    d, f, m = DIPLOMA["depth"], DIPLOMA["frame"], DIPLOMA["mat"]
    back = cy + d / 2
    return {"c": (cx, cz), "outer": (w, h), "inner": (w - 2 * f, h - 2 * f), "paper": (w - 2 * f - 2 * m, h - 2 * f - 2 * m),
            "frame_front": cy - d / 2, "mat_front": back - 0.004, "paper_front": back - 0.005, "ink_front": back - 0.0054}


def diploma_paper_corners():
    """The paper's corners, TL TR BR BL, on its front face: what the page lays the degree on."""
    L = _diploma_layers()
    (cx, cz), (pw, ph), y = L["c"], L["paper"], L["paper_front"]
    return [(cx - pw / 2, y, cz + ph / 2), (cx + pw / 2, y, cz + ph / 2), (cx + pw / 2, y, cz - ph / 2), (cx - pw / 2, y, cz - ph / 2)]


# The certificate's lines, from the paper's top (fractions of its height, its width): a title block, a
# line under it, the name line, two lines of body, the degree line, then two signature lines.
_STROKES = (
    ("title", 0.17, 0.0, 0.46, 0.026, "ink"),
    ("sub", 0.27, 0.0, 0.30, 0.010, "faint"),
    ("name", 0.40, 0.0, 0.54, 0.022, "ink"),
    ("body_0", 0.51, 0.0, 0.70, 0.008, "faint"),
    ("body_1", 0.56, 0.0, 0.62, 0.008, "faint"),
    ("degree", 0.65, 0.0, 0.44, 0.016, "ink"),
    ("sign_0", 0.86, -0.29, 0.24, 0.006, "sign"),
    ("sign_1", 0.86, 0.29, 0.24, 0.006, "sign"),
)
SEAL_R = 0.017


def diploma_parts():
    """Every part of the diploma: [{"name", "kind": "box" | "disc", "size" (x, y, z) or "r", "centre" (x, y, z),
    "ink" for the lines}]. Boxes' centres are their middles; discs face the room (-Y)."""
    L = _diploma_layers()
    (cx, cz), (w, h), (iw, ih), (pw, ph) = L["c"], L["outer"], L["inner"], L["paper"]
    d, f = DIPLOMA["depth"], DIPLOMA["frame"]
    fy = L["frame_front"] + d / 2
    parts = []
    for i, (sx, sz, x, z) in enumerate(((w, f, cx, cz + h / 2 - f / 2), (w, f, cx, cz - h / 2 + f / 2),
                                        (f, h - 2 * f, cx - w / 2 + f / 2, cz), (f, h - 2 * f, cx + w / 2 - f / 2, cz))):
        parts.append({"name": f"diploma_frame_{i}", "kind": "box", "size": (sx, d, sz), "centre": (x, fy, z)})
    mat_d = 0.004
    parts.append({"name": "diploma_mat", "kind": "box", "size": (iw, mat_d, ih), "centre": (cx, L["mat_front"] + mat_d / 2, cz)})
    paper_d = 0.001
    parts.append({"name": "diploma_paper", "kind": "box", "size": (pw, paper_d, ph), "centre": (cx, L["paper_front"] + paper_d / 2, cz)})
    top = cz + ph / 2
    ink_d = 0.0004
    for name, down, across, sw, sh, ink in _STROKES:
        parts.append({"name": f"diploma_stroke_{name}", "kind": "box", "size": (pw * sw, ink_d, ph * sh),
                      "centre": (cx + pw * across, L["ink_front"] + ink_d / 2, top - ph * down), "ink": ink})
    parts.append({"name": "diploma_seal", "kind": "disc", "r": SEAL_R, "centre": (cx, L["ink_front"] - 0.0002, cz - ph / 2 + ph * 0.15)})
    return parts
