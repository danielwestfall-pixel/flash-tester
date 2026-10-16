# NF-01 repair and verification

October 16, 2026. Build `flash-review-0.4.2-20261016`; detector algorithm remains `flash-screen-0.4.1` because the numerical detector did not change.

## Change

Live playback now samples `performance.now()` at every draw-callback entry, including the immediate first draw. The first sample establishes the elapsed-time origin at zero. Later draws, schedule lookup, duration checks and stopped-run elapsed time use that same clock. The requestAnimationFrame timestamp is no longer subtracted from a different startup reading. Equal elapsed times remain allowed; the repair does not fabricate unique times or claim presented-frame timing.

Every replay resets the origin. The exported note states the clock basis and retains the warning that callbacks are not proof of displayed/captured frames. Loading, numerical screening and detector thresholds are unchanged.

## Regression evidence

The added production-page tests in `test-image-ui.mjs` first failed against the old implementation, which followed the supplied animation timestamp instead of the independently advanced callback-entry clock. With the repair, they pass for first animation timestamps approximately 3.4 ms earlier, 1.78 ms earlier, equal to startup and later than startup. They also cover duplicate entry readings, repeated Start while running, repeated playback, schedule boundaries and the three-second cap.

All nine existing scripts passed after the repair. These are generated-frame/mocked browser checks and do not replace native evidence. A real Chrome duration-cap export identifies build 0.4.2 and begins with nonnegative times; the first manual tab-hide attempt reached the timer and is retained as an unsuccessful attempt, not counted as tab hiding.

## Native retest status

Pending completion of fresh native tab-hide and actual window-resize exports and independent log validation. Do not mark NF-01 independently closed from the mock tests alone. The overall verification gate remains open on these checks and the other native presentation/video/device cases documented in `NATIVE_RESULTS.md`.

Local evidence: `native-verification-2026-10-16/nf01-repair/`. The failing original 0.4.1 exports in `run-02/` are retained unchanged. New exports are copied as original bytes, checked for the 0.4.2 build ID, and independently validated for nonnegative/nondecreasing times, plan agreement and actual stop reasons.
