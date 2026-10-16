# Flash Review agent plan

Updated October 16, 2026. Repository: https://github.com/danielwestfall-pixel/flash-tester

## Current state

Build `flash-review-0.4.1-20261016`, algorithm `flash-screen-0.4.1`. Implemented: optional calibrated sampled-area screening, local static images and URL lists, finite directed pairs, seeded shuffle screening/playback, presentation scenario labels, and evidence exports. Direct video decoding, arbitrary multi-image trajectory clearance, automatic fullscreen orchestration, precise temporal-overlap area analysis and separate SC 2.3.2/2.3.3 evaluation remain roadmap work.

AI-01 (pairing phases), AI-02 (navigation/resource invalidation), and AI-03 (export context) passed independent targeted retest. That retest was BLOCKED on native coverage and found no new defect. Subsequent native verification found **P2 NF-01: negative/backwards callback timestamps**, so the current gate is **FAIL**, with additional coverage still incomplete. See [NATIVE_FINDINGS.md](NATIVE_FINDINGS.md). Native tab-hide and window-resize stop behaviors and one default static calibrated capture/export check have now been observed; they do not clear the timing defect or the remaining matrix.

Retest evidence: nine scripts passed; 1,600 independent binary event cases; 71 geometry records; 24 independently parsed CSVs; actual Chrome decoded all 32 original PNGs and produced 4 general / 0 red for the frozen seed-1 regression; real Back restoration required reload. All 113 original audit artifacts were unchanged. These numbers describe that retest, not native display/capture validation.

Local evidence directories (excluded from Git): `audit-area-images-2026-10-16/`, `repair-verification-2026-10-16/`, `retest-0.4.1-2026-10-16/`. Retest entry point: `retest-0.4.1-2026-10-16/audit.html`. A mock historical screenshot failed pixel correspondence; valid PNG decoding alone does not prove screenshot fidelity. Do not republish mock exports as native evidence.

## Ordered work

1. **In progress: native verification gate.** Reported finding NF-01 must be repaired and independently retested before the gate can pass; the initial independent verification left production unchanged. Real Chrome Stop/Escape/cap, native tab-hide/window-resize stop behavior and one default static capture/export check have been observed. Follow [current results](NATIVE_RESULTS.md) and [the runbook](NATIVE_VERIFICATION.md) for the remaining matrix. Sharing changed CSS geometry; verify dimensions during sharing. Record unavailable cases honestly.
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
