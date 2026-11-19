#!/bin/sh
# Encodes a rendered transition (frames from render_clip.py) to H.264 at 60 fps for the web, plus
# its reverse (the way back), and prints the sizes.
#   sh scripts/scene/encode_clip.sh <frames dir> <out prefix>   e.g.  ... <out dir>/monitor-desktop
#   -> <out prefix>-in.mp4, <out prefix>-out.mp4
set -eu
SRC=$1
OUT=$2
mkdir -p "$(dirname "$OUT")"
ENC="-c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -movflags +faststart -an"
ffmpeg -y -loglevel error -framerate 60 -i "$SRC/frame_%03d.png" $ENC "$OUT-in.mp4"
ffmpeg -y -loglevel error -i "$OUT-in.mp4" -vf reverse $ENC "$OUT-out.mp4"
ls -l "$OUT-in.mp4" "$OUT-out.mp4" | awk '{print $5, $9}'
