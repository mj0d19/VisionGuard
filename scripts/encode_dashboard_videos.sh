#!/usr/bin/env bash
# Re-encode dashboard demo MP4s (cam1–cam4) to H.264 + AAC for browser <video> playback.
# Requires: ffmpeg (e.g. sudo apt install ffmpeg on Ubuntu/WSL)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VID="$ROOT/frontend/public/videos"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found. Install it first, e.g.: sudo apt install ffmpeg" >&2
  exit 1
fi

encode_one() {
  local in="$1" out="$2"
  # Prefer H.264 + AAC; if that fails (e.g. no audio), fall back to video-only
  if ffmpeg -y -hide_banner -loglevel warning -i "$in" \
      -c:v libx264 -preset medium -crf 23 -movflags +faststart \
      -c:a aac -b:a 128k "$out"; then
    return 0
  fi
  rm -f "$out"
  ffmpeg -y -hide_banner -loglevel warning -i "$in" \
    -c:v libx264 -preset medium -crf 23 -movflags +faststart -an "$out"
}

for n in 1 2 3 4; do
  in="$VID/cam${n}.mp4"
  tmp="$VID/cam${n}.tmp.h264.mp4"
  bak="$VID/cam${n}.mp4.bak"
  if [[ ! -f "$in" ]]; then
    echo "Skip (missing): $in" >&2
    continue
  fi
  echo "Encoding $in -> H.264/AAC ..."
  encode_one "$in" "$tmp"
  mv "$in" "$bak"
  mv "$tmp" "$in"
  echo "OK: $in (backup: $bak)"
done

echo "Done. Reload the dashboard; all cam feeds should play in the browser."
