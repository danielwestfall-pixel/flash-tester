# NF-01 repair and verification

October 16, 2026. Build `flash-review-0.4.2-20261016`; detector algorithm remains `flash-screen-0.4.1` because the numerical detector did not change.

## Change

Live playback now samples `performance.now()` at every draw-callback entry, including the immediate first draw. The first sample establishes the elapsed-time origin at zero. Later draws, schedule lookup, duration checks and stopped-run elapsed time use that same clock. The requestAnimationFrame timestamp is no longer subtracted from a different startup reading. Equal elapsed times remain allowed; the repair does not fabricate unique times or claim presented-frame timing.

Every replay resets the origin. The exported note states the clock basis and retains the warning that callbacks are not proof of displayed/captured frames. Loading, numerical screening and detector thresholds are unchanged.

## Regression evidence

The added production-page tests in `test-image-ui.mjs` first failed against the old implementation, which followed the supplied animation timestamp instead of the independently advanced callback-entry clock. With the repair, they pass for first animation timestamps approximately 3.4 ms earlier, 1.78 ms earlier, equal to startup and later than startup. They also cover duplicate entry readings, repeated Start while running, repeated playback, schedule boundaries and the three-second cap.

All nine existing scripts passed after the repair. These are generated-frame/mocked browser checks and do not replace native evidence. A real Chrome duration-cap export identifies build 0.4.2 and begins with nonnegative times; the first manual tab-hide attempt reached the timer and is retained as an unsuccessful attempt, not counted as tab hiding.

## Native retest status

**PASS for the targeted NF-01 clock repair. Overall coverage gate remains BLOCKED.** Tested production commit `20b3d02b56df97ed87540ae02628757db6e317d1`.

The repaired native resize run recorded `viewport resized` after 1.2901 seconds, with 79 callbacks. Independent validation of the original JSON found all times nonnegative/nondecreasing and every image selection consistent with the plan. Acknowledgment reset and Play remained disabled. The real duration-cap export also passed the independent timestamp/plan check. Original native downloads are preserved with hashes.

Manual tab-switch/minimize attempts in the controlled tab reached the timer, and automated visible-tab activation returned `Capability is not available: visibility`; those attempts were not counted as visibility passes. The successful isolated check used a user-opened Incognito window with no browser automation attached before export. Its local QA HTML only prefills identical gray URLs/display dimensions and adds instructions; it imports the repaired production module unchanged, with no mock visibility events or autoplay.

The user minimized/restored that window and manually downloaded `flash-image-sequence-results (20).json`. Original SHA-256: `986158dbf368518448137e40e94253f9a72331e84100db113a9a328fddb6dc69`. It identifies build 0.4.2 and records `tab hidden` after 0.6233 seconds, with 39 callbacks beginning `0`, `0.006`, `0.010899999998509885`. Independent checks found every time nonnegative/nondecreasing and every logged image consistent with the planned schedule. The original bytes are retained as `tab-hide-download.json`. This is native visibility hiding by minimization, not proof of a direct same-window tab switch on 0.4.2. Post-stop DOM controls in the isolated window were not independently inspected because that window remained unattached.

`validate_fixed_logs.py` passes all three required original native-log cases (duration, visibility hidden and actual resize), confirms build/plan/timestamps, and verifies the failing 0.4.1 originals remain unchanged. These are callback observations, not presented/captured-frame certification. The broader presentation/video/device matrix remains open.

Additional real-browser checks passed on 0.4.2: navigating away during actual playback and returning with Back cleared released images/results and required reload. A static native capture with screenshots disabled retained one numeric row and no images; all five original export formats agreed on context, and the empty witness CSV used metadata-only blank measurements. Its one sampled frame is insufficient observation and does not validate timing, positive witness opt-out or area.

Local evidence: `native-verification-2026-10-16/nf01-repair/`. The failing original 0.4.1 exports in `run-02/` are retained unchanged. New exports are copied as original bytes, checked for the 0.4.2 build ID, and independently validated for nonnegative/nondecreasing times, plan agreement and actual stop reasons.
