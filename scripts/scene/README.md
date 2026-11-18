# Workspace scene (M3a)

Builds and renders the 3D scene of the workspace headlessly with Blender 5.3. Inputs and outputs live outside the repo in `~/Portfolio-assets/` (see `docs/ASSETS.md`).

```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
# Build the scene from the code-built objects and the pinned downloads in assets.json
$B -b --factory-startup --python scripts/scene/build_scene.py -- --out ~/Portfolio-assets/blend/workspace.blend
# Render a view: clay | day | lamp, overview | phone (square)
$B -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/render.py -- --mode clay --camera overview --out ~/Portfolio-assets/renders/clay-overview.png
```

- **Object names** (the contract later steps rely on): `obj_monitor`, `obj_kit`, `obj_phone`, `obj_badge`, `obj_photo`, `obj_notepad`, `obj_card`, `obj_lightbar`. Decoration is named `deco_*`.
- **Downloads:** glTF only, CC0 or CC-BY, pinned by sha256 in `assets.json`. Never open a downloaded `.blend`. Blender runs with autoexec off, which is the default.

## Hotspot bounds

```sh
Blender -b --factory-startup ~/Portfolio-assets/blend/workspace.blend \
  --python scripts/scene/export_bounds.py -- --out content/scene/bounds.json
```

Projects each `obj_*` through `cam_overview` into `content/scene/bounds.json` (normalized boxes, y down) and records `minCollisionFreeWidth`: the narrowest desk at which every hotspot, grown to at least 44×44 px, is free of overlaps. `content/scene/bounds.test.ts` re-derives it. It is a report: objects are never moved to make hotspots fit. The monitor's box is its screen, not its arm and clamp.
