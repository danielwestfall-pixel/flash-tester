# Flash Review 0.5.1

October 18, 2026. Build `flash-review-0.5.1-20261018`, algorithm `flash-screen-0.5.1`. Branch `claude/nf02-nf04-mac-native`.

This release repairs the findings of the independent red-team audit of 0.5.0 (RT2-01 to RT2-13). The audit report is kept locally in `redteam-0.5.0-2026-10-17/REPORT.md` and is not published.

It was implemented and checked by the same AI model family that wrote 0.5.0 and ran the audit. **An independent retest of 0.5.1 is still required.** No result here is a WCAG conformance verdict.

## Repairs

| ID | Finding | Repair | Regression |
| --- | --- | --- | --- |
| RT2-01 (P2) | Thin stripes flashing on a bright page blend above the 0.80 darker-state limit. 0.5.0 reported "no candidates" with area bound 0. | The low-contrast area channel has no darker-state limit. When the strict channel finds frequent pairs that only the 0.80 rule exempts, and there are no SC 2.3.1 candidates, the SC 2.3.1 result is **inconclusive** (insufficient observation) with that reason, not "no candidates". | `test-area-erased.mjs` (the audit's bright grating: true 44,032 CSS px², the bound now covers it); `test-thresholds.mjs` |
| RT2-02 (P2) | Analysis cost 1.2–2.4× more CPU per frame than 0.4.5. | (1) The strict and low-contrast channels share the general channel's state until the first transition they would treat differently, then fork an exact copy; most pixels never fork. (2) `color()` results are cached by RGB value. (3) The extra channels use fixed-size buffers. (4) The area meter skips empty masks and unchanged envelopes. Detection is unchanged: 0 differences against 0.4.5 in 4,000 random cases with held frames, and 0 against eager 0.5.0 channels in 5,000. | `test-thresholds.mjs`, mutation set |
| RT2-03 (P3) | A burst straddling a startup size change was missed. | A 16 × 9 startup bridge samples every startup frame at fixed relative positions across size changes, for 1.5 s after geometry locks. | `test-settling.mjs` |
| RT2-04 (P3) | More than 32 transitional segments gave contradictory UI. | Windows are kept for every segment (up to 512), and the headline follows the status. | `test-settling.mjs` |
| RT2-05 (P3) | Buffer-overflow frames were labelled "transitional". | They are counted (`bufferOverflowFrames`) and described separately. The origin is the first retained frame. | `test-settling.mjs` |
| RT2-06 (P3) | Review notes called decoded files a "shared surface capture". | The notes name local-file analysis and say it does not cover the page. | `test-audit-repairs.mjs` |
| RT2-07 (P3) | Infinity-duration WebM was padded to the limit and reported as "whole file". | The real duration is found by seeking to the end. If it is still unknown, the report says so and does not claim the whole file. | `test-file-analysis-ui.mjs` |
| RT2-08 (P3) | `example.html` had no guard; mixed modules were possible. | All of the following, with refusal on every page: <ul><li>`example.html` refuses to start.</li><li>Every module registers its build, and each page checks its full import closure (`PAGE_MODULES`, stamped by the tool).</li><li>Each HTML page carries a build marker.</li><li>Stylesheets are versioned, and the version key includes the date.</li><li>Guard failures are reported, never thrown.</li></ul> | `test-module-guard.mjs`, including a real `ccb80c1` module and a stale HTML page |
| RT2-09 (P2, headless) | A hidden analyzer tab captures nothing, and the text invited that layout. | Hidden time is tracked; the report says how long the analyzer was hidden and cannot meet the minimum. The instructions say to keep the analyzer in its own visible window. | `test-settling.mjs`; native headless: the same-window layout now reports "hidden for 8.7 s" |
| RT2-10 (P3) | 120 fps sources sampled at 60 Hz landed on frame boundaries. | Sample offset 0.3 of an interval, which avoids boundaries for 24/25/30/50/60/120/240 fps at 30/60/120 Hz. Reports when nearly every sample differs, which suggests a faster source. | `test-file-source.mjs` |
| RT2-11 (P3) | CSV rows repeat the metadata prefix (about 4.6 KB per row). | **Not changed**: every row stays standalone, as required by AI-03. Documented: a probe CSV can reach roughly 138 MB at the 30,000-row cap. | — |
| RT2-12 (P3) | Moving content gives false positives and saturates the area bound. | New report limitation states both. | — |
| RT2-13 (P3) | Test gaps (41 of 127 audit mutants survived). | All non-equivalent survivors retargeted and covered (below). New `test-file-analysis-ui.mjs` exercises the file page. The native verifier now also checks SC 2.3.2, red, provenance, the SHA-256, sample counts, loop plays and that the video stays invisible. | `mutation set` |

## Per-frame cost (Node 26, Apple M5, median of 3 separate processes; machine not idle)

| Analysis, content, area | 0.4.5 | 0.5.0 | 0.5.1 |
| --- | --- | --- | --- |
| 320 × 180, 4 Hz flash, calibrated | 5.6 ms | 10.1 ms | **3.5 ms** |
| 640 × 360, static, calibrated | 14.7 | ~22 | **9.4** |
| 640 × 360, noisy video, uncalibrated | 15.7 | 17.3 | **10.8** |
| 640 × 360, 4 Hz flash, calibrated | 29–52 | 54–72 | **15** |
| 640 × 360, heavy random low-contrast noise (ΔY ≈ 0.066 per frame), calibrated | 18 | 41–48 | 29–46 |

The last row is adversarial: every pixel forks the low-contrast channel. Ordinary compression shimmer (under 0.05) does not fork it.

These are analysis costs in Node. They are not capture rates. Whether real 30–60 fps capture keeps up needs a headful run.

## Verification run here (same agent family)

Mocked APIs and generated frames, except where marked native.

- **All 16 scripts pass**: the original nine, plus `test-thresholds`, `test-settling`, `test-module-guard`, `test-file-source`, `test-motion-review`, `test-area-erased` and `test-file-analysis-ui`. `python3 test-video-fixtures.py` verifies 24 files.
- **Mutation:** 51 mutants:
  - 34 retarget every non-equivalent survivor from the audit;
  - 17 remove a 0.5.1 repair.

  **All 51 fail at least one script for the intended reason.** Equivalent audit mutants not retargeted: `S-origin-since`, `S-rt09-nan`, `S-dup-media`, and `A-strict-dark-0.95`, which is equivalent because a pair with ΔY ≥ 0.10 always has its darker state at or below 0.90.
- **Native file analysis** (headless Chrome 155, automation): `tools/verify-file-analysis.mjs`, **57/57** with the stronger checks. That includes 3 new finite-loop fixtures (`bw-loop3`, 3 plays). Mutated copies with a visible video or SHA-1 instead of SHA-256 are now caught.
- **Native capture** (headless Chrome 155, automation; tab auto-selected by title):
  - The NF-02 rejection, NF-04 calibrated video ×2, NF-06 small and large zone (area unchanged: 1,704 / 1,141 and 73,858 / 72,562), and the positive witness with screenshots on and off: all 5 exports pass the independent validator.
  - All stale-module combinations tried are refused.
  - The same-window layout reports the hidden analyzer.

## Not covered

- An independent retest of 0.5.1.
- Headful and reviewer-operated runs (HUMAN_TODO): especially confirming RT2-09 in a normal browser window, and real capture rates with the new per-frame costs.
- Windows, Edge, F11.
- The video manifest still records only the ffmpeg version.
