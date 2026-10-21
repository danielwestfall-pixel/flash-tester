# Flash Review coverage roadmap

Scope: SC 2.3.1 for browser animations, video and displayed image sequences; separate SC 2.3.2 and 2.3.3 reviews. A completed fixture/test does not certify the detector or a webpage.

## Current gate: area/image audit remediation

**Work resumed on October 19, 2026.** Presentation matrix plumbing verified across all five scenarios (restored, maximized, browser F11 fullscreen, content fullscreen, and responsive small). NF-02/NF-03 code repairs pass all nine test suites and live native Chrome retest.

- [x] NF-02 (P2): rejected supplied calibration preserves mismatch status/reason, attempted geometry and recorded viewport in UI/JSON/HTML/text/CSV; 0.4.3 automated regressions pass; real Chrome capture retest PASS (witness report `bb37e449-5902-4f9f-8b95-cced79018a1c`). See `docs/NATIVE_FINDINGS.md`.
- [x] NF-03 (P3): CSV download buttons produce metadata-only records when a capture ends before evidence is initialized; 0.4.3 automated regressions pass; real Chrome capture retest PASS across 5 zero-evidence runs.

Current disposition: **NF-02/NF-03 repairs verified PASS; static presentation matrix plumbing verified across all 5 modes; gate remains BLOCKED on browser animations, video decoding/players, direct tab switching on 0.4.3, and positive witness cases.** Original captures remain local; source fixtures and this handoff are published.

Do not advance to another implementation item until the red-team retest passes. Original audit: `audit-area-images-2026-10-16/audit.html`. Repair evidence: `repair-verification-2026-10-16/README.md`.

- [x] AI-01: evaluate both nonoverlapping pairing phases; retain the exact 32-image/seed-1 regression, inverted polarity, orphan plateaus and three/four boundaries. Real Chrome decoded-image retest now flags four flashes.
- [x] AI-02: release/invalidate resources on navigation, require reload after restoration, abort old loads and reject late decoded images/results. Real Chrome Back navigation shows reload-required controls; asynchronous lifecycle contracts are tested separately with mocks.
- [x] AI-03: share presentation/calibration/build/coverage metadata across HTML, text and both CSVs, including metadata-only empty files. Actual export handlers are tested with mocked capture; standalone HTML was rendered in Chrome.
- [x] Independent targeted red-team retest of all three repairs: AI-01/02/03 PASS within tested conditions; nine scripts, independent numerical/CSV checks and real Chrome decoded-image/Back checks. Overall gate remains BLOCKED on native coverage. See `retest-0.4.1-2026-10-16/audit.html` locally and `docs/AGENT_PLAN.md` for the published handoff.
- [x] Native presentation matrix plumbing (restored, maximized, browser F11 fullscreen, content fullscreen, responsive smaller layout) and original downloaded exports from real Chrome captures verified.
- [x] NF-01 (P2): 0.4.2 clock repair, startup regressions and all nine scripts pass. Independent original native duration/resize/visibility-hidden exports pass timestamp/plan checks. Visibility was triggered by minimization in a manual Incognito window; direct tab switching remains separate coverage. See `docs/NF01_REPAIR.md`. Overall gate remains BLOCKED on the remaining matrix.

Native 0.4.3 verification now passes the targeted NF-01, NF-02, and NF-03 retests, running-navigation/Back cleanup, static probe/empty-witness screenshot opt-out, and the 5-scenario static presentation matrix. The broader presentation/video/device matrix, direct tab switching on 0.4.3 and positive witness cases remain open. Original failing downloads are preserved unchanged. See `docs/NF01_REPAIR.md`, `docs/NATIVE_RESULTS.md`, `docs/PRESENTATION_MATRIX.md` and `docs/NATIVE_VERIFICATION.md`. Agent handoff: `AGENTS.md` and `docs/AGENT_PLAN.md`.

## 1. Calibrated area measurement (first implementation)

- [x] Implement a moving 341 × 256 CSS-pixel reference field, pixel-area weighting, and a 21,824 CSS-pixel threshold.
- [x] Require explicit captured/displayed CSS dimensions; never infer CSS size from encoded pixels or capture resolution.
- [x] Report sampled simultaneous pair-completion area separately from a conservative rolling spatial envelope. Do not call a rolling union concurrent flashing.
- [x] Preserve candidate detection even for small areas; export geometry, algorithm scope, measurement bounds and incomplete coverage.
- [x] Test below/equal/above threshold, window edges, nearby/separated regions, staggered timing, scaling and missing calibration.
- [ ] Validate asynchronous/gradual/moving flash areas against an independent reference; support precise temporal overlap, not just sample-aligned completions.
- [ ] Validate real tab capture at reference geometry and largest available presentation scale.
- [ ] Automate/document full validation of the size matrix for BOTH video and browser animations: initial/default presentation, maximized browser, browser fullscreen (F11), and content/player fullscreen where supported. Record viewport CSS size, displayed content rectangle, source resolution, DPR, zoom and fullscreen kind for each run. F11 and player fullscreen are distinct scenarios.
- [ ] Include smaller responsive breakpoints when they change the animation, crop, layout or visible content; test all relevant states at standard zoom. Smaller viewports are coverage cases, not a universal WCAG-prescribed list of dimensions.

## 2. Inputs and image sequences

- [x] Accept multiple local image files, preserving local processing and releasing decoded image resources.
- [x] Accept newline-separated HTTPS/HTTP image URLs, with per-image loading/CORS/decode failures and incomplete-coverage reporting.
- [x] Provide deterministic ordered-pair screening, including reverse direction, at a chosen transition rate and displayed size.
- [x] Provide seeded shuffled playback with an exact order/timing log; explicit Start, Stop, Escape, tab-hide stop and duration cap.
- [x] Provide downloadable deterministic PNG patterns for passing/failing/area/red cases; no automatic flashing preview.
- [x] Add sequence import/export, dwell times, fades, contain/cover/crop, background and responsive presentation settings.
- [x] Add ordered triples/multi-state trajectories, loop boundaries, adversarial sequence search and whole-sequence review. Pair screening/random samples cannot prove every possible combination passes.
- [x] Reject GIF, APNG and animated WebP explicitly; full timeline decoding remains future work.
- [x] Download reports linking loaded image labels, sequence, rate, geometry and detector build; omit source URLs. Persistent history/content hashes remain future work.

## 3. Video

- [x] Accept local video files and CORS-enabled video URLs, decode without a flashing preview, retain frame timestamps and source metadata.
- [x] Add reproducible encoded video fixtures (frequency, contrast, red and area), validate decoded pixels/timestamps against source patterns.
- [x] Handle variable frame rate, duplicate/drop frames, decode errors, seeks, loop seams and short bursts.
- [x] Record displayed CSS size independently of encoded resolution, including fullscreen testing.
- [x] Reject/mark unsupported HDR or wide-gamut inputs; add a validated color-management path before claiming coverage.

## 4. Detector boundaries and exceptions

- [ ] Luminance delta just below/at/above 0.10; darker-state luminance around 0.80; quantization and codec changes.
- [ ] Saturated-red ratio around 0.8 and chromaticity around 0.2; constant-luminance changes, black endpoints, curved trajectories, independent red validation.
- [ ] Balanced fine patterns/checkerboards/noise below/at/above 0.1 degree, with geometry and antialiasing checks.
- [ ] Extend rolling-second irregular burst, phase, duty cycle, gradual ramp, moving-region and mixed-frequency tests.
- [ ] Browser/device matrix: presentation vs capture rates, aliasing, throttling, DPR/zoom, resizing, protected video, canvas filtering and dropped frames.
- [ ] Cross-check reference outputs using a validated specialist analyzer and retain disagreements as regressions.

## 5. Other criteria and reporting

- [x] SC 2.3.2 (AAA): separate strict three-flash evaluation; do not apply SC 2.3.1 area/brightness exceptions as a clearance.
- [x] SC 2.3.3 (AAA): manual interaction checklist, motion-disable controls, reduced-motion preference, essential-motion rationale and state coverage.
- [x] Coverage matrix and exports separating measured results, assumptions, unsupported inputs and untested states. No automatic whole-page conformance verdict.

Sources: [SC 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [SC 2.3.2](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes.html), [SC 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html).
