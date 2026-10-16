# Native browser verification: next gate

Status: **BLOCKED — 0.4.2 clock repair passes regressions but still awaits fresh native hide/resize retest; other coverage remains incomplete.** October 16, 2026. See [repair status](NF01_REPAIR.md), [native results](NATIVE_RESULTS.md) and [the original finding](NATIVE_FINDINGS.md).

The available automation cannot operate native OS windows or sharing pickers. A person must perform those actions. DOM events, viewport overrides and mocked capture are not substitutes. Retest 0.4.1 already established the three targeted repairs; this run closes only the native cases actually observed.

## Set up

1. Run `python -m http.server 8765 --bind 127.0.0.1 --directory dist` from the repository root. Reuse an existing server if already running; do not stop another session's server.
2. Separately run `python -m http.server 8772 --bind 127.0.0.1 --directory fixtures/native-safe`. Open `http://127.0.0.1:8772/` in a normal desktop Chrome/Edge tab. The target is static gray with geometry readouts and an explicit content-fullscreen button. It starts no animation. The two PNGs in that directory are byte-identical gray.
3. Record browser/OS/version, monitor/display scale, 100% browser zoom, target viewport CSS dimensions, displayed content rectangle, DPR, source dimensions and fullscreen kind. Obtain target dimensions from the target's readout after each presentation change; never substitute encoded pixels or just the content rectangle for entire tab dimensions.
4. Create a new local evidence directory. Copy `docs/native-run-template.json` into it; preserve original downloads and calculate SHA-256 hashes. Never write into original audit directories.

## Actual playback controls

On `/image-sequences.html`, use the local-file picker to select both `fixtures/native-safe/gray-a.png` and `fixtures/native-safe/gray-b.png`, clear the URL list, then click **Load images without playback**. These are distinct files with identical image bytes; duplicate URL lines would be deduplicated and would not supply two inputs. Confirm both loaded, no preview appears, Start requires acknowledgment, and numerical analysis does not play. A gray-to-black change at start/stop may still occur; these controls do not establish general playback safety.

Use a fresh acknowledgment and Start for each case. The three-second cap makes actions time-sensitive; prepare the action before Start. Inspect/download the actual log after each run.

| Case | Native action | Expected evidence |
| --- | --- | --- |
| Repeated Start | Attempt second Start while running | No concurrent run; one schedule |
| Stop / Escape | Click Stop; separately press Escape | `endedBecause` is `Stop` / `Escape`; acknowledgment reset |
| Tab hide | Switch to another tab immediately after Start | `endedBecause` is `tab hidden`; no restart on return |
| Resize | Drag a native window edge while running | `endedBecause` is `viewport resized`; new acknowledgment required |
| Duration | Wait without action | Stops at cap; callbacks described only as callbacks |
| Navigation / Back | Navigate away while running, then Back | Images released; reload required; old exports unavailable |

A run ending at the cap before the intended hide/resize does not pass that case. Repeat and keep both records. Callback timestamps cannot prove presented/captured frame timing.

## Calibrated static capture and saved bytes

Use the static target at port 8772. Enter each presentation mode before capture and obtain settled target dimensions. In the capture tab, select the matching scenario, enable area calibration and enter the **whole target tab's CSS width/height**. Select only that static target in the native sharing picker. Start a separate run after any size change.

| Scenario | Action | Current result |
| --- | --- | --- |
| default | Initial browser window | Static calibration/export plumbing verified; insufficient observation for temporal validation |
| maximized | Native maximize | NOT RUN |
| browser-fullscreen | Native F11/equivalent | NOT RUN |
| content-fullscreen | Target's explicit fullscreen button | NOT RUN |
| responsive-small | Resize to a layout-changing width | NOT RUN |

The static target verifies scenario/calibration/export plumbing only. Its content fullscreen is a content API test, not a real video player's fullscreen test. Actual video/player and browser-animation state matrices remain separate coverage obligations.

Before accepting calibration, verify the CSS geometry **during sharing**. In the first native run, the same target read 1264 × 502 before sharing and 1264 × 445 in the original captured image. A pre-share calibration was correctly rejected. A diagnostic capture with calibration off exposed the changed readout; the next run used 1264 × 445 and its screenshot confirmed that mapping. Do not derive CSS dimensions by dividing encoded pixels by DPR. Keep rejected attempts as evidence and recheck geometry after entering any new presentation mode. Track settings captured at stream startup can differ from the actual first sampled video dimensions; retain both and use the sampled viewport plus observed CSS geometry for calibration checks.

Download original JSON, HTML, text and both CSVs. Check shared report/build identity, scenario, calibration, reference field, coverage and limitations. Parse CSV with an RFC-compatible parser. Empty detection-witness CSV must contain a metadata record, not invented observations. Confirm static no-candidate results remain inconclusive. Open standalone HTML and decode each embedded image; compare screenshot pixels at numeric probe/witness coordinates, accounting for overlays and JPEG compression. Empty witness evidence must stay explicitly empty. A static target cannot exercise a positive witness: retain that as untested until an appropriate separately reviewed capture is available.

Repeat with screenshots disabled and ensure no embedded screenshots survive. Start another run, change calibration/settings, and check exports belong to their original recorded run rather than a falsely relabeled configuration. Resize the shared target during a separate capture: capture must stop and request a new run. Record missing/canceled sharing, source aspect mismatch and unavailable fullscreen honestly.

## Exit criteria

No gate closure from preparation or a single static capture. Retain original bytes, per-case steps/results and geometry. Review native control cases and each applicable presentation case, identify remaining video/animation/device/timing gaps, then update TODO with scoped evidence. Do not report WCAG conformance or advance implementation while the required gate remains open.
