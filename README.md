# Flash Review

Standalone browser screening prototype for WCAG 2.2 SC 2.3.1. No packages, accounts, or capture upload required. Source is in `dist/`.

## Run locally

AI agents: start with [AGENTS.md](AGENTS.md) and [the implementation/verification plan](docs/AGENT_PLAN.md). The 0.4.1 repairs passed independent targeted retest; the full gate remains blocked on native browser evidence. [Native verification is the next active task](docs/NATIVE_VERIFICATION.md).

From this directory run `python -m http.server 8765 --bind 127.0.0.1 --directory dist`, then open http://127.0.0.1:8765 in desktop Chrome or Edge. HTTPS is required when hosted off localhost. A normal browser tab is recommended because embedded browsers may block display capture.

1. Open the webpage under review in another tab.
2. Enter its reference and planned interactions. Select capture duration and analysis detail.
3. Click **Share a tab & start capture** and select the target tab in the native sharing picker.
4. Exercise page content. Avoid scrolling during an individual animation test where practical: moving content can create false positives. Repeat at different states, sizes and positions.
5. Return to the tool after automatic stop, review the timestamps, and download the HTML screenshot report, per-frame CSV, JSON, or plain text notes. No video recording is retained. Save a separate source recording if needed for subsequent specialist analysis.

## Luminance evidence and examples

Set the measurement point as percentages of the captured surface (50/50 is the center). Detection still checks all analysis pixels. Relative luminance is computed from the uncompressed, reduced-resolution sRGB pixels, linearizing channels before applying Y=0.2126R+0.7152G+0.0722B. Y is dimensionless, not nits or contrast ratio. Each frame records the selected point's RGB, Y, change from the prior frame, red saturation and chromaticity, plus spatial frame Y minimum/mean/maximum. Detection-witness measurements are exported separately from selected-probe measurements. The two CSV files explicitly identify their locations and source. Capture-wide probe range is not a flash amplitude; unrelated states can define its extrema.

Up to seven static images are retained: four selected-probe frames (initial, darkest, brightest, first flagged frame) and three states of the latest pair at the first detected pixel. The detection witness has its own trace and marker, independent of the selected probe. Screenshots are resized to at most 1280 pixels per dimension and JPEG encoded; numerical values are measured before screenshot compression. The yellow ring indicates the selected probe. Screenshot retention can be disabled. Images are never uploaded and are displayed only as separate static images in a collapsed section after a notice. HTML and JSON exports embed the retained images and can contain private page content; CSV and text exports do not embed images.

Seven fixtures offer synthetic analysis with no visible playback, including delayed-burst and gradual-red regressions alongside: static gray; 2 Hz black/white; 4 Hz low-amplitude gray; 4 Hz black/white; 4 Hz red/cyan. The two expected failures assume an area above the normative flash-area threshold; synthetic results do not measure viewing geometry. Synthetic reports identify generated frames rather than webpage screenshots.

Separate live fixture pages always start at a warning, require acknowledgment and an explicit Start, run at most five seconds, and stop on Escape, Stop, or tab hiding. Failing fixtures intentionally exceed flash-frequency thresholds. Brief duration and stop controls do not make them safe. Their nominal frequencies depend on browser/display timing and must be verified from capture. The warning is shown before any playback, including for pass fixtures.

## Interpretation

This is an unvalidated screening prototype, not a compliance or seizure-safety certification. It never assigns a WCAG pass/fail or VPAT support level. General-flash candidates use linear-sRGB luminance excursions, while red candidates use an experimental accumulated chromaticity-excursion model. Red evaluation remains incomplete and unvalidated. Complete non-overlapping transition pairs must fit in a rolling second at one sampled pixel. More than three pairs flags a review interval.

Spatial reduction, temporal sampling/aliasing, browser throttling, moving regions and different spatial phases can hide events. The 640 px setting improves spatial detail but can reduce capture throughput. Optional area calibration now measures sample-aligned pair completions and a conservative rolling spatial envelope within a moving reference visual field. Complete temporal overlap, physical viewing geometry, fine-pattern exceptions and full red evaluation remain unvalidated. Percentages and bounding boxes are screening locations only. A URL field labels the report; it does not navigate, crawl or prove page identity.

Confirm findings using an established flash-analysis tool and review all page states before reporting conformance. Test coverage and actual browser capture must be validated on the target device. Incompatible capture APIs and canceled sharing are handled without producing a pass result.

## Checks

The [parameter fixture suite](fixtures/README.md) adds 13 inputs covering 5–15 Hz full-frame flashes, saturated red, a large region, 2/3 Hz frequency boundaries, requested and corrected gray pairs, and small-area cases. Open `http://127.0.0.1:8765/fixtures.html` after starting the server above. Run `node test-fixtures.mjs --write` to verify the generated inputs and refresh the manifest and synthetic results. This suite keeps reference input expectations separate from the app's screening output, including optional calibrated area screening and its remaining limitations.

`node test.mjs` verifies synthetic in-memory static frames, transitions, three/four flash boundaries, contrast, luminance, smooth ramps, red candidates, slow pairs, timestamps, independent spatial regions, all five fixtures, evidence measurements, screenshot retention and report escaping. `node test-ui.mjs` verifies the capture-to-evidence flow and live-example warning gates with mock browser APIs. These tests display no flashing content and do not replace real browser capture, visual QA, or device timing validation.

Sources: [SC 2.3.1 understanding](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [threshold definitions](https://www.w3.org/TR/WCAG22/#dfn-general-flash-and-red-flash-thresholds).

## Version 0.3 remediation

See `FIX_VERIFICATION.txt` for the six audit findings and their remedies, and `RED_TEAM_PROMPT.txt` for a fresh independent audit. Run `node test-regressions.mjs` for the remediation checks. The original audit artifacts remain local and are excluded from source publication. Reports distinguish inadequate observation from no candidates, and every no-candidate result remains conformance inconclusive. All exports use a common report ID and explicit generated-frame or shared-surface provenance.

## Version 0.4: area screening and image inputs

See [the coverage roadmap](TODO.md) and [input/size testing guide](docs/INPUTS_AND_SIZE_TESTING.md). `dist/image-sequences.html` accepts multiple local static images or newline-separated image URLs, with finite ordered-pair screening and reproducible shuffled schedules. `generate-image-fixtures.py` regenerates eight deterministic PNG inputs. `test-area.mjs`, `test-image-sequence.mjs` and `test-image-ui.mjs` cover the new measurements, scheduling and input controls. The capture form records default/maximized/browser-fullscreen/content-fullscreen/responsive scenarios. Run a separate capture after each presentation-size change.

### Version 0.4.1 audit repairs

Both nonoverlapping transition-pairing phases are evaluated independently so an old unmatched transition cannot hide a later four-flash burst. Phase counts are never summed. Image-page navigation now clears released bitmap state and invalidates pending asynchronous work; restored pages require loading again. Standalone exports retain common scenario, calibration, identity and coverage metadata. Empty CSVs contain an explicit metadata record, with blank measurement fields. CSV readers must inspect `record_type` and use an RFC-compatible parser because JSON context fields contain quotes and commas. `node test-audit-repairs.mjs` retains AI-01/AI-03 counterexamples, and `node test-image-ui.mjs` includes AI-02 restoration and late-load regressions. The repair archive remains local at repair-verification-2026-10-16/README.md (excluded from Git). The three repairs passed independent targeted retest; the overall gate remains blocked on native coverage. See [the published verification status](docs/VERIFICATION_STATUS.md).
