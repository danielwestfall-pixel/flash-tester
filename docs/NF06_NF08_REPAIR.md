# NF-06, NF-07 and NF-08 repairs

October 17, 2026. Build `flash-review-0.4.5-20261017`; algorithm `flash-screen-0.4.2`. The area measurement changed, so the algorithm version changed too. General/red flash detection is unchanged. Found during the automated macOS set ([MAC_NATIVE_RESULTS.md](MAC_NATIVE_RESULTS.md)); repaired at the user's request. These checks were run by the same agent that wrote the fixes, so they are not an independent retest.

## NF-06 (P2): calibrated area "upper bound" could undercount

**Defect.** The area meter counted only flagged analysis cells. At reduced resolution, a partially covered edge cell can fall below the flash threshold, through blending or because it was point-sampled (Chrome's canvas downscale behaved like point sampling natively). A region can therefore extend up to about one cell beyond its lit cells. The value labelled `cssPixelsUpperBound` measured 1,140.8 CSS px² for a fully visible 1,267 px² region, and a 148 × 148 region (21,904 px², above the 21,824 limit) measured 21,422.

**Change** (`dist/area.mjs`):

- `cssPixelsUpperBound` counts the flagged mask dilated by one cell (8-neighbourhood), within the moving reference-field window.
- A new field, `cssPixelsLit`, keeps the previous lit-cell value, with `litAboveReferenceLimit` and `upperBoundCells` alongside.
- The summary shows both values. The area limitation text now says lit cells can undercount, and that regions thinner than one cell, or flashes erased by downsampling, are not bounded.

**Cost.** Upper bounds are deliberately conservative: up to about 35% high for a 9.5-cell region, and about 8% at the 21,824 limit at 3.75 CSS px cells. On a native 1-CSS-pixel grid the bound adds a one-pixel ring. An upper bound above the limit is still not a failure verdict, as before.

**Regression** (`test-area.mjs`):

- Hand-computed lit and dilated values for the boundary, edge, nearby, separated and staggered cases.
- The NF-06 counterexample: lit < 21,824 while upper ≥ 21,904.
- A sweep of 160 sub-cell offsets × sizes under box and point sampling, in which the upper bound is never below the true area.

The previous code fails the counterexample.

**Native retest** (macOS, headless Chrome 155, real video capture, 58–60 fps):

| Fixture | Visible area in field | Lit | Upper bound |
| --- | --- | --- | --- |
| small zone (35.6 × 35.6 CSS px) | 1,267 | 1,140.8 (the original undercount) | 1,704.2 ≥ true |
| large zone | 71,882 | 72,562 | 73,858 |
| full field | 87,296 | 87,296 | 87,296 |

The simulation matches the native small-zone values exactly.

## NF-07 (P3): misleading reason when only one frame arrives

A static page can deliver a single frame and then none. 0.4.4 reported that the size "did not stay unchanged", although no change was observed. The reasons now distinguish:

- **Kept changing:** "Shared surface size kept changing and did not stay unchanged for 0.5 s…"
- **Unconfirmed:** "Only one frame size was observed, and no later frame arrived at least 0.5 s after it…"

A mocked regression covers both. A native static-target case was not rerun.

## NF-08 (P2): stale cached modules could mix builds silently

**Defect.** After an update, Chrome reused cached `analyzer.mjs`/`area.mjs` while loading a new `report.mjs`. The report claimed build 0.4.5 but measured with algorithm 0.4.1. Only the algorithm field revealed it; `area.mjs` had no version and nothing warned the reviewer. Three native runs were affected; they are retained as `R045-INVALID-mixed-cache-*` and excluded.

**Change.**

- `analyzer.mjs` exports `ALGORITHM`, `area.mjs` exports `AREA_ALGORITHM`, and `report.mjs` declares `EXPECTED_ALGORITHM`.
- `moduleVersionProblem()` uses namespace imports, so a stale module cannot break module linking.
- The capture page shows the problem and refuses to start; the image-sequence page refuses to load.

**Regression.** `test-regressions.mjs` asserts that the three constants agree.

**Native check.** Real Chrome with `analyzer.mjs` served as the 0.4.4 file through CDP interception, which reproduces a stale cache:

- the support line and Start show "Reload required… analyzer unversioned"
- with current files, the page starts normally

The guard covers the two measurement modules only; other modules remain unversioned.

## Checks

All nine scripts pass, and `python3 test-video-fixtures.py` verifies 24 files. The test harness now hard-reloads the analyzer page and validates the algorithm field.
