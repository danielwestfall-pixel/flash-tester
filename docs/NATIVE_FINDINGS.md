# Native verification finding NF-01

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
