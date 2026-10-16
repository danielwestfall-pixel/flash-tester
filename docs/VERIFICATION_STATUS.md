# Verification status at publication

October 16, 2026. Source build `flash-review-0.4.1-20261016`.

All nine scripts listed in [AGENT_PLAN.md](AGENT_PLAN.md) were rerun successfully before this publication. `git diff --check` passed. This includes existing generated-frame regressions and mocked input/capture contracts, not native capture.

The independent prior retest passed AI-01/AI-02/AI-03 within tested conditions; the overall gate remains BLOCKED. Its original local artifacts are preserved and excluded from the repository, as described in the plan.

The next gate has started with a native runbook, a per-run JSON template and a static test target. The two 512 × 256 RGB PNG fixtures have identical SHA-256 `bb4f563a677078e5609a4f0381fd7abd27715f1c6c40527c6d73e5135b9f7c0a`.

The new static target was opened in real Chrome over loopback; its geometry readout rendered. Its explicit content-fullscreen request was denied with `Fullscreen unavailable: not granted`. This verifies the helper's error display only. Native F11, maximize, tab-hide/resize playback, calibrated capture and saved real-capture exports were not performed in this publication step. In-app browser automation was unavailable; Chrome was accessed through the alternative browser connection. Native OS controls and sharing pickers remain unavailable to automation.

Follow [NATIVE_VERIFICATION.md](NATIVE_VERIFICATION.md) next. Do not infer coverage from fixture preparation, scenario names, mocked APIs or a denied fullscreen request.

Subsequent native execution is recorded in [NATIVE_RESULTS.md](NATIVE_RESULTS.md): real Chrome Stop/Escape/cap, tab-hide/window-resize stop behavior and default static calibrated capture/export checks have now run. That 0.4.1 verification failed because independent validation found negative/backwards callback timestamps in two native exports; see [NF-01](NATIVE_FINDINGS.md). The initial-publication limitations above remain historical; other coverage is still incomplete.

The subsequent authorized 0.4.2 NF-01 clock repair passes all nine scripts; targeted native duration/resize/visibility-hidden log checks pass. Current repair details are in [NF01_REPAIR.md](NF01_REPAIR.md).
