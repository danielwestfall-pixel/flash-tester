# Flash Review 0.5.0

October 17, 2026. Build `flash-review-0.5.0-20261017`, algorithm `flash-screen-0.5.0`. Branch `claude/nf02-nf04-mac-native`.

This release does two things:
- repairs the defects found by the 0.4.5 red-team retest (RT-01 to RT-10);
- closes the largest coverage gaps for the three WCAG flashing and motion criteria.

It was implemented and checked by the same agent that ran the red-team pass. No result here is a WCAG conformance verdict.

**Corrections after the independent 0.5.0 audit** (repaired in [0.5.1](RELEASE_0.5.1.md)):
- "Every stale-module combination is refused natively" was false: `example.html` ran with 17 stale or mixed combinations, and an unversioned image-sequence page module failed silently (RT2-08).
- "The remaining documented exception: regions that blend below 0.05 in every cell" was false: flashes on a bright background blend above the 0.80 darker-state limit and were missed by both the general and low-contrast channels (RT2-01).
- "General and red detection are unchanged in behaviour" held for detection (0 differences in 15,000 cases), but analysis cost 1.2–2.4× more CPU per frame (RT2-02).
- "54/54" was a headless Chrome run under automation, and the verifier then checked only peakGeneral, the flag and the alternate peak (it passed 7 of 8 page mutants).

## Coverage by criterion

| Criterion | What Flash Review now does | Still missing |
| --- | --- | --- |
| SC 2.3.1 Three Flashes or Below Threshold (A) | Screens three kinds of input: tab capture, local video files, and animated GIF/APNG/WebP/AVIF (new). General flashes, experimental red flashes, and calibrated area with a conservative upper bound. | Validated red model, temporal-overlap area, fine-pattern exception, physical viewing geometry |
| SC 2.3.2 Three Flashes (AAA) | **New strict channel**: more than three opposing excursion pairs (each ≥ 0.10), or red pairs, in a rolling second at one sampled pixel. No 0.80 brightness exemption and no area exception. Reported separately in the UI and all exports. | WCAG defines no separate minimum change for SC 2.3.2; the 0.10 floor is an interpretation. Small flashes can fall between sampled pixels. |
| SC 2.3.3 Animation from Interactions (AAA) | **New manual review checklist** (`motion-review.html`) with completeness checks and JSON/CSV/text export | Automated detection of interaction-triggered motion or of a disable mechanism (not possible from pixels) |

## Repairs

| ID | Repair | Regression |
| --- | --- | --- |
| RT-01 (P2) | Startup frames at the final size are buffered and analyzed once the size is confirmed, instead of being discarded. Frames at sizes that later change are screened separately for frequency (no area), and any candidates there are reported as `startupTransitional` windows. The startup interval is now shown in the capture UI and in every export. | `test-settling.mjs` (burst in the first 0.55 s detected; transitional-size burst flagged) |
| RT-02 (P2) | A low-contrast channel (pairs ≥ 0.05, more than three per second) adds cells to the area upper bound, which catches regions that half-cover analysis cells and blend below 0.10. The summary no longer says the limit "is not exceeded"; it says only that the bound is below the limit for sampled flashes. | `test-area-erased.mjs` (red-team counterexample: true 33,300; the upper bound now covers it) |
| RT-03 (P3) | Settling reasons are based on the number of size changes: "only one size (n frames)", "changed once, not confirmed", "kept changing (n changes)". | `test-settling.mjs` |
| RT-04 (P3) | Static pages that show one size but never deliver a confirming frame are analyzed as **unconfirmed** geometry (not counted as meeting the minimum). Calibration can therefore be applied, or rejected, for static pages. | `test-settling.mjs` |
| RT-05 (P2) | Every module exports `MODULE_BUILD`, and `moduleVersionProblem()` checks them all, including the entry pages' own modules. Every relative import and page script carries `?v=<version>`, so a browser cannot combine cached files from different builds. Use `node tools/stamp-version.mjs X.Y.Z YYYYMMDD` to stamp a release. | `test-module-guard.mjs` (stale copies of 9 modules refused on all 5 pages) |
| RT-06 (P3) | Pages import `report.mjs` through a namespace, and each page has a load watchdog. If any module fails to link, or an old entry module never signals readiness, the page shows "Reload required" and disables its buttons. | `test-module-guard.mjs` |
| RT-07 (P3) | Regressions were added for the time origin, the 2% aspect guard (3% is rejected, 1.5% accepted), `startup_settling_json`, video-element source pixels, every NF-08 guard and threshold boundaries. | Mutation set below |
| RT-08 (P3) | The HTML report and the main page now state the sRGB exponent as 2.4. | `mutation-050` `RT08-formula-2` |
| RT-09 (P3) | Zero-size frames never lock geometry, and the aspect test rejects NaN. | `test-settling.mjs` |
| RT-10 (P3) | `fixtures.html` refuses to analyze when modules are mixed. | `test-module-guard.mjs` |

## New: local file analysis (`file-analysis.html`)

`file-analysis.html` decodes a local file frame by frame. Nothing is played or shown: video goes through an attached, transparent 1 px element, and frames are drawn to an undisplayed canvas.

- **Video:** seeks on a regular grid at 30, 60 or 120 Hz, offset by half an interval, so each frame of a matching-rate source is sampled once.
- **Animated images** (WebCodecs `ImageDecoder`):
  - Every composited frame is analyzed on its timeline, including loop seams, with the loop count respected.
  - **Display timing model:** frames that specify 10 ms or less are shown for 100 ms, as browsers do. `ImageDecoder` reports the encoded value. The other timing model is also run and reported when the two would differ.
  - Transparency is composited over a reviewer-chosen page background.
- **Results:** SC 2.3.1, SC 2.3.2, optional calibrated area (displayed CSS size, 2% aspect guard), and the same five exports. The source file's name, size, type and SHA-256 are recorded.
- **Fixtures:** `fixtures/animated/` adds 28 deterministic GIF/APNG/WebP files from `generate-animated-fixtures.py`. GIF and APNG are written directly with exact delays, and every file's timing is read back with ffprobe. The set covers 2/3/4 Hz, the loop seam (looping vs played once), 10 ms frames, low contrast, red/cyan, a small zone, and transparency over white vs black.

**Native verification:** `node tools/verify-file-analysis.mjs http://127.0.0.1:8791 OUT` gives **54/54 cases match their definitions** in headless Chrome 155.0.8059.85 on macOS 26.6.2:
- all 24 video fixtures (frame-accurate, including the drop and dup variants, 10 Hz and red/cyan);
- all 30 animated-image cases, including:
  - loop seam vs played once (4 vs 0);
  - 10 ms frames: 5 flashes/s displayed, 50 as encoded;
  - transparency: 4 over white, 0 over black.

Limitations of file analysis:
- It covers only the file, not the page that shows it (player, captions, overlays, playback rate, layout).
- Sampling below the source frame rate can skip frames.
- Colour comes from browser decoding to sRGB; HDR and wide gamut are not validated.

## Detector changes (algorithm 0.5.0)

- General and red detection are unchanged in behaviour. The pairing logic was factored into an `Excursion` class shared by three channels: general, strict SC 2.3.2, and low-contrast for area.
- New report fields:
  - `sc232` and `evaluation.sc232`;
  - area `lowContrastCells`;
  - the startup-settling fields `analyzedStartupFrames`, `transitionalScreening`, `transitionalCandidates`, `geometryConfirmed`, `sizeChanges` and `invalidSizeFrames`;
  - `sourceFile`, for decoded files.
- New CSV and export columns: `sc232_status`, `sc232_peak_pairs`, `sc232_json`, `source_file_json`.
- Semantics that changed:
  - `cssPixelsUpperBound` now also counts frequency-qualified low-contrast cells.
  - `startupSettling.discardedFrames` counts only frames at transitional or invalid sizes.

## Verification run here (same agent)

Generated frames and mocked APIs, except where marked native.

- **All scripts pass:** the original nine, plus `test-thresholds`, `test-settling`, `test-module-guard`, `test-file-source`, `test-motion-review` and `test-area-erased`; `python3 test-video-fixtures.py` verifies 24 files.
- **Threshold boundaries** (`test-thresholds.mjs`): ΔY 0.0999 / 0.1022, darker Y 0.7991 / 0.8070, three vs four flashes, the rolling-window edge, gradual ramps, red saturation 0.798 / 0.818, u′v′ 0.2, and SC 2.3.2 with no 0.80 exemption or area exception.
- **Independent area oracle** (red-team `area-oracle.mjs`, 2,887 cases):
  - no bound above 87,296;
  - no case above the limit that the bound misses;
  - no undercount when a region is at least partly lit.
  - With sustained 5 Hz flashing, thin-region undercounts fall from 40 to 4 cases. Those 4 are 1.1-cell strips at 640 px, split almost evenly across two cells. The rest are sub-cell 12 px squares.
  - Remaining documented exception: regions that blend below 0.05 in every cell.
- **Native file analysis:** 54/54, as above.
- **Mutation testing:** 29 mutants, each removing one 0.5.0 repair or nudging a threshold (ΔY 0.11, darker 0.81, red saturation 0.79, u′v′ 0.19, timing clamp, loop count, seek offset, guards, watchdog, low-contrast cells). **All 29 fail at least one script, for the intended reason.** Three needed new assertions, which were added: the HTML formula, the SC 2.3.2 red count, and a mock gap in the guard test.
- **Native capture reruns** (headless Chrome 155, automation; tab auto-selected by title; not reviewer-operated):
  - The NF-02 rejection, NF-03 metadata-only CSVs, NF-04 calibrated video ×3, NF-06 small and large zone, and the positive witness with screenshots on and off: all 5 exports pass the independent validator. That includes the checks that failed on 0.4.5: the startup interval in the UI and the formula text.
  - Startup frames analyzed rather than discarded: 26–32 per run; only 2–6 transitional frames were discarded.
  - Area values are unchanged: small zone upper 1,704 / lit 1,141; large zone 73,858 / 72,562.
  - **Every stale-module combination is refused natively** (`analyzer`, `area`, `report`, `app` from two older builds, `evidence`, `export-metadata`), by the version guard or by the load watchdog.
- **Headful static target** (gray, no flashing): the NF-02 rejection is now reachable for a static page. A static page whose size changes during sharing and that then stops repainting still produces no area result (reported, not hidden). See HUMAN_TODO for the open decision.
- Evidence is in the local red-team folder, which is excluded from Git.

## Still open

- Independent retest of 0.5.0.
- The Windows rerun.
- Reviewer-operated native runs. See [HUMAN_TODO.md](HUMAN_TODO.md).
- Temporal-overlap area, fine patterns, a validated red model, and cross-checking against a validated specialist analyzer.
