# Flash Review agent handoff

Read [the agent plan](docs/AGENT_PLAN.md), [TODO.md](TODO.md), and [the input/size guide](docs/INPUTS_AND_SIZE_TESTING.md) before starting work.

The current build is 0.4.1. AI-01/02/03 passed independent targeted retest; the overall audit remains BLOCKED on native browser/device evidence. Continue the open verification gate before starting another implementation milestone. See [the native verification runbook](docs/NATIVE_VERIFICATION.md).

Keep generated frames, mocked browser APIs, decoded-image numerical screening, real playback, and real capture evidence distinct. Neither labels nor callback logs establish native presentation or capture. Never report WCAG conformance from this prototype.

Preserve original audit artifacts. Write new evidence in a new directory and keep capture content and local audit archives out of source publication. Run the nine scripts listed in the plan after code changes. Record limitations and unresolved failures honestly.
