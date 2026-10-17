# Flash Review agent handoff

Work resumed at the user's request on October 16, 2026. The user tests on both macOS and Windows. NF-02/NF-03 (0.4.3) and NF-04 (0.4.4, startup geometry settling) are repaired. An automated macOS native set passes (`docs/MAC_NATIVE_RESULTS.md`, harness in the local `native-verification-mac-2026-10-16/harness/`). Windows and reviewer-operated retests are PENDING. Video fixtures (`fixtures/video/`, verify with `python3 test-video-fixtures.py`, needs ffmpeg) and video capture runs are recorded there too. NF-06 (area upper bound can undercount) is open and needs defined area semantics before an algorithm change. Maximized capture is incomplete; F11 setup/capture is unverified. Remaining native coverage BLOCKED. Native actions require the user operating Chrome; check the actual window state first.

Read [the agent plan](docs/AGENT_PLAN.md), [TODO.md](TODO.md), and [the input/size guide](docs/INPUTS_AND_SIZE_TESTING.md) before starting work.

The current build is 0.4.4; the detector algorithm remains 0.4.1. AI-01/02/03 passed independent targeted retest. NF-01's clock repair passes all nine scripts and targeted native duration/resize/visibility-hidden log checks. The overall gate remains BLOCKED on the remaining presentation/video/device matrix, positive witness coverage and other documented limits. Read [the repair status](docs/NF01_REPAIR.md), [native results](docs/NATIVE_RESULTS.md) and [the runbook](docs/NATIVE_VERIFICATION.md) before starting another implementation milestone.

Keep generated frames, mocked browser APIs, decoded-image numerical screening, real playback, and real capture evidence distinct. Neither labels nor callback logs establish native presentation or capture. Never report WCAG conformance from this prototype.

Preserve original audit artifacts. Write new evidence in a new directory and keep capture content and local audit archives out of source publication. Run the nine scripts listed in the plan after code changes. Record limitations and unresolved failures honestly.
