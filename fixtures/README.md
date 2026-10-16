# Parameter fixture suite

From `flash-tester`, run `python -m http.server 8765 --bind 127.0.0.1 --directory dist` and open [the fixture page](http://127.0.0.1:8765/fixtures.html). The main app also links to it. Live playback starts only after acknowledgment and Start; it stops after three seconds, on Stop, Escape, tab hiding, navigation or resize. These are intentionally flashing test inputs. They are never played automatically.

`node test-fixtures.mjs --write` verifies the source colors, geometry and frame timing, runs the existing analyzer on generated frames without displaying them, and regenerates `manifest.json` and `synthetic-results.json`. No dependencies or video encoding are required. The fixtures are browser-rendered content for this app's tab capture workflow, rather than MP4 files.

`node test-fixtures-ui.mjs` checks acknowledgment, viewport sizing, source rectangles, every stop path and analysis without playback using mock browser APIs. The existing `test.mjs`, `test-ui.mjs` and `test-regressions.mjs` checks also pass. Browser verification confirmed all 13 synthetic results without starting live flashing; physical presentation and tab-capture timing still need device testing.

| Input | Reference expectation | Current app expectation |
| --- | --- | --- |
| Full black/white at 5, 10, 15 Hz | Fail | General candidates |
| Red/black at 10 Hz | Fail | General candidates; black has undefined chromaticity |
| Red/blue at 10 Hz | Fail | General and experimental red candidates |
| Centered 60% width × 60% height at 4 Hz | Fail | General candidates |
| Full black/white at 2 Hz | Pass, frequency branch | No candidates; conformance inconclusive |
| Full black/white at 3 Hz | Pass, boundary | No candidates; conformance inconclusive |
| Requested #E0E0E0 / #B0B0B0 at 10 Hz | Fail: ΔY ≈ 0.253 | General candidates |
| Corrected #B0B0B0 / #B8B8B8 at 10 Hz | Pass: ΔY < 0.10 | No candidates; conformance inconclusive |
| Centered 64 × 64 white box at 10 Hz | Pass, reference area branch | General candidates; area not evaluated |
| Centered 492 × 384 white box at 10 Hz | Fail despite occupying <25% of screen | General candidates |
| Static black | Pass | No candidates; conformance inconclusive |

One Hz is one complete A → B → A cycle: **two transitions per flash**. Three seconds are sampled at 120 fps, with an endpoint at t=3 for analysis (361 samples). All frequencies have integer half-periods on that clock. Live rendering uses elapsed time and requestAnimationFrame; actual presentation and capture timing may differ. The page reports callback scheduling statistics, not measured display refresh or capture quality.

Area expectations use an unscaled 1024 × 768 reference surface at the intended viewing setup. The maximum concurrent area in a 341 × 256 visual field is compared to 21,824 pixels. This is **25% of that visual field**, not 25% of the whole screen. The small box contains 4,096 pixels, while the 24%-of-screen trap can fill an entire visual field. Live tests require a viewport of at least 1056 × 850 CSS pixels and 100% zoom. Browser controls and page margins are outside the reference canvas; full-frame cases cover the whole canvas, not browser chrome. Scaling, zoom and viewing distance change the physical area interpretation.

Synthetic frames sample the known source at pixel centers without filtering. They verify the analyzer against these inputs; they do not establish capture fidelity, physical viewing geometry or WCAG conformance. The small-zone expectation deliberately exposes the app's missing area evaluation. Do not change its input expectation to failure merely because the app flags it.

The full-field gray pair requested as a pass is preserved exactly, labeled as a failure, and accompanied by a corrected passing pair. Relative luminance uses linearized sRGB, rather than RGB byte differences. Source: [WCAG 2.2 SC 2.3.1 definitions and viewing assumptions](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html).

Version 0.4 adds optional calibrated area screening. The fixture page enables reference calibration for generated frames and reports its conservative envelope separately. The original fixture runner still exercises the uncalibrated path; `node test-area.mjs` tests the calibrated path, including the 4,096-pixel small zone. Candidate detection is deliberately retained regardless of area. See [the size/input guide](../docs/INPUTS_AND_SIZE_TESTING.md).
