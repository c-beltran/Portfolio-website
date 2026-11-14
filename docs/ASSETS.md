# Assets

Raw source files (LiDAR scans, `.blend` files, photos, the handwriting photo) live **outside this repo** (decision Q12). Only optimized outputs are committed:

- `public/models/`: GLB files (Meshopt/Draco geometry, KTX2 textures), produced by `scripts/optimize-models.sh`
- `public/stills/`: Tier 1 renders (AVIF + WebP), produced by `scripts/export-stills.ts`

## Where the raw files live

`[TODO: Carlos — folder location, e.g. iCloud Drive/Portfolio-assets/]`

Expected layout of that folder:

```
scans/        Polycam exports (test kit, mug, badge), raw and cleaned
blender/      desk.blend (the scene used for the bakes)
photos/       polaroid photo, sticky-note handwriting photo
```

## Asset register

Every model, texture and image used in the build is listed here, with its source and license.

| Asset                             | Source                                | License      | Raw file | Output   |
| --------------------------------- | ------------------------------------- | ------------ | -------- | -------- |
| Backflow test kit (gauge + hoses) | Scanned by Carlos (Polycam)           | Carlos's own | `[TODO]` | `[TODO]` |
| Desk, laptop, phone, lamp         | `[TODO: CC0 source, e.g. Poly Haven]` | `[TODO]`     | `[TODO]` | `[TODO]` |
| Polaroid photo                    | Carlos (Q13)                          | Carlos's own | `[TODO]` | `[TODO]` |
| Sticky-note handwriting           | Carlos (Q13)                          | Carlos's own | `[TODO]` | `[TODO]` |
