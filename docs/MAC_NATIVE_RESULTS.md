# macOS native verification set

October 16–17, 2026. A new Mac evidence set, started from the beginning at the user's request. It is separate from the earlier Windows Chrome rows in [NATIVE_RESULTS.md](NATIVE_RESULTS.md) and [PRESENTATION_MATRIX.md](PRESENTATION_MATRIX.md); results here do not continue or replace those rows.

## Environment and method

- macOS 26.6.2 (25G83), arm64, built-in Liquid Retina display 2560 × 1664 (screen 1470 × 956 CSS, DPR 2). Google Chrome 155.0.8059.85, fresh profile, 100% zoom.
- Builds: `flash-review-0.4.3-20261016` (M1–M3), then `flash-review-0.4.4-20261016` (everything else). Algorithm `flash-screen-0.4.1`. Source baseline `267108f` plus the uncommitted 0.4.3/0.4.4 changes. Hashes are recorded with the evidence.
- **Operator: automation, not a reviewer.** A local harness drove real Chrome over the DevTools protocol. The shared tab was chosen by Chrome's `--auto-select-tab-capture-source-by-title` flag, not the native picker. Window states were set with `Browser.setWindowBounds` (`maximized`, `fullscreen`), and content fullscreen used a real CDP click on the page button. No physical keystrokes (e.g. Ctrl+Cmd+F) were used. Reviewer-operated Mac runs remain untested.
- The same agent implemented the 0.4.3/0.4.4 fixes and ran these checks. This is **not** an independent red-team retest.
- Every capture saved all five original downloads (JSON, HTML, text and both CSVs), hashed at download. They were then checked by independent Python validators that import no application code. Evidence is local in `native-verification-mac-2026-10-16/` (excluded from Git). `summary.json` lists every run.

## Results

### NF-02 / NF-03 (build 0.4.3)

M1 calibrated with the pre-share viewport 1200 × 702 while the shared surface was 1200 × 646. Results:

- Rejected as `calibration-rejected`, with the supplied input and stop reason retained.
- Rejected source 2940 × 1582 recorded; its aspect ratio independently mismatches by more than 2%.
- All five files produced. Both CSVs hold exactly one metadata record with blank measurements and `evidence_coverage_json` status `not-collected`.
- No UI, HTML or text output says "not supplied".

**PASS on macOS Chrome within these automated conditions.** A Windows retest and a reviewer-operated retest are still pending.

### NF-04 (new, P2): first-frame geometry lock races the sharing infobar

Chrome animates the "sharing this tab" infobar over about 150–300 ms, changing the target viewport (e.g. 702 → 646 on share, then back on stop). Before 0.4.4, the analyzer locked geometry on the very first frame. Results on 0.4.3:

- 4 of 5 calibrated default captures with the correct during-share geometry were rejected (M3, M3 retry b–d). Their first frames were transitional heights between the pre-share and settled sizes.
- The successful retry (a) and the diagnostic run landed on settled frames by chance.
- The earlier Windows maximized "dimensions changed" stop (502 → 501 → 445) shows the same pattern.

All exports were correct; the defect is that calibrated capture could not reliably start. Repair and native results are below.

### Presentation matrix, static RGB176 target (build 0.4.4)

Each scenario ran a diagnostic capture (calibration off), then a calibrated capture using the CSS viewport the target reported during sharing.

| Scenario | Window (CSS) | Viewport before share | Viewport during share | Sampled source px | Calibrated result |
| --- | --- | --- | --- | --- | --- |
| default ×5 (M4) | 1200 × 789 normal | 1200 × 702 | 1200 × 646 | 2940 × 1582 | 5/5 `calibrated-screening` (was 1/5 on 0.4.3) |
| maximized (M5) | 1470 × 833 | 1470 × 746 | 1470 × 690 | 2940 × 1380 | `calibrated-screening` |
| browser fullscreen (M6), macOS fullscreen space | 1470 × 835, toolbar shown | 1470 × 835 | 1470 × 779 | 2940 × 1558 | `calibrated-screening` |
| content fullscreen (M7), page API | 1470 × 923 | 1470 × 923 | **1333 × 867** | 2666 × 1734 | `calibrated-screening` |
| smaller layout (M8), compact ≤ 600 px | 560 × 789 | 560 × 702 | 560 × 646 | 1656 × 1912 | `calibrated-screening` |

Observations:

- Sharing shrinks the viewport by 56 CSS px (the infobar) in every windowed mode, including macOS fullscreen. Chrome keeps its toolbar visible in macOS fullscreen, so "browser fullscreen" on Mac is not equivalent to Windows F11.
- With content fullscreen active, sharing shrank **both** dimensions (1470 × 923 → 1333 × 867, animated). The analyzer's retained captured frame shows the readout 1333 × 867 with fullscreen ACTIVE, matching the calibration.
- In the small layout, the captured frame's own readout reports **DPR 3**, while the window renders at DPR 2. Chrome changes the render scale of captured tabs. Never derive CSS calibration from encoded pixels or DPR.
- Discarded startup frames (1–7 per run) are recorded in `startupSettling` and the limitations.
- The static target emits only about 1–3 frames per 10 s. Every static run is correctly **insufficient-observation**. These runs verify geometry, calibration, scenario and export plumbing only.

Additional static cases:

- M9 (screenshots off): no embedded images in JSON or HTML.
- M10 (window resized 1200 → 1000 CSS mid-capture): stopped with `Shared surface dimensions changed`.

### Image-sequence playback (build 0.4.4, two byte-identical gray PNGs, 20 changes/s, seed 12345, 320 × 240)

Every case passed independent log validation: callback times start at zero, are nonnegative, nondecreasing and within the cap, and every logged image matches the planned schedule. Controls reset afterwards (stage hidden, acknowledgment cleared, Play disabled).

| Case | Ended because | Callbacks |
| --- | --- | --- |
| S1 duration cap | three-second limit | 182 |
| S2 Stop button | Stop | 46 |
| S3 Escape | Escape | 46 |
| S4 **direct same-window tab switch** (new tab opened in the same window) | tab hidden | 45 |
| S5 window resize | viewport resized | 47 |
| S6 repeated Start | three-second limit; Play disabled while running | 181 |
| S7 navigate away, then Back | images released; reload required; download disabled | — |

S4 closes the previously missing direct tab-switch case for macOS/0.4.4, under CDP activation. Callback logs remain callback observations, not presented-frame proof.

### Positive witness and animated controls (headless Chrome)

These ran in a separate `--headless=new` Chrome 155 instance, so flashing fixtures were never displayed on a physical screen. Each used `example.html` with acknowledgment and Start, and an 800 × 410 source.

| Run | Fixture | Status | Peak general / red | fps |
| --- | --- | --- | --- | --- |
| W1 | 4 Hz black/white | candidates-detected | 4 / 0 | 7.0 |
| W2 | 4 Hz, screenshots off | candidates-detected | 4 / 0 | 10.3 |
| W3 | 2 Hz black/white | insufficient-observation, not flagged | 2 / 0 | 6.1 |
| W4 | delayed four-flash burst | candidates-detected | 4 / 0 | 8.0 |
| W5 | 4 Hz red/cyan | candidates-detected | 4 / 4 | 10.6 |

W1 independent witness checks:

- 4 pair starts within 1 s, 0.25 s apart.
- Witness CSV rows equal the JSON trace; Y recomputed.
- The latest pair consists of opposing excursions ≥ 0.10.
- All three witness PNGs, decoded with a stdlib-only decoder, match the numeric RGB exactly at the witness pixel.
- The center probe saw 0 and 255.

W2: the witness was retained with no images anywhere in its exports.

The witness pixel was at the field edge, where downscaling mixes in margin (dark state RGB 134), while the center probe read a clean 0/255.

**Limits:** headless capture sampled at 6–10 fps, below the 30 fps screening minimum, near the Nyquist limit for 4 Hz. These runs exercise the positive-witness evidence path. They do not validate display or capture timing, headful frame rates or detection sensitivity.

## Still open on macOS

- Reviewer-operated runs: native picker, physical Ctrl+Cmd+F / green-button fullscreen, the macOS menu bar/notch area.
- Headful animated captures at real frame rates. These need consent, since the fixtures flash on screen.
- Real video and player fullscreen (no video fixture exists yet).
- Zoom other than 100%, external monitors and other DPRs.
- An independent retest of NF-02/03/04 by a different reviewer.
- The Windows rerun on 0.4.4.

No WCAG conformance result is made.
