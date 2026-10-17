# Flash Review agent plan

Updated October 16, 2026. Repository: https://github.com/danielwestfall-pixel/flash-tester

## Current state

Build `flash-review-0.4.5-20261017`, algorithm `flash-screen-0.4.2` (NF-06 dilated area upper bound, NF-07, NF-08 module-version guard: [NF06_NF08_REPAIR.md](NF06_NF08_REPAIR.md); earlier NF-02/NF-03 reporting repairs plus NF-04 startup geometry settling; see [NF02_NF03_REPAIR.md](NF02_NF03_REPAIR.md) and the automated [macOS native set](MAC_NATIVE_RESULTS.md); Windows retest pending), algorithm `flash-screen-0.4.1`. Implemented: optional calibrated sampled-area screening, local static images and URL lists, finite directed pairs, seeded shuffle screening/playback, presentation scenario labels, and evidence exports. Direct video decoding, arbitrary multi-image trajectory clearance, automatic fullscreen orchestration, precise temporal-overlap area analysis and separate SC 2.3.2/2.3.3 evaluation remain roadmap work.

AI-01 (pairing phases), AI-02 (navigation/resource invalidation), and AI-03 (export context) passed independent targeted retest. The subsequently found NF-01 clock defect is repaired in 0.4.2: all nine scripts and targeted native duration/resize/visibility-hidden original-log checks pass. The visibility check used a manual Incognito window minimized/restored without automation attached; direct same-window switching on 0.4.2 remains unestablished. The overall gate is **BLOCKED**, not PASS, on the remaining presentation/video/device matrix and positive witness coverage. See [the repair status](NF01_REPAIR.md) and [the historical finding](NATIVE_FINDINGS.md).

Retest evidence: nine scripts passed; 1,600 independent binary event cases; 71 geometry records; 24 independently parsed CSVs; actual Chrome decoded all 32 original PNGs and produced 4 general / 0 red for the frozen seed-1 regression; real Back restoration required reload. All 113 original audit artifacts were unchanged. These numbers describe that retest, not native display/capture validation.

Local evidence directories (excluded from Git): `audit-area-images-2026-10-16/`, `repair-verification-2026-10-16/`, `retest-0.4.1-2026-10-16/`. Retest entry point: `retest-0.4.1-2026-10-16/audit.html`. A mock historical screenshot failed pixel correspondence; valid PNG decoding alone does not prove screenshot fidelity. Do not republish mock exports as native evidence.

## Ordered work

**Paused by the user on October 16, 2026.** Restored-window diagnostic/calibrated exports passed consistency checks but remained insufficient-observation. The maximized diagnostic stopped on a source-size change; a calibrated retry was rejected before sampling. That rejection exposed unresolved NF-02 (false missing-calibration explanation) and NF-03 (enabled CSV buttons silently produce no download without evidence). Reported findings are not repaired. See [matrix progress](PRESENTATION_MATRIX.md), [findings](NATIVE_FINDINGS.md) and TODO. F11 setup was requested, but no reply establishing its completion or capture was received before the pause. On resume, check the user's actual window state before asking for native actions. Do not repeat the completed NF-01 retest. Remaining coverage is BLOCKED; the newly found actionable defects make the current implemented reporting/export scope FAIL.

1. **In progress: remaining native presentation gate.** NF-01 passes targeted retest; do not repeat that repair work without new evidence. Real 0.4.2 navigation/Back cleanup and static screenshot opt-out also passed within documented limits. Next record the presentation-size matrix for browser animations and browser-presented video: default, maximized, browser fullscreen, content/player fullscreen where supported and relevant smaller layouts. Retain original exports, geometry and sampling limitations. Direct tab switching and positive witness/opt-out remain separate missing cases. Follow [current results](NATIVE_RESULTS.md) and [the runbook](NATIVE_VERIFICATION.md). Sharing can change CSS geometry; verify it during capture. No new implementation milestone until required coverage is resolved.
2. Independently review the native evidence and any fixes. Update TODO only to the extent established by evidence. A static target can verify controls, calibration plumbing and exports; it cannot validate flash timing, temporal area overlap or decoded video fidelity.
3. Once the gate is resolved, tackle the first open area-validation item: an independent temporal reference for asynchronous, gradual and moving events. Define temporal semantics and counterexamples before changing the detector. Keep sample-aligned completion area and rolling spatial envelopes separate.
4. Continue the remaining TODO in order, scoping each feature with its own acceptance evidence. Do not infer that a future feature is implemented from this plan.

## Checks and acceptance

Run from the repository root:

```powershell
node test.mjs
node test-ui.mjs
node test-regressions.mjs
node test-fixtures.mjs
node test-fixtures-ui.mjs
node test-area.mjs
node test-image-sequence.mjs
node test-image-ui.mjs
node test-audit-repairs.mjs
```

These tests contain generated frames and mocked browser APIs. Passing them does not close a native-browser gate. Keep the original `fixtures/shuffle-orphan.json` regression. Independently calculate expected values; do not merely repeat implementation logic.

Area evidence uses CSS pixels with explicit whole-surface calibration, a 341 × 256 reference field and 21,824 CSS-pixel limit. A rolling union, bounding box or global percentage is not proof of simultaneous flashing. Small observed area never suppresses frequency candidates or produces conformance clearance.

For every new evidence run record build/commit, browser and OS, exact steps, expected/actual results, source provenance, geometry/zoom/DPR, original export hashes, pass/fail/blocked disposition and remaining limitations. Preserve failed inputs and incomplete coverage. Keep URLs/private capture content out of published examples.

## Publication and handoff

Push source, tests, deterministic fixtures and these reference documents to the dedicated repository using a `codex/` branch. Audit archives and `dist/repair-checks/` are local verification artifacts. GitHub publication does not deploy the hosted Site. Never overwrite original audit evidence or force-push remote history.

Publication succeeded after repository write access was granted on October 16, 2026. Both `main` and `codex/area-image-plan-0.4.1` were verified at the source publication commit. See [PUBLICATION.md](PUBLICATION.md). Native verification remains the active gate.

End each work session with the current gate, changed files, executed checks, next concrete step and blockers. Update this plan when scope or evidence changes.
