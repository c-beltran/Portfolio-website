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
- **Movers** (phase 2): `obj_kit` and `obj_phone` are pivots (Empties) over rigid parts, with one clip each, keyed at 60 fps from frame 0: `kit_open` hinges `kit_lid` on `kit_base`, and `phone_turn` turns `phone_spin` (over `phone_body` and the clip quad `phone_screen`) a quarter about the screen. The geometry lives in `movers.py` (tests: `python3 -I scripts/scene/test_movers.py`). After a build, `$B -b ~/Portfolio-assets/blend/workspace.blend --python scripts/scene/check_movers.py` checks the hierarchy and both clips.
- **Downloads:** glTF only, CC0 or CC-BY, pinned by sha256 in `assets.json`. Each is a zip in `~/Portfolio-assets/downloads/`, fetched from the source in `docs/ASSETS.md`. The build checks the zip against its pin and every extracted file against the zip (`pins.py`; tests: `python3 -I scripts/scene/test_pins.py`), and stops on a missing or changed download. `--allow-proxy` builds with placeholder blocks instead, for layout only. Never open a downloaded `.blend`. Blender runs with autoexec off, which is the default.

## Hotspot bounds

```sh
Blender -b --factory-startup ~/Portfolio-assets/blend/workspace.blend \
  --python scripts/scene/export_bounds.py -- --out content/scene/bounds.json
```

Projects each `obj_*` through `cam_overview` into `content/scene/bounds.json` (normalized boxes, y down) and records `minCollisionFreeWidth`: the narrowest desk at which every hotspot, grown to at least 44×44 px, is free of overlaps. `content/scene/bounds.test.ts` re-derives it. It is a report: objects are never moved to make hotspots fit. The monitor's box is its screen, not its arm and clamp.
