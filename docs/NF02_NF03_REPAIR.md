# NF-02 / NF-03 / NF-04 repair

## NF-04 (build 0.4.4): startup geometry settling

Found on macOS (see [MAC_NATIVE_RESULTS.md](MAC_NATIVE_RESULTS.md)). Chrome's sharing infobar animates the shared viewport for a few hundred ms after sharing starts. Before 0.4.4, the first frame locked geometry, so 4 of 5 correctly calibrated captures were rejected on transitional sizes. The same pattern explains the earlier Windows maximized "dimensions changed" stop.

Change (`dist/app.mjs`):

- Geometry locks only after the source size has stayed unchanged for 0.5 s of media time. Earlier frames are discarded, never analyzed, and reported in `startupSettling` (count, media seconds, up to 32 observed sizes), a limitation line and the `startup_settling_json` export column.
- A capture whose size never settles reports that it did not settle. A supplied calibration is then `not-evaluated` with that reason.
- The aspect guard and the post-lock "dimensions changed" stop are unchanged.
- The relative time origin is now the first analyzed frame.

Regression (`test-ui.mjs`): transitional 1×1 → 3×2 → 2×1 startup with a 2 × 1 calibration must reach `calibrated-screening` with exactly 80 discarded frames, a later size change must still stop the capture, and a never-settling size must report as unsettled. With settling disabled, the test fails with `calibration-rejected`. Native: 5/5 calibrated default captures accepted on macOS (previously 1/5).

Coverage cost: up to about 0.5 s (longer for sparse static sources) at capture start is not analyzed and is reported as such.

**Correction (0.4.5 red-team retest):** in 0.4.4/0.4.5 the lost interval was shown only in the exports, never in the capture UI, and a burst inside it did not affect the status (RT-01). Static pages that do not repaint could never settle, so calibration was never applied (RT-04). The regression described above also used the old semantics. Both issues are repaired in 0.5.0: stable-size startup frames are buffered and analyzed, transitional sizes are screened for frequency, and static pages are analyzed as unconfirmed geometry. See [RELEASE_0.5.0.md](RELEASE_0.5.0.md).

# NF-02 / NF-03 repair

October 16, 2026. Build `flash-review-0.4.3-20261016`; detector algorithm remains `flash-screen-0.4.1` because the numerical detector did not change. Work resumed at the user's request.

## Change

**NF-02.** When a capture ends before the analyzer is initialized but the reviewer supplied calibration, the area result is no longer the generic "dimensions were not supplied" fallback (`dist/area.mjs` `unappliedArea`, `dist/app.mjs` `finish`):

- Aspect-ratio rejection: `area.status` and `evaluation.area` are `calibration-rejected`. The supplied CSS dimensions, the stop reason, and the source pixel dimensions of the frame that was actually rejected (`observedSourcePixels`, read from the video element at rejection time, not inferred from track settings) are retained.
- Calibrated capture that ends with no analyzed frames for another reason (Stop, sharing ended, startup timeout): `not-evaluated`, with calibration retained and reason `No frames were analyzed before the capture ended.` `observedSourcePixels` is `null`.
- No calibration supplied: unchanged wording and structure.

`areaSummary` distinguishes all three, so the UI, HTML, text and JSON agree. CSV/text export context adds `area_reason` and `area_observed_source_pixels_json`. The aspect guard itself is unchanged.

**NF-03.** Both CSV controls now always download when a report exists. Without evidence they produce one `record_type=metadata` row with blank measurement columns, and `evidence_coverage_json` states `{"status":"not-collected",...}` instead of `null`. No measurements are invented.

## Regression evidence

`test-ui.mjs` drives the production handlers through the mocked capture flow and parses the saved blobs with an independent RFC 4180 reader. It checks a zero-frame aspect rejection (2 × 1 CSS calibration against a 1 × 1 source), a calibrated capture stopped before any frame, and the unchanged uncalibrated wording. Against the original 0.4.2 source the new test fails (`All five export controls create a file`: 3 of 5). With the repair, all nine scripts pass.

These are mocked browser checks. They do not establish native behavior.

## Native retest status

**macOS: PASS within automated conditions** (Chrome 155, build 0.4.3, run M1 in [MAC_NATIVE_RESULTS.md](MAC_NATIVE_RESULTS.md)): all five downloads were produced, both CSVs were metadata-only, the rejection was explained consistently, and the rejected source pixels were recorded. That run was CDP-driven by the same agent that wrote the fix, so it is not an independent retest. **Windows and reviewer-operated retests remain PENDING.**

Original acceptance plan: NF-02/NF-03 are not fully cleared until an independent real-Chrome retest reproduces the original maximized rejection (or any calibrated aspect mismatch) on 0.4.3 and the original downloads are checked:

1. All five downloads are produced; both CSVs contain exactly one metadata record with blank measurements and the same report/build ID.
2. UI, HTML, text, JSON and CSV area reasons all say the supplied calibration was rejected for an aspect mismatch; none says it was not supplied.
3. `observedSourcePixels` is present and is consistent with the stop reason. It is not compared against track settings.

The original failing 0.4.2 downloads under `native-verification-2026-10-16/presentation-matrix/` must remain unchanged.
