# Agent to-do list

Work an agent can do unattended: code repairs, tests, documentation and automated (headless) verification. Tasks that need a person are in [HUMAN_TODO.md](HUMAN_TODO.md).

Updated October 17, 2026. Sections 1–4 are done in build 0.5.0 ([RELEASE_0.5.0.md](RELEASE_0.5.0.md)); the remaining items are open. First written after the red-team retest of build `flash-review-0.4.5-20261017`. The retest report is kept locally in `redteam-0.4.5-2026-10-17/REPORT.md` and is not published. RT numbers refer to that report.

## Rules

- Run all nine scripts after any code change, and `python3 test-video-fixtures.py` after any fixture change.
- For every repair, add a regression that fails when the repair is removed. Confirm it fails by reverting the repair once.
- Flashing content runs headless only, unless the person has agreed to watch it.
- Never edit original evidence. Write new evidence in a new folder that stays out of Git.
- Make no WCAG conformance claim.

## 1. P2 repairs (done in 0.5.0)

- [x] **RT-01: show discarded startup frames.**
  - Show the discarded interval in the capture UI.
  - Add an observation reason, so the screening minimum is not met when any frames were discarded.
  - Regression: a burst that falls only inside the settling window must not produce "No candidates" with the minimum met.
- [x] **RT-05: guard every module.**
  - Version every module the pages import: `app`, `evidence`, `export-metadata`, `examples`, `fixtures`, `image-sequence`, `report`, and the page scripts.
  - Check them all against `report.mjs`.
  - Regression: load each module from an older commit and assert that the page refuses to run.
- [x] **RT-02: area bound.** Use the person's decision (HUMAN_TODO, section 1).
  - Either change the summary wording and the documented exception,
  - or add a check for regions that vanish in the downscale.
  - Keep `area-limit-cross.mjs` from the red-team folder as a regression.

## 2. P3 repairs (done in 0.5.0)

- [x] **RT-03: NF-07 wording.** Choose the reason from the number of size changes and frames, not the number of sizes. Drop "(static content produces few frames)" when many frames arrived.
- [x] **RT-06: stale `report.mjs`.** Load `report.mjs` so that a stale or missing copy still shows "Reload required", instead of leaving a dead page.
- [x] **RT-08: HTML formula.** Change `^2` to `^2.4` in the HTML "What is measured?" text.
- [x] **RT-09: zero-size frames.** Reject 0 × 0 frames before the aspect check.
- [x] **RT-10: fixtures page.** Add the module guard to `fixtures.html`.
- [x] **RT-04: settling and static pages.** Implement the person's decision (HUMAN_TODO, section 1).

## 3. Missing tests (done in 0.5.0)

All nine scripts still pass with each of these removed. Add a regression for each:

- [x] `observedSourcePixels` must come from the video element, not the track settings (use different mock sizes).
- [x] The 2% aspect guard (a 3% mismatch must be rejected).
- [x] The time origin is the first analyzed frame.
- [x] Both CSVs contain `startup_settling_json`.
- [x] Lit-cell values appear in the area summary.
- [x] The NF-08 guard fires on the capture page and on the image-sequence page.
- [ ] Optional: the field-window `+1` (looks unnecessary; kept as harmless slack).

## 4. Documentation corrections (done in 0.5.0)

- [x] `docs/MAC_NATIVE_RESULTS.md`:
  - [x] Remove "not yet repaired" from the NF-06 section.
  - [x] Change "Windows rerun on 0.4.4" to 0.4.5.
  - [x] Say NF-07 has no native check.
  - [x] Say 6 of the 21 runs that met the sampling minimum were headful.
  - [x] Say only 4 of the 12 WebM files were captured.
  - [x] Reword "the player presented frames without a stall" to refer to frame callbacks.
  - [x] Give the observed RGB error and the tolerance instead of "±1".
- [x] `docs/AGENT_PLAN.md`: remove the duplicate "algorithm flash-screen-0.4.1".
- [x] `README.md`: align the NF-02/NF-03 retest status with the other docs.
- [x] `docs/NF06_NF08_REPAIR.md`:
  - [x] Update the NF-06 exception.
  - [x] List the module combinations NF-08 does not catch, until RT-05 is fixed.
  - [x] Say the native NF-08 check covered only `analyzer.mjs`.
- [x] `TODO.md` and `docs/NATIVE_FINDINGS.md`: qualify "NF-04 5/5 natively" as 0.4.4, a static target, one analyzed frame each.
- [x] `docs/NF02_NF03_REPAIR.md`: note that the settling cost is not shown in the UI, and that non-repainting pages may never settle.
- [x] `fixtures/video/README.md` and the manifest: record the libx264 and libvpx versions alongside ffmpeg.

## 5. Automated verification after the repairs

- [ ] Rerun the red-team mutation set and confirm that every repair is now protected.
- [ ] Rerun the independent area oracle and the limit-crossing case.
- [ ] Rerun the headless Chrome set:
  - NF-02 / NF-03 / NF-04 with the moving-bar video
  - NF-06 small and large zones
  - the positive witness, with screenshots on and off
  - every stale-module combination
- [ ] Validate all downloads with the independent export validator.
- [ ] Sample Chrome's decode of the second (B) state of each video fixture. The seek did not advance the frame last time; play the video instead of seeking.
- [ ] Validate the downloads and notes the person returns from HUMAN_TODO, then update the docs to match what the evidence shows.

## 6. New work from 0.5.0

- [ ] CORS video URLs on the file-analysis page.
- [ ] Validate the SC 2.3.2 strict channel against a specialist analyzer, and settle the 0.10 change floor.
- [ ] Sequence file analysis with page-level capture: one report linking a file result to the capture of the page that shows it.
- [ ] Independent temporal-overlap reference for area (TODO section 1).

## 7. Gate

- [ ] The gate stays BLOCKED until the P2 repairs, the Windows rerun and the person-operated runs are done.
