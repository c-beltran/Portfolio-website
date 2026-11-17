# Assets

Raw source files (downloads, `.blend` files, renders, later scans and photos) live **outside this repo** in `~/Portfolio-assets/` on Carlos's Mac (decision Q12). Only optimized outputs are committed:

- `public/models/`: GLB files (Meshopt/Draco geometry, KTX2 textures), from M3b
- `public/stills/`: Tier 1 renders (AVIF + WebP), after Carlos approves the M3a look

## Where the raw files live

```
~/Portfolio-assets/
  downloads/   CC0 / licensed inputs exactly as downloaded (glTF, HDR, textures)
  blend/       workspace.blend, built by scripts/scene/build_scene.py
  renders/     Cycles stills (clay, day, lamp, phone crop)
  compare/     the look-review sheet (private: never committed)
```

The scene is rebuilt from scratch by `scripts/scene/build_scene.py`. Every downloaded input is pinned by URL and sha256 in `scripts/scene/assets.json`.

## Asset register

Every model, texture and image used in the build is listed here, with its source and license. The register grows as inputs are added. It must match `scripts/scene/assets.json`.

| Asset | Source | License | Raw file | Output |
| ----- | ------ | ------- | -------- | ------ |
| Desk, mat, notepad, pen, card, badge, photo frame, kit case, light bar | Built in code (`scripts/scene/build_scene.py`) | This repo | generated | `[TODO: M3b]` |
| Photo in the frame | Carlos (Q13) | Carlos's own | `[TODO]` | `[TODO]` |
| Handwriting on the notepad | Carlos (Q13) | Carlos's own | `[TODO]` | `[TODO]` |
