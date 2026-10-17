# Video fixtures

Deterministic encoded videos for capture testing, plus a native-player target page and a browser encoder. **Ten of the twelve definitions flash intentionally.** Nothing here autoplays.

## Contents

| Path | Purpose |
| --- | --- |
| `patterns.json` | Single definition of every pattern, used by both encoders |
| `*.mp4`, `*.webm` | ffmpeg-encoded fixtures (H.264 High and VP9, 640 × 360, 60 fps, 4 s, BT.709 limited range, tagged) |
| `manifest.json` | Per-file frame plan, presentation timestamps, expected flash count, SHA-256 and encoder version |
| `index.html` | Video matrix target: native `<video controls>`, player fullscreen, geometry and `requestVideoFrameCallback` log |
| `recorder.html` | Browser encoder: draws the same patterns to an undisplayed canvas and records them with MediaRecorder |

Fixtures:

- **Safe to display:** `static-gray`, `low-contrast-4hz` (delta Y about 0.028) and `moving-bar` (delta Y about 0.068).
- **Flashing:** `bw-2hz`, `bw-3hz`, `bw-4hz`, `bw-10hz`, `red-cyan-4hz`, `small-zone-10hz` and `large-zone-4hz`.
- **Timing variants:** `bw-4hz-drops` (every 7th source frame removed, source timestamps kept) and `bw-4hz-dups` (every 5th frame replaced by its predecessor).

Every frame carries a 12-bit Gray-coded source frame index in a low-contrast band (RGB 120/132, delta Y about 0.043, below the 0.10 threshold). Decoded or captured frames can therefore be matched to source frames without the code itself counting as a flash.

## Generate and verify

Both scripts need ffmpeg with libx264 and libvpx-vp9 (`brew install ffmpeg`).

```sh
python3 generate-video-fixtures.py    # writes fixtures/video/*.mp4|webm and manifest.json
python3 test-video-fixtures.py        # decodes every file and checks it against patterns.json
```

The verifier checks:

- codec, size and BT.709 tags
- frame count and every presentation timestamp (to within 1 ms)
- the Gray-coded index of every decoded frame
- decoded RGB at sample points (within ±6 levels of the definition)
- that safe fixtures have no sample-point luminance step of 0.10 or more
- a flash count computed independently from the decoded pixels

Regeneration with the same ffmpeg build **and the same encoder libraries** is byte-identical. The committed files were made with ffmpeg 9.0.2, libx264 r3222 and libvpx 1.17.0; the manifest records only the ffmpeg version. Other builds or library versions may differ in bytes, so check decoded content rather than hashes alone.

Browser-encoded files are checked with `python3 test-video-fixtures.py DIR --browser-encoded`. In that mode the verifier reports dropped and repeated frames and timestamp spacing instead of requiring the plan.

## Target page

Serve with `python3 -m http.server 8775 --bind 127.0.0.1 --directory fixtures/video` and open `http://127.0.0.1:8775/`. Choose a fixture and format, then Load. Safe fixtures loop; flashing fixtures stay hidden until acknowledged, play once, and pause on Escape or tab hiding. `?fixture=ID&format=mp4|webm` preselects a file.

On macOS Chrome 155, the native controls auto-hiding produced a ~0.25 s tab-capture stall and one spurious low-count pair (see `docs/MAC_NATIVE_RESULTS.md`). For runs that need to meet the sampling minimums outside player fullscreen, disable controls on the element, or record their presence as a limitation.

These files exercise playback and capture plumbing. Passing them does not validate arbitrary real-world video, HDR or wide-gamut content, protected media, or detector sensitivity beyond the tested patterns. No conformance verdict is implied.
