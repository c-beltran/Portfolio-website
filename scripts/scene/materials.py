"""
Materials, generated screen images and lighting for the workspace scene (M3a, after the clay
checkpoint). Imported by build_scene.py. Screens show neutral blocks only: no readable text,
no logos (DESK_SPEC.md §2 privacy). The window shows the world, a pre-blurred gradient sky.
"""

import math
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

GEN_DIR = Path.home() / "Portfolio-assets" / "generated"


# ---------------------------------------------------------------- node helpers

def new_material(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    return m


def bsdf_of(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def rough_variation(m, base, spread=0.12, scale=60.0):
    """Roughness = base ± spread from fine noise: no surface is perfectly uniform."""
    nt = m.node_tree
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = scale
    noise.inputs["Detail"].default_value = 6
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["To Min"].default_value = max(0.0, base - spread)
    ramp.inputs["To Max"].default_value = min(1.0, base + spread)
    nt.links.new(noise.outputs["Fac"], ramp.inputs["Value"])
    nt.links.new(ramp.outputs["Result"], bsdf_of(m).inputs["Roughness"])


def principled(name, color, rough=0.5, metal=0.0, spread=0.1, coat=0.0):
    m = new_material(name)
    b = bsdf_of(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    rough_variation(m, rough, spread)
    return m


def srgb(h):
    """'#RRGGBB' → linear RGB tuple."""
    c = [int(h[i : i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


def glass(name, tint=(1, 1, 1), rough=0.02, ior=1.45):
    m = new_material(name)
    b = bsdf_of(m)
    b.inputs["Base Color"].default_value = (*tint, 1)
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["Roughness"].default_value = rough
    b.inputs["IOR"].default_value = ior
    return m


def fine(m, scale=420.0):
    """Make a material's roughness variation fine-grained (no large mottling)."""
    for n in m.node_tree.nodes:
        if n.type == "TEX_NOISE":
            n.inputs["Scale"].default_value = scale
    return m


def plaster(m):
    """Subtle plaster bump on walls."""
    nt = m.node_tree
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 180.0
    noise.inputs["Detail"].default_value = 8
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.06
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf_of(m).inputs["Normal"])
    return m


def photo_print(name):
    """A neutral, soft landscape-like gradient print: reads as a photo, shows nothing personal."""
    m = new_material(name)
    nt = m.node_tree
    b = bsdf_of(m)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = 0.0, (*srgb("#4D5A4A"), 1)
    els[1].position, els[1].color = 1.0, (*srgb("#C9D3DE"), 1)
    e = els.new(0.45)
    e.color = (*srgb("#8E9A86"), 1)
    nt.links.new(coord.outputs["UV"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Y"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.35
    return m


def water(name):
    m = glass(name, tint=(0.9, 0.96, 1.0), rough=0.0)
    bsdf_of(m).inputs["IOR"].default_value = 1.33
    return m


def walnut(name):
    m = new_material(name)
    nt = m.node_tree
    b = bsdf_of(m)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (1.5, 30, 6)
    wave = nt.nodes.new("ShaderNodeTexWave")
    wave.bands_direction = "Y"  # grain runs along the rest's length
    wave.inputs["Scale"].default_value = 2.0
    wave.inputs["Distortion"].default_value = 2.5
    wave.inputs["Detail"].default_value = 3.0
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].color = (*srgb("#3B2416"), 1)
    ramp.color_ramp.elements[1].color = (*srgb("#7A5234"), 1)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], wave.inputs["Vector"])
    nt.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.45
    b.inputs["Coat Weight"].default_value = 0.25
    return m


def desk_mat(name):
    """Dark fabric mat with a fine geometric line pattern (Voronoi cell edges), like the reference."""
    m = new_material(name)
    nt = m.node_tree
    b = bsdf_of(m)
    coord = nt.nodes.new("ShaderNodeTexCoord")
    vor = nt.nodes.new("ShaderNodeTexVoronoi")
    vor.feature = "DISTANCE_TO_EDGE"
    vor.inputs["Scale"].default_value = 34.0
    vor.inputs["Randomness"].default_value = 0.85
    edge = nt.nodes.new("ShaderNodeMapRange")
    edge.inputs["From Min"].default_value = 0.0
    edge.inputs["From Max"].default_value = 0.014
    edge.inputs["To Min"].default_value = 1.0
    edge.inputs["To Max"].default_value = 0.0
    edge.clamp = True
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.inputs["A"].default_value = (*srgb("#0E0E10"), 1)
    mix.inputs["B"].default_value = (*srgb("#D0607F"), 1)
    nt.links.new(coord.outputs["Object"], vor.inputs["Vector"])
    nt.links.new(vor.outputs["Distance"], edge.inputs["Value"])
    nt.links.new(edge.outputs["Result"], mix.inputs["Factor"])
    nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.6
    b.inputs["Sheen Weight"].default_value = 0.2
    return m


def emissive_image(name, img, strength, base_rough=0.15):
    """A glossy screen whose emission is an image; strength is set per mode in render.py."""
    m = new_material(name)
    nt = m.node_tree
    b = bsdf_of(m)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    b.inputs["Base Color"].default_value = (0.01, 0.01, 0.012, 1)
    b.inputs["Roughness"].default_value = base_rough
    nt.links.new(tex.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = strength
    m["screen"] = True
    return m


# ---------------------------------------------------------------- generated screen images (no text)

def _save(name, px):
    GEN_DIR.mkdir(parents=True, exist_ok=True)
    h, w, _ = px.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels = np.flipud(px).astype(np.float32).ravel()
    img.filepath_raw = str(GEN_DIR / f"{name}.png")
    img.file_format = "PNG"
    img.save()
    return img


def editor_image(w=3440, h=1440, seed=7):
    """Editor with a file tree and code-coloured line blocks on the left, a light document on
    the right: the shape of the reference screen, with no readable text."""
    rng = np.random.default_rng(seed)
    px = np.zeros((h, w, 4))
    px[..., 3] = 1
    hexc = lambda s: np.array(srgb(s))
    px[..., :3] = hexc("#1E1F22")
    split = int(w * 0.62)
    px[:, :int(w * 0.11), :3] = hexc("#2B2D30")  # file tree
    px[:, split:, :3] = hexc("#F3F3F1")  # document pane
    px[: int(h * 0.035), :, :3] = hexc("#2B2D30")  # title bar
    px[: int(h * 0.035), split:, :3] = hexc("#E4E4E1")
    palette = [hexc(c) for c in ("#C77DBB", "#6AAB73", "#CF8E6D", "#56A8F5", "#BCBEC4", "#BCBEC4", "#7A7E85")]
    line_h, gap = int(h * 0.012), int(h * 0.026)
    y = int(h * 0.06)
    while y < h - gap:
        # file tree entries
        x0 = int(w * 0.012) + int(rng.integers(0, 3)) * int(w * 0.008)
        px[y : y + line_h, x0 : x0 + int(rng.integers(int(w * 0.03), int(w * 0.08))), :3] = hexc("#8C8F94")
        # code: indented tokens
        x = int(w * 0.13) + int(rng.integers(0, 5)) * int(w * 0.014)
        for _ in range(int(rng.integers(1, 6))):
            tw = int(rng.integers(int(w * 0.012), int(w * 0.07)))
            if x + tw > split - int(w * 0.02):
                break
            px[y : y + line_h, x : x + tw, :3] = palette[int(rng.integers(0, len(palette)))]
            x += tw + int(w * 0.006)
        # document: grey prose lines, darker headings
        if rng.random() > 0.12:
            dx = split + int(w * 0.03)
            dw = int(rng.integers(int(w * 0.15), int(w * 0.33)))
            px[y : y + line_h, dx : dx + dw, :3] = hexc("#2F3337") if rng.random() < 0.12 else hexc("#A9ABAE")
        y += gap
    return _save("screen_monitor", px)


def laptop_image(w=1600, h=1000, seed=3):
    """A dark web page with a colourful banner, like the reference laptop, with no text or logos."""
    rng = np.random.default_rng(seed)
    hexc = lambda s: np.array(srgb(s))
    px = np.zeros((h, w, 4))
    px[..., 3] = 1
    px[..., :3] = hexc("#121318")
    px[: int(h * 0.06), :, :3] = hexc("#24262E")
    bx0, by0, bx1, by1 = int(w * 0.12), int(h * 0.16), int(w * 0.88), int(h * 0.52)
    yy, xx = np.mgrid[by0:by1, bx0:bx1]
    t = (xx - bx0) / (bx1 - bx0)
    banner = (1 - t)[..., None] * hexc("#E2683C") + t[..., None] * hexc("#7B4FD6")
    px[by0:by1, bx0:bx1, :3] = banner
    y = int(h * 0.6)
    while y < h - 30:
        px[y : y + 10, bx0 : bx0 + int(rng.integers(int(w * 0.2), int(w * 0.7))), :3] = hexc("#5E6270")
        y += 26
    return _save("screen_laptop", px)


# ---------------------------------------------------------------- assignment

def set_all(obj, mat):
    for o in [obj] + list(obj.children_recursive):
        if o.type == "MESH":
            o.data.materials.clear()
            o.data.materials.append(mat)


def remap(root, mapping, default=None):
    """Replace imported materials by name (prefix match, ignoring Blender's .001 suffixes)."""
    for o in [root] + list(root.children_recursive):
        if o.type != "MESH":
            continue
        for i, slot in enumerate(o.material_slots):
            nm = slot.material.name.split(".")[0] if slot.material else ""
            new = next((m for k, m in mapping.items() if nm.startswith(k)), default)
            if new:
                o.material_slots[i].material = new


def tint_texture_material(root, tint_hex):
    """Multiply an imported base-colour texture by a tint (keyboard keycaps grey → cream)."""
    for o in [root] + list(root.children_recursive):
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            m = slot.material
            if not m or not m.use_nodes or m.get("tinted"):
                continue
            nt = m.node_tree
            b = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
            link = next((l for l in nt.links if b and l.to_node == b and l.to_socket.name == "Base Color"), None)
            if not link:
                continue
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs["B"].default_value = (*srgb(tint_hex), 1)
            nt.links.new(link.from_socket, mix.inputs["A"])
            nt.links.new(mix.outputs["Result"], b.inputs["Base Color"])
            b.inputs["Roughness"].default_value = 0.45
            m["tinted"] = True


def laptop_screen(root, img):
    """The laptop is one mesh with one texture atlas: replace the atlas's screen rectangle with
    the generated page and emit only there (mask), keeping the rest of the laptop's texture."""
    for o in [root] + list(root.children_recursive):
        if o.type != "MESH":
            continue
        for slot in o.material_slots:
            m = slot.material
            nt = m.node_tree
            b = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
            uv = nt.nodes.new("ShaderNodeTexCoord")
            sep = nt.nodes.new("ShaderNodeSeparateXYZ")
            nt.links.new(uv.outputs["UV"], sep.inputs["Vector"])
            # Screen rectangle in UV space (atlas pixels 905–1295 × 140–720 of 2048, V flipped).
            u0, u1, v0, v1 = 905 / 2048, 1295 / 2048, 1 - 720 / 2048, 1 - 140 / 2048

            def between(sock, lo, hi):
                a = nt.nodes.new("ShaderNodeMath")
                a.operation = "GREATER_THAN"
                a.inputs[1].default_value = lo
                nt.links.new(sock, a.inputs[0])
                c = nt.nodes.new("ShaderNodeMath")
                c.operation = "LESS_THAN"
                c.inputs[1].default_value = hi
                nt.links.new(sock, c.inputs[0])
                d = nt.nodes.new("ShaderNodeMath")
                d.operation = "MULTIPLY"
                nt.links.new(a.outputs[0], d.inputs[0])
                nt.links.new(c.outputs[0], d.inputs[1])
                return d.outputs[0]

            mu, mv = between(sep.outputs["X"], u0, u1), between(sep.outputs["Y"], v0, v1)
            mask = nt.nodes.new("ShaderNodeMath")
            mask.operation = "MULTIPLY"
            nt.links.new(mu, mask.inputs[0])
            nt.links.new(mv, mask.inputs[1])
            # Remap UV inside the rectangle to 0–1 for the page image (rotated: the atlas lays the
            # screen out portrait).
            ru = nt.nodes.new("ShaderNodeMapRange")
            ru.inputs["From Min"].default_value, ru.inputs["From Max"].default_value = v0, v1
            rv = nt.nodes.new("ShaderNodeMapRange")
            rv.inputs["From Min"].default_value, rv.inputs["From Max"].default_value = u1, u0
            nt.links.new(sep.outputs["Y"], ru.inputs["Value"])
            nt.links.new(sep.outputs["X"], rv.inputs["Value"])
            comb = nt.nodes.new("ShaderNodeCombineXYZ")
            nt.links.new(ru.outputs["Result"], comb.inputs["X"])
            nt.links.new(rv.outputs["Result"], comb.inputs["Y"])
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = img
            tex.extension = "CLIP"
            nt.links.new(comb.outputs["Vector"], tex.inputs["Vector"])
            em = nt.nodes.new("ShaderNodeMix")
            em.data_type = "RGBA"
            em.inputs["A"].default_value = (0, 0, 0, 1)
            nt.links.new(mask.outputs[0], em.inputs["Factor"])
            nt.links.new(tex.outputs["Color"], em.inputs["B"])
            nt.links.new(em.outputs["Result"], b.inputs["Emission Color"])
            b.inputs["Emission Strength"].default_value = 1.0
            # Inside the screen: near-black, glossy base (a powered display, not a print).
            base_link = next((l for l in nt.links if l.to_node == b and l.to_socket.name == "Base Color"), None)
            if base_link:
                dark = nt.nodes.new("ShaderNodeMix")
                dark.data_type = "RGBA"
                dark.inputs["B"].default_value = (0.008, 0.008, 0.01, 1)
                nt.links.new(base_link.from_socket, dark.inputs["A"])
                nt.links.new(mask.outputs[0], dark.inputs["Factor"])
                nt.links.new(dark.outputs["Result"], b.inputs["Base Color"])
            rough_link = next((l for l in nt.links if l.to_node == b and l.to_socket.name == "Roughness"), None)
            gloss = nt.nodes.new("ShaderNodeMix")
            gloss.data_type = "FLOAT"
            gloss.inputs["B"].default_value = 0.1
            if rough_link:
                nt.links.new(rough_link.from_socket, gloss.inputs["A"])
            else:
                gloss.inputs["A"].default_value = b.inputs["Roughness"].default_value
            nt.links.new(mask.outputs[0], gloss.inputs["Factor"])
            nt.links.new(gloss.outputs["Result"], b.inputs["Roughness"])
            m["screen"] = True


# ---------------------------------------------------------------- world and lights

def sky_world(name, stops, strength):
    """A gradient sky on the view direction: generic and already blurred (no landscape)."""
    w = bpy.data.worlds.get(name) or bpy.data.worlds.new(name)
    w.use_fake_user = True  # keep both skies in the .blend even when one is inactive
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "EASE"
    els = ramp.color_ramp.elements
    els[0].position, els[0].color = stops[0][0], (*srgb(stops[0][1]), 1)
    els[1].position, els[1].color = stops[-1][0], (*srgb(stops[-1][1]), 1)
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = (*srgb(col), 1)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(coord.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
    return w


def light(name, kind, coll, energy, color=(1, 1, 1), loc=(0, 0, 0), aim=None, size=None, **kw):
    data = bpy.data.lights.new(name, kind)
    data.energy = energy
    data.color = color
    if size is not None:
        if kind == "AREA":
            data.shape = "RECTANGLE"
            data.size, data.size_y = size
        elif kind == "SUN":
            data.angle = math.radians(size)
    for k, v in kw.items():
        setattr(data, k, v)
    o = bpy.data.objects.new(name, data)
    coll.objects.link(o)
    o.location = loc
    if aim is not None:
        o.rotation_euler = Vector(aim).to_track_quat("-Z", "Y").to_euler()
    return o
