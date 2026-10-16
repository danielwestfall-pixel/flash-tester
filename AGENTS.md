# Flash Review agent handoff

Read [the agent plan](docs/AGENT_PLAN.md), [TODO.md](TODO.md), and [the input/size guide](docs/INPUTS_AND_SIZE_TESTING.md) before starting work.

The current build is 0.4.2; the detector algorithm remains 0.4.1. AI-01/02/03 passed independent targeted retest. NF-01's clock repair passes all nine scripts and targeted native duration/resize/visibility-hidden log checks. The overall gate remains BLOCKED on the remaining presentation/video/device matrix, positive witness coverage and other documented limits. Read [the repair status](docs/NF01_REPAIR.md), [native results](docs/NATIVE_RESULTS.md) and [the runbook](docs/NATIVE_VERIFICATION.md) before starting another implementation milestone.

Keep generated frames, mocked browser APIs, decoded-image numerical screening, real playback, and real capture evidence distinct. Neither labels nor callback logs establish native presentation or capture. Never report WCAG conformance from this prototype.

Preserve original audit artifacts. Write new evidence in a new directory and keep capture content and local audit archives out of source publication. Run the nine scripts listed in the plan after code changes. Record limitations and unresolved failures honestly.
