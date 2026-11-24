#!/bin/sh
# Optimizes bake.py's outputs for the live scene: Meshopt geometry (names kept; no join, no
# simplify), WebP lightmaps. Prints gzipped sizes.
#   sh scripts/scene/optimize_glb.sh [raw glb] [bake dir] [out dir] [raw movers glb] [opened dir]
# The movers keep their hierarchy and clips in movers.glb; their opened
# bakes load on demand, so they go to public/opened/bake, outside the first load.
set -eu
RAW=${1:-$HOME/Portfolio-assets/glb/scene-raw.glb}
BAKE=${2:-$HOME/Portfolio-assets/bake}
OUT=${3:-public/scene}
MOVERS=${4:-$HOME/Portfolio-assets/glb/movers-raw.glb}
OPENED=${5:-public/opened}
OPEN='kit-open,phone-open,badge-open,photo-open,notepad-open,card-open,car-open,ball-open,mug-open'
mkdir -p "$OUT/bake" "$OPENED/bake"
pnpm exec gltf-transform meshopt "$RAW" "$OUT/scene.glb" --level medium
pnpm exec gltf-transform meshopt "$MOVERS" "$OUT/movers.glb" --level medium
node scripts/scene/split_spin.mjs "$OUT/movers.glb" "$OUT"
node scripts/scene/encode_bake.mjs "$BAKE" "$OUT/bake" 82 --skip "$OPEN"
node scripts/scene/encode_bake.mjs "$BAKE" "$OPENED/bake" 82 --only "$OPEN"
for f in scene movers spin-car spin-ball spin-mug; do
  printf '%s.glb gzipped: %s bytes\n' "$f" "$(gzip -9c "$OUT/$f.glb" | wc -c | tr -d ' ')"
done
