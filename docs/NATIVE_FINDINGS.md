# Native verification findings

## Current pause status — October 16, 2026

NF-01 passes its targeted repair retest. New NF-02/NF-03 below remain actionable and unrepaired: **current reporting/export scope FAIL; incomplete native coverage BLOCKED.** Work paused at the user's request. These findings were observed in real Chrome against build `flash-review-0.4.2-20261016`, algorithm `flash-screen-0.4.1`; production source was unchanged from baseline `617251c` during this verification. Source/docs fixture publication `073f760` did not change production. No conformance finding is made.

### P2 — NF-02: rejected supplied calibration is reported as missing

Locations: `dist/app.mjs:24` (zero-frame fallback), `dist/app.mjs:63` (aspect mismatch before analyzer initialization), `dist/analyzer.mjs:151` (fallback area reason).

Reproduction: enable area calibration with 1264 × 445 CSS dimensions, select maximized presentation, share the static target in Chrome. The first supplied captured aspect ratio differs by more than the allowed tolerance, so capture ends before analyzer/evidence initialization. This happened in the original maximized retry, report `83227c50-cbd7-4896-b3d2-8a44a680e69a`.

Expected: retain supplied dimensions and explain that calibration was rejected for an aspect mismatch, with area not evaluated. The primary area explanation should agree with the stop reason; rejected observed geometry should be recorded where available.

Actual: JSON retains `captureSettings.calibration={cssWidth:1264,cssHeight:445}` and an explicit aspect-mismatch `endedBecause`, but `area.reason` says `Displayed CSS dimensions were not supplied.` The primary UI, HTML and text repeat that false explanation. No sampled viewport was recorded before rejection.

Impact: reviewers receive contradictory calibration provenance and cannot distinguish missing input from rejected input using the area result. The run correctly reports zero frames, insufficient observation and conformance not determined; no false pass was observed.

Evidence: all three original downloads, their SHA-256 hashes and source resize histories are under `native-verification-2026-10-16/presentation-matrix/`. See `maximized-calibration-rejection-downloads.json` for authoritative hashes. These are native capture/export artifacts, not mocks.

Remediation: represent rejected calibration separately from absent calibration, preserve the input and rejection reason across UI/JSON/HTML/text/CSV, and add a zero-frame mismatch regression plus independent native/export retest. Do not weaken the aspect mismatch guard to make the scenario complete.

### P3 — NF-03: enabled CSV controls silently do nothing without evidence

Locations: `dist/app.mjs:132` and `dist/app.mjs:133` (download handlers guard on `report.evidence`); report controls are exposed in `dist/index.html`.

Reproduction: after the same zero-frame rejection, click Download selected-probe CSV and Download detection-witness CSV. Both controls are enabled. JSON, HTML and text downloads succeed.

Expected: either download truthful metadata-only CSVs with no invented measurements, or visibly disable the unavailable controls and explain why.

Actual: both handlers return silently because evidence was never initialized. Neither CSV download is created; there is no user-facing explanation. The original-download directory contains only JSON/HTML/text for that report. An independent validator expecting empty metadata CSVs failed on missing files; no pass is claimed for those files.

Impact: reviewers cannot obtain the advertised CSVs for a failed capture and cannot tell whether the operation succeeded. Existing metadata-only CSV behavior when an Evidence object exists does not cover this earlier failure path.

Remediation: make zero-evidence exports explicit and consistent, test actual handlers on pre-first-frame termination, and independently verify the resulting saved files or disabled-state explanation. Production code remains unchanged pending repair work.

## Historical NF-01

October 16, 2026. **Original 0.4.1 finding: FAIL. NF-01 now passes targeted 0.4.2 repair retest; overall coverage remains BLOCKED.** Original tested commit `b363d88b6b176426c7ac4e2c4c283960adaffbb3`, build `flash-review-0.4.1-20261016`. Production code was not repaired during that original independent verification; a later user-authorized repair is documented below.

Repair update: NF-01 passes targeted 0.4.2 retest. All nine scripts and independent original native duration/resize/visibility-hidden log checks pass; see [NF01_REPAIR.md](NF01_REPAIR.md) for exact methods and limitations. The failure evidence below remains the original 0.4.1 finding, not a claim that the same defect was reproduced in 0.4.2. The broader coverage gate remains BLOCKED.

## P2 — NF-01: negative and backwards elapsed callback timestamps

Location: `dist/image-sequences-page.mjs`, lines 112–114 (`tick`) and line 120 (startup).

Reproduction:

1. Load two identical static gray images in real Chrome. Use 320 × 240 CSS pixels, 20 image changes/s and seed 12345. Acknowledge and start playback.
2. Switch to the existing static target tab, or separately drag a window edge, before the three-second cap. Stop reason should identify that native action.
3. Download the original JSON. Compare the first two entries in `drawCallbacks`. The defect depends on startup timing; it does not occur on every run. The preserved original files reproduce the validation failure without any playback.

Expected: relative callback times begin at zero and remain nonnegative and nondecreasing. Equal timestamps need not imply separate presented frames.

Actual: two native runs record an initial immediate draw at zero followed by a callback before zero:

| Original run | First times (seconds) | Stop reason | Stop elapsed seconds |
| --- | --- | --- | --- |
| tab hide | `0`, `-0.003399999998509884`, `0.013200000001583249` | `tab hidden` | 0.6793 |
| window resize | `0`, `-0.0017799999956041575` | `viewport resized` | 0.9148 |

The source sets `started=performance.now()` and immediately calls `tick(started)`, then subtracts that baseline from subsequent requestAnimationFrame callback timestamps. The observed first callback timestamp can precede the startup baseline. The schedule lookup clamps negative elapsed times to its first image, so the stop controls and visible gray test still work, but exported relative time is invalid.

Impact: downstream callback/schedule comparisons encounter impossible negative time and backwards ordering. The advertised timing evidence is internally inconsistent. This finding does not demonstrate an incorrect numerical flash count or a missed stop event; numerical screening uses a separate generated clock. Callback logs still cannot establish presented/captured frames.

Evidence is local under `native-verification-2026-10-16/run-02/`:

- `tab-hide-download.json`, original `flash-image-sequence-results (14).json`, SHA-256 `ba91435c03d312d3fa680e34b27a68eb01b372490458c1185e712c17d16a74f5`.
- `resize-download.json`, original `flash-image-sequence-results (15).json`, SHA-256 `c0265fca83b4e9947eeace54f43d3bf4a1665d845413df001f6f47086de22f72`.
- `tab-hide-ui.json` and `resize-ui.json`: stage hidden, acknowledgment cleared, Play disabled after return.
- `validate_live.py` independently checks decoded input pixels, planned timestamps, callback order and schedule agreement against six original browser downloads. It exits 1 and writes `live-validation.json`: the two native action logs fail nonnegative/ordered timing; four earlier logs pass. The failing assertions were retained as findings rather than weakened to accept negative timestamps.

These are real Chrome playback exports following user-performed native actions. No synthetic visibility/resize events or mock animation callbacks supplied this evidence. Original audit artifacts remain unchanged.

## Remediation checklist

- [x] Use one consistent elapsed-time clock for immediate and scheduled draws; ensure startup and all later exported callback times are nonnegative/nondecreasing. Do not invent presented-frame timestamps or force artificial unique times.
- [x] Retain the two native counterexamples and add a production-path regression where the first supplied animation callback timestamp precedes startup. Cover ordinary startup, same-frame callbacks and repeated playback as well.
- [x] Rerun independent original-log checks against new native exports, including native visibility hiding by minimization and actual resizing; retain the failing originals unchanged. Direct tab switching on 0.4.2 remains a separate coverage gap.
- [x] Rerun the nine existing scripts after the repair, then independently retest the targeted fix before clearing NF-01.
- [ ] Complete the remaining native matrix in `NATIVE_RESULTS.md`. Passing this fix alone cannot close that coverage gate or establish WCAG conformance.
