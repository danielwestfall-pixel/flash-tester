# Flash Review coverage roadmap

Scope: SC 2.3.1 for browser animations, video and displayed image sequences; separate SC 2.3.2 and 2.3.3 reviews. A completed fixture/test does not certify the detector or a webpage.

## Current gate: native verification and repair retest

Updated October 17, 2026. Build `flash-review-0.4.5-20261017`, algorithm `flash-screen-0.4.2`. Branch `claude/nf02-nf04-mac-native`.

**Disposition: repairs NF-02 to NF-08 pass their tests here, but the agent that wrote them also checked them. An independent red-team retest is PENDING. The overall gate stays BLOCKED on that retest, the Windows rerun and reviewer-operated coverage.** Do not advance to another implementation item until the red-team retest passes. Original captures stay local; source, fixtures and this handoff are published.

### Done in this round (self-verified)

- [x] NF-02 (P2): rejected calibration reported as "not supplied". Repaired in 0.4.3: `calibration-rejected` status with retained input, reason and rejected source pixels across the UI and all five exports. Mocked regression; automated macOS native retest PASS. `docs/NF02_NF03_REPAIR.md`.
- [x] NF-03 (P3): CSV buttons silently did nothing without evidence. Repaired in 0.4.3: metadata-only CSVs, `evidence_coverage_json` status `not-collected`. Mocked regression; macOS native PASS.
- [x] NF-04 (P2): the first-frame geometry lock raced the sharing-infobar animation (4/5 calibrated captures rejected). Repaired in 0.4.4: 0.5 s startup settling, discarded frames reported. 5/5 natively on macOS.
- [x] NF-06 (P2): the calibrated area upper bound could undercount at reduced resolution. Repaired in 0.4.5 / algorithm 0.4.2: one-cell dilated upper bound plus a separate lit-cell value. Hand-computed cases, the counterexample and a 160-case sweep; native video retest. `docs/NF06_NF08_REPAIR.md`.
- [x] NF-07 (P3): misleading reason when only one frame arrives. Repaired in 0.4.5 (mocked regression only).
- [x] NF-08 (P2): stale cached modules could mix builds silently. Repaired in 0.4.5: the module version guard refuses capture/load. Native stale-module check.
- [x] macOS native set (CDP automation, Chrome 155): static presentation matrix (default, maximized, macOS fullscreen, content fullscreen, small layout), screenshot opt-out, resize stop, seven playback stop paths including a direct same-window tab switch, and headless positive witness/opt-out. `docs/MAC_NATIVE_RESULTS.md`.
- [x] Video fixtures:
  - A: 24 ffmpeg-encoded H.264/VP9 files with Gray-coded frame index, decoded and verified by `test-video-fixtures.py`.
  - B: 40 browser-encoded files (VP9/VP8/H.264/AV1). One VP8 red/cyan colour FAIL is retained as an encoder finding.
  - Native-player target page.
- [x] Video capture on macOS: safe moving bar headful in five presentations (40–52 fps), and all flashing fixtures headless (44–60 fps). All 21 runs meeting the sampling minimum matched the expected flash counts and flag decisions.

### Still open for this gate

- [ ] Independent red-team retest of NF-02 to NF-08, the macOS evidence and the video fixtures (prompt kept with the handoff).
- [ ] Windows rerun on 0.4.5: NF-02/03/04/06/08, static matrix including F11, playback stop paths, video capture. The earlier Windows rows were on 0.4.2.
- [ ] Reviewer-operated runs: native sharing picker; physical Ctrl+Cmd+F / green button / F11; on-screen animated captures (they flash, so they need consent).
- [ ] Player-fullscreen video capture that meets the sampling minimums. On macOS, Chrome's fullscreen media controls caused a ~0.25 s capture stall in every attempt.
- [ ] Device coverage: zoom other than 100%, external monitors and other DPRs, Edge.
- [ ] The macOS static matrix was recorded on 0.4.4. Rerun it on 0.4.5 if the red team requires current-build evidence; the area change affects only calibrated area values.

### Earlier repairs

- [x] AI-01: evaluate both nonoverlapping pairing phases; retain the exact 32-image/seed-1 regression, inverted polarity, orphan plateaus and three/four boundaries.
- [x] AI-02: release/invalidate resources on navigation, require reload after restoration, abort old loads and reject late decoded images/results.
- [x] AI-03: share presentation/calibration/build/coverage metadata across HTML, text and both CSVs, including metadata-only empty files.
- [x] Independent targeted red-team retest of AI-01/02/03: PASS within tested conditions (`retest-0.4.1-2026-10-16/audit.html`, local).
- [x] NF-01 (P2): 0.4.2 playback clock repair; independent native duration/resize/visibility-hidden checks pass. `docs/NF01_REPAIR.md`.
- [x] Native tab-hide and window-resize playback verification with original exports (Windows 0.4.2, then macOS 0.4.4 including direct tab switching).

## 1. Calibrated area measurement (first implementation)

- [x] Implement a moving 341 × 256 CSS-pixel reference field, pixel-area weighting, and a 21,824 CSS-pixel threshold.
- [x] Require explicit captured/displayed CSS dimensions; never infer CSS size from encoded pixels or capture resolution.
- [x] Report sampled simultaneous pair-completion area separately from a conservative rolling spatial envelope. Do not call a rolling union concurrent flashing.
- [x] Preserve candidate detection even for small areas; export geometry, algorithm scope, measurement bounds and incomplete coverage.
- [x] Test below/equal/above threshold, window edges, nearby/separated regions, staggered timing, scaling and missing calibration.
- [ ] Validate asynchronous/gradual/moving flash areas against an independent reference; support precise temporal overlap, not just sample-aligned completions.
- [ ] Validate real tab capture at reference geometry and largest available presentation scale. macOS static and video captures cover maximized/fullscreen scales; reference viewing geometry is still not measured.
- [ ] Automate/document full validation of the size matrix for BOTH video and browser animations (macOS: automated harness in local evidence covers static target and video; browser-animation states and Windows remain): initial/default presentation, maximized browser, browser fullscreen (F11), and content/player fullscreen where supported. Record viewport CSS size, displayed content rectangle, source resolution, DPR, zoom and fullscreen kind for each run. F11 and player fullscreen are distinct scenarios.
- [ ] Include smaller responsive breakpoints when they change the animation, crop, layout or visible content; test all relevant states at standard zoom. Smaller viewports are coverage cases, not a universal WCAG-prescribed list of dimensions.

## 2. Inputs and image sequences

- [x] Accept multiple local image files, preserving local processing and releasing decoded image resources.
- [x] Accept newline-separated HTTPS/HTTP image URLs, with per-image loading/CORS/decode failures and incomplete-coverage reporting.
- [x] Provide deterministic ordered-pair screening, including reverse direction, at a chosen transition rate and displayed size.
- [x] Provide seeded shuffled playback with an exact order/timing log; explicit Start, Stop, Escape, tab-hide stop and duration cap.
- [x] Provide downloadable deterministic PNG patterns for passing/failing/area/red cases; no automatic flashing preview.
- [ ] Add sequence import/export, dwell times, fades, contain/cover/crop, background and responsive presentation settings.
- [ ] Add ordered triples/multi-state trajectories, loop boundaries, adversarial sequence search and whole-sequence review. Pair screening/random samples cannot prove every possible combination passes.
- [x] Reject GIF, APNG and animated WebP explicitly; full timeline decoding remains future work.
- [x] Download reports linking loaded image labels, sequence, rate, geometry and detector build; omit source URLs. Persistent history/content hashes remain future work.

## 3. Video

- [ ] Accept local video files and CORS-enabled video URLs, decode without a flashing preview, retain frame timestamps and source metadata.
- [x] Add reproducible encoded video fixtures (frequency, contrast, red and area), validate decoded pixels/timestamps against source patterns. `fixtures/video/`, `generate-video-fixtures.py`, `test-video-fixtures.py` (requires ffmpeg); browser-encoded variants via `fixtures/video/recorder.html`.
- [ ] Handle variable frame rate, duplicate/drop frames, decode errors, seeks, loop seams and short bursts. Drop/dup/VFR fixtures exist and captured counts matched; direct decoding, decode errors and seeks remain.
- [ ] Record displayed CSS size independently of encoded resolution, including fullscreen testing. Video target page records element/content rectangles and player fullscreen; macOS capture covered five presentations, but player fullscreen did not meet the sampling minimum.
- [ ] Reject/mark unsupported HDR or wide-gamut inputs; add a validated color-management path before claiming coverage.

## 4. Detector boundaries and exceptions

- [ ] Luminance delta just below/at/above 0.10; darker-state luminance around 0.80; quantization and codec changes.
- [ ] Saturated-red ratio around 0.8 and chromaticity around 0.2; constant-luminance changes, black endpoints, curved trajectories, independent red validation.
- [ ] Balanced fine patterns/checkerboards/noise below/at/above 0.1 degree, with geometry and antialiasing checks.
- [ ] Extend rolling-second irregular burst, phase, duty cycle, gradual ramp, moving-region and mixed-frequency tests.
- [ ] Browser/device matrix: presentation vs capture rates, aliasing, throttling, DPR/zoom, resizing, protected video, canvas filtering and dropped frames.
- [ ] Cross-check reference outputs using a validated specialist analyzer and retain disagreements as regressions.

## 5. Other criteria and reporting

- [ ] SC 2.3.2 (AAA): separate strict three-flash evaluation; do not apply SC 2.3.1 area/brightness exceptions as a clearance.
- [ ] SC 2.3.3 (AAA): manual interaction checklist, motion-disable controls, reduced-motion preference, essential-motion rationale and state coverage.
- [ ] Coverage matrix and exports separating measured results, assumptions, unsupported inputs and untested states. No automatic whole-page conformance verdict.

Sources: [SC 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [SC 2.3.2](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes.html), [SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
