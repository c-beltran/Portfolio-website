# The scene pipeline

The desk is built by script with headless Blender 5.3. Inputs and intermediate files live in `~/Portfolio-assets/`. The scripts write the optimized web assets to `public/` and the layout data to `content/scene/`.

## Pipeline

Run in this order. Each script's header gives its arguments.

| Step        | Script                                                      | Produces                                          |
| ----------- | ----------------------------------------------------------- | ------------------------------------------------- |
| 1. Build    | `build_scene.py`                                            | `workspace.blend`, from code and pinned downloads |
| 2. Check    | `check_room.py`, `check_movers.py`                          | Pass or fail on the built scene                   |
| 3. Project  | `export_bounds.py`, `export_cameras.py`, `export_opened.py` | Click targets, cameras and poses                  |
| 4. Render   | `render.py`, `render_opened.py`, `render_masks.py`          | Stills, opened objects and glow masks             |
| 5. Bake     | `bake.py`, `probe.py`                                       | Lighting and reflections for the live desk        |
| 6. Optimize | `optimize_glb.sh`, `encode_*.mjs`                           | Files ready for the web                           |
| 7. Match    | `measure/residual.mjs`                                      | The live-to-still correction layer                |

Use `--python-exit-code 1` with Blender, which otherwise exits 0 when a script throws.

The window's weather draws on the patch of sky the window shows: `export_bounds.py` writes its corners (`quads.sky`) and its place on the live desk's sky plane (`skyUv`, from `sky_geo.py`); `render_masks.py --only sky` and `encode_sky.mjs` trace its glass to a vector clip (`sky-clip.json`, never an image, so it is never the page's largest paint).

Geometry lives in modules without `bpy` (`room.py`, `movers.py`, `framing.py`, `opened.py`, `sky_geo.py`), tested with `python3 -I scripts/scene/test_<name>.py`.

## Downloads

Only glTF under CC0 or CC BY, pinned by checksum in `assets.json` and credited in [ASSETS.md](../../docs/ASSETS.md). The build stops on a changed file. Never open a downloaded `.blend`.
