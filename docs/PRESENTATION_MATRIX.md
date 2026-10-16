# Presentation matrix progress

October 16, 2026. Production build `flash-review-0.4.2-20261016`, algorithm `flash-screen-0.4.1`, source baseline `617251cadb3791d5029541d5c1c52c0f8edd4518`. Production code was unchanged. **Paused at the user's request. Native coverage: BLOCKED. Reporting/export scope: FAIL on unresolved NF-02/NF-03.**

The new [static target](../fixtures/presentation-matrix/README.md) records DOM geometry and reviewer scenario labels. The reviewer operates its separate native Chrome window; browser automation operates only the analyzer. This stage checks capture/calibration/export plumbing. It does not establish animation/video coverage, positive detection witnesses, physical viewing geometry or frame presentation timing.

## Restored window: original capture exports checked

The reviewer reported a restored Chrome window at 100% zoom. The source identified Windows Chrome 155.0.0.0 and DPR approximately 1.52. The pre-sharing geometry JSON reported viewport 1202 × 481 CSS pixels and fractional fixed-surface bounds 1202.63 × 481.58. The original screenshots from both captures directly showed the same viewport readout; calibration used the integer DOM viewport, not encoded dimensions divided by DPR.

| Run | Original report ID | Frames / sampled span | Calibration | Result |
| --- | --- | --- | --- | --- |
| Diagnostic | `d7285b89-5d43-4631-b1fd-0f4dbbdfc925` | 12 / 4.048677 s | Off | Insufficient observation |
| Calibrated | `31cf73bd-2cdd-4a0e-b179-9c2c0f33ee1a` | 4 / 1.699380 s | 1202 × 481 CSS px | Insufficient observation |

Both requested ten wall-clock seconds and ended at the time limit. Sampled spans are media timestamps, not requested duration or verified physical display coverage. Observed rates were approximately 2.72 and 1.77 fps; largest gaps were 2.592399 and 1.012614 seconds. Neither run supports a negative flash finding.

Original JSON, HTML, text and both CSV downloads were retained and hashed. Independent Python CSV/JSON parsing checked shared report/build/source/scenario identity, calibration, reference field/limit, coverage, timestamps and numeric rows. HTML/text context matched. Empty witness CSVs contained one metadata row with blank witness measurements. All six retained probe-image roles decoded to RGB 176 at the selected point, matching uncompressed numeric RGB and independently calculated linear-sRGB luminance 0.43415363617474895.

The calibrated report measured a largest same-sample completion upper bound and rolling envelope upper bound of 56.4611328125 CSS px². Four analysis cells at 320 × 128 correspond to that reported bound under the supplied calibration. This checks exported arithmetic; it does not independently establish which native pixels changed or simultaneous flashing. The global peak was one general pair, while the selected gray probe remained constant. The target has no animation/video, but its geometry readout and browser controls can change; the whole capture is not claimed to be pixel-invariant. No interval was flagged and no positive witness was retained. The small bound did not suppress the inconclusive sampling status.

Sampled source dimensions were 1828 × 732 pixels. Initial track settings differed (diagnostic 1922 × 1081, calibrated 1828 × 816); these fields remain distinct in exports. The source's later geometry download recorded resize events to 1202 × 481 during sharing and back to 1202 × 537 when sharing ended. A post-sharing snapshot must not replace the geometry observed in the captured image.

Local evidence and validators: `native-verification-2026-10-16/presentation-matrix/` (excluded from Git). The source session was loaded before an event-history dropped-count field was added to the fixture on disk. Its original geometry downloads omit that field; source-byte identity with the later fixture is not claimed. The retained history contains fewer than 128 records, but omitted-field truncation behavior is not independently verified. The source's session ID is present in the original geometry JSON and reviewer capture reference; the captured panel clips that ID below its visible scroll area, so visual session-ID correspondence was not established.

## Remaining work

The reviewer maximized the same target window and saved pre-sharing geometry (1264 × 502 CSS px). The first maximized diagnostic, report `fb068e09-1ea1-45bc-9a41-c8b0a88fac0f`, stopped with `Shared surface dimensions changed; start a new capture`. It retained one frame at 1922 × 762 source pixels, zero sampled duration and an inconclusive status. Its original screenshot readout shows a transient 1264 × 501 CSS viewport (fractional content height 501.32), so the pre-sharing dimensions cannot establish stable capture geometry. All five original exports independently passed context/numeric/empty-witness checks, and three retained gray-probe image roles matched numeric RGB 176. This establishes the observed dimension-change stop, not completion of the maximized scenario.

The subsequent original source history directly recorded 502 → 501 → 445 CSS-pixel heights during sharing, then a return to 502 after the stop. The calibrated retry used 1264 × 445 from that history. Report `83227c50-cbd7-4896-b3d2-8a44a680e69a` rejected the initial aspect ratio before collecting any frames. It has no sampled viewport or luminance evidence. Do not infer the rejected frame's exact size from initial track settings or nearby DOM events. Its source history again records transitional resizing; the final saved geometry was 1264 × 558 after sharing.

Three original downloads (JSON/HTML/text) were retained and hashed. Both CSV controls were clicked but produced no files because the handlers guard on absent `report.evidence`; the controls remain enabled. The zero-frame report correctly remains inconclusive, but its area reason falsely says dimensions were not supplied despite retained calibration and an explicit mismatch stop reason. These are unresolved NF-02/NF-03, documented with reproduction and source locations in [native findings](NATIVE_FINDINGS.md). The first validation attempt expected CSV metadata records and failed on missing files; no CSV validation pass is claimed for this rejection.

At pause, F11 setup had been requested but not verified. Resume by checking actual source window/scenario and collecting fresh geometry. Do not assume it is still maximized or already in F11, and do not keep retrying the maximized transition without a defined approach to stable geometry. No additional production changes were authorized or made as part of these findings.

Browser F11, content fullscreen and smaller-layout static captures remain open, followed by actual browser-animation/video states, positive witness correspondence/opt-out and broader browser/device coverage. Native mode labels require reviewer action; dimensions alone do not prove maximize/F11. Content-fullscreen API state is recorded separately from browser fullscreen.

Do not advance the implementation TODO or describe the matrix as a full audit PASS.
