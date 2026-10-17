# Animated-image fixtures

Deterministic GIF, APNG and animated WebP files for `dist/file-analysis.html`. **Most of them flash intentionally.** Nothing in this folder autoplays, and the file-analysis page never displays them.

| Fixture | Formats | Expected flashes / s (display timing) | Purpose |
| --- | --- | --- | --- |
| `bw-4hz` | GIF, APNG, WebP | 4 | Full-frame black/white, 120 ms frames |
| `bw-2hz`, `bw-3hz` | GIF, APNG, WebP | 2, 3 | Below the frequency limit |
| `seam-loop-4hz` | GIF, APNG, WebP | 4 | Two frames: flashing exists only across the loop seam |
| `seam-once-4hz` | GIF, APNG, WebP | 0 | The same frames, played once |
| `fast-10ms` | GIF, APNG, WebP | 5 (50 as encoded) | Browsers show frames of 10 ms or less for 100 ms |
| `low-contrast-4hz` | GIF, APNG, WebP | 0 | ΔY about 0.028. Safe to view. |
| `red-cyan-4hz` | APNG, WebP | 4 (and 4 red) | Saturated red / cyan |
| `small-zone-4hz` | GIF, APNG, WebP | 4 | 8 × 8 white square; area depends on displayed size |
| `transparent-4hz` | APNG, WebP | 4 over white, 0 over black | Flashing depends on the page background |

`manifest.json` lists each file's frame durations, loop count, SHA-256 and expected counts under three conditions: display timing, encoded timing, and display timing over black. The counts are computed from the definitions in `generate-animated-fixtures.py`, not from the app.

Regenerate with `python3 generate-animated-fixtures.py`. It needs `img2webp` (libwebp) and `ffprobe`; on macOS, `brew install webp ffmpeg`.
- GIF and APNG are written directly by the script, so their delays are exact.
- Every GIF and APNG frame duration is read back with ffprobe.
- WebP timing is checked in Chrome by `tools/verify-file-analysis.mjs`.

These files exercise decoding, timing models, loop seams and transparency. They do not validate arbitrary real-world animations or browser display timing. No conformance verdict is implied.
