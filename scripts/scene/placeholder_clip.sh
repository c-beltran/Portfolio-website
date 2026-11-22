#!/bin/sh
# A PLACEHOLDER for the Power Walk clip on the phone's screen, until Carlos
# sends a screen recording: abstract moving gradients, no text, no audio. Replace
# public/clips/power-walk.mp4 (and its poster) with the real recording, encoded the same way.
#
#   sh scripts/scene/placeholder_clip.sh
#
# 6 s at 30 fps, H.264 (yuv420p, crf 30, +faststart), 960 px wide; the height follows the phone
# screen's shape in content/scene/opened-art.json, rounded to even. Poster: its first frame (WebP).
set -eu
FFMPEG=${FFMPEG:-/opt/homebrew/bin/ffmpeg}
OUT=public/clips
W=960
H=$(node -e "
const a = require('./content/scene/opened-art.json').phone;
const [[x0, y0], [x1], [, y3]] = [a.screen[0], a.screen[1], a.screen[3]];
const aspect = ((x1 - x0) * a.aspect) / (y3 - y0);
console.log(2 * Math.round($W / aspect / 2));
")
mkdir -p "$OUT"
"$FFMPEG" -hide_banner -loglevel error -y \
  -f lavfi -i "gradients=s=${W}x${H}:d=6:r=30:speed=0.015:n=4:type=linear:c0=0x0f1b2d:c1=0x1f6f78:c2=0x3b2752:c3=0xe09a4f:seed=7" \
  -c:v libx264 -pix_fmt yuv420p -crf 30 -preset slow -an -movflags +faststart \
  "$OUT/power-walk.mp4"
"$FFMPEG" -hide_banner -loglevel error -y -i "$OUT/power-walk.mp4" -frames:v 1 "$OUT/poster.png"
node -e "require('sharp')('$OUT/poster.png').webp({ quality: 72 }).toFile('$OUT/power-walk-poster.webp').then(() => require('fs').unlinkSync('$OUT/poster.png'))"
printf 'power-walk.mp4 %sx%s: %s bytes\n' "$W" "$H" "$(wc -c < "$OUT/power-walk.mp4" | tr -d ' ')"
