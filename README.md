# Flash Review

Standalone browser screening prototype for WCAG 2.2 SC 2.3.1. No packages, accounts, or capture upload required. Source is in `dist/`.

## Run locally

From this directory run `python -m http.server 8765 --bind 127.0.0.1 --directory dist`, then open http://127.0.0.1:8765 in desktop Chrome or Edge. HTTPS is required when hosted off localhost. A normal browser tab is recommended because embedded browsers may block display capture.

1. Open the webpage under review in another tab.
2. Enter its reference and planned interactions. Select capture duration and analysis detail.
3. Click **Share a tab & start capture** and select the target tab in the native sharing picker.
4. Exercise page content. Avoid scrolling during an individual animation test where practical: moving content can create false positives. Repeat at different states, sizes and positions.
5. Return to the tool after automatic stop, review the timestamps, and download JSON or plain text notes. No video recording is retained. Save a separate source recording if needed for subsequent specialist analysis.

## Interpretation

This is an unvalidated screening prototype, not a compliance or seizure-safety certification. It never assigns a WCAG pass/fail or VPAT support level. General-flash candidates use linear-sRGB luminance excursions, while red candidates use a more limited adjacent-frame chromaticity heuristic. Complete non-overlapping transition pairs must fit in a rolling second at one sampled pixel. More than three pairs flags a review interval.

Spatial reduction, temporal sampling/aliasing, browser throttling, moving regions and different spatial phases can hide events. The 640 px setting improves spatial detail but can reduce capture throughput. The tool does not measure concurrent flash area against the 0.006 steradian threshold within a 10-degree visual field, implement the fine-pattern exception, or fully analyze gradual red transitions and black chromaticity. Percentages and bounding boxes are screening locations only. A URL field labels the report; it does not navigate, crawl or prove page identity.

Confirm findings using an established flash-analysis tool and review all page states before reporting conformance. Test coverage and actual browser capture must be validated on the target device. Incompatible capture APIs and canceled sharing are handled without producing a pass result.

## Checks

`node test.mjs` verifies synthetic in-memory static frames, transitions, three/four flash boundaries, contrast, luminance, smooth ramps, red candidates, slow pairs, timestamps and independent spatial regions. No flashing test content is displayed.

Sources: [SC 2.3.1 understanding](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html), [threshold definitions](https://www.w3.org/TR/WCAG22/#dfn-general-flash-and-red-flash-thresholds).
