#!/usr/bin/env bash
# Builds the home hero video (js/hero-video.js) from the three Higgsfield clips in assets/videos/
# (not in Git): video1.mp4 living room -> corner | video2.mp4 corner -> kitchen | video3.mp4 kitchen -> pool deck.
# Usage (Git Bash or WSL, with ffmpeg): tools/make-hero-video.sh [site root, default .]
# Output: assets/video/tour.mp4 (desktop, 1600 wide, ~7 MB) and tour-mobile.mp4 (1024 wide, ~2.5 MB).
# The clips share their edge frames (end of one = start of the next), so the first frame of clips 2-3 is dropped.
# A keyframe every 12 frames keeps scroll scrubbing smooth. After replacing the files, bump V in js/hero-video.js.
set -euo pipefail
ROOT="${1:-.}"; IN="$ROOT/assets/videos"; OUT="$ROOT/assets/video"
mkdir -p "$OUT"
FC="[0:v]setpts=PTS-STARTPTS[a];[1:v]trim=start_frame=1,setpts=PTS-STARTPTS[b];[2:v]trim=start_frame=1,setpts=PTS-STARTPTS[c];[a][b][c]concat=n=3:v=1:a=0,scale=WIDTH:-2:flags=lanczos,format=yuv420p[v]"
X264="-an -c:v libx264 -preset slower -tune film -g 12 -keyint_min 12 -sc_threshold 0 -bf 2 -movflags +faststart"
ffmpeg -y -i "$IN/video1.mp4" -i "$IN/video2.mp4" -i "$IN/video3.mp4" -filter_complex "${FC/WIDTH/1600}" -map "[v]" $X264 -crf 28 "$OUT/tour.mp4"
ffmpeg -y -i "$IN/video1.mp4" -i "$IN/video2.mp4" -i "$IN/video3.mp4" -filter_complex "${FC/WIDTH/1024}" -map "[v]" $X264 -crf 30 "$OUT/tour-mobile.mp4"
ls -la "$OUT"
