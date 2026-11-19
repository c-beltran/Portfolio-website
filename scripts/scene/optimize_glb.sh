#!/bin/sh
# Optimizes bake.py's outputs for the live scene: Meshopt geometry (names kept; no join, no
# simplify), WebP lightmaps. Prints gzipped sizes.
#   sh scripts/scene/optimize_glb.sh [raw glb] [bake dir] [out dir]
set -eu
RAW=${1:-$HOME/Portfolio-assets/glb/scene-raw.glb}
BAKE=${2:-$HOME/Portfolio-assets/bake}
OUT=${3:-public/scene}
mkdir -p "$OUT/bake"
pnpm exec gltf-transform meshopt "$RAW" "$OUT/scene.glb" --level medium
node scripts/scene/encode_bake.mjs "$BAKE" "$OUT/bake"
printf 'scene.glb gzipped: %s bytes\n' "$(gzip -9c "$OUT/scene.glb" | wc -c | tr -d ' ')"
