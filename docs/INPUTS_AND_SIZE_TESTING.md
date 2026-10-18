# Image, video and animation testing

## Available now

Start the server from `flash-tester`: `python -m http.server 8766 --bind 127.0.0.1 --directory dist`.

- [Image sequences](http://127.0.0.1:8766/image-sequences.html): choose multiple local static PNG/JPEG/WebP files, paste one HTTP(S) image URL per line, or fill the bundled PNG sample URLs. Click Load; inspect every failure before screening. Remote hosts must permit CORS. No images are displayed during loading or numerical analysis.
- Ordered-pair screening runs A → B → A for every directed pair of 2–12 loaded images. Choose image changes per second and displayed CSS dimensions. Twenty changes/s means ten complete flashes/s for alternating A/B, not twenty flashes/s. Each pair is analyzed for three seconds at a generated 120 fps clock.
- Seeded shuffle screening/playback accepts 2–32 loaded images. The same seed/count/settings produce the same planned order. JSON records the loaded image labels, rate, size, schedules, failures and algorithm version. Live logs record draw callbacks, which are not proof of presented or captured frames. Playback is capped at three seconds and requires acknowledgment plus Start.
- Failed loads make coverage incomplete. Unsupported animated formats are rejected. Reports omit remote source URLs; keep your original URL list separately if needed for traceability. Replacing an image at the same URL requires reloading and testing again.
- [Tab capture](http://127.0.0.1:8766/) works with visible browser video and page animations. Enable area calibration only when you know the CSS dimensions of the **entire captured surface**. Encoded video resolution, device pixels and player dimensions are not interchangeable with that number. If you cannot establish this mapping, leave area calibration off.

## Video fixtures

`fixtures/video/` provides deterministic H.264/VP9 fixtures, a native-player target page (`python3 -m http.server 8775 --bind 127.0.0.1 --directory fixtures/video`) and a browser encoder. See [its README](../fixtures/video/README.md). Native controls auto-hiding can stall tab capture (macOS Chrome); record it, or disable controls for sampling-quality runs.

## Size matrix: one capture per scenario

| Scenario | Video | Browser animations |
| --- | --- | --- |
| Default page load | Default embedded player size; test autoplay/start and relevant content | Initial viewport, autoplay and interaction-triggered states |
| Maximized browser | Maximize the window, allow responsive layout to settle, then capture | Repeat every relevant state at the resulting layout |
| Browser fullscreen | Enter F11 (or browser fullscreen equivalent), then start a new capture | Repeat states after the layout settles |
| Content fullscreen | Use the player's fullscreen control and start a separate capture at that presentation size | Use content fullscreen if the animation offers it |
| Smaller responsive layout | Test breakpoints that change player/crop/visible content | Test breakpoints that change the animation/layout/content |

F11 and player fullscreen are different scenarios. Test content at its largest available presentation size as well as relevant alternate layouts. WCAG does not prescribe a universal list of smaller viewport dimensions. Use standard zoom and document viewport CSS width/height, content rectangle, source resolution, DPR, zoom, presentation scenario, interaction states, duration and loop behavior. The current capture form records the scenario and reviewer-supplied surface CSS dimensions; put the additional details in States and interactions.

Enter each presentation mode **before** starting that run. Starting to share shrinks the shared viewport (Chrome's sharing infobar, 56 CSS px on macOS) and can rescale captured tabs. Calibrate with the CSS size the target reports **during** sharing. From 0.4.4 the analyzer waits 0.5 s for the size to settle before locking geometry, and reports the discarded startup frames. A changing captured resolution stops analysis and requires a new capture. Keep the analyzer in its own visible window and exercise the shared target in another window. A hidden analyzer tab receives no frames (headless Chrome evidence, red-team RT2-09); from 0.5.1 the report states how long the analyzer was hidden. Browser fullscreen or a player can block/alter capture on some devices; record this as missing coverage. Tab capture does not establish protected video or HDR fidelity.

## Area implementation and interpretation

The new area meter scans a moving 341 × 256 CSS-pixel reference field and compares measured upper bounds to 21,824 CSS pixels. It reports both sample-aligned pair completions and a rolling spatial envelope of observed completed-pair locations. It does not substitute a whole-screen fraction or bounding-box area for this measurement. Nearby regions in a field add; distant regions outside that field do not.

The rolling envelope is conservative and can include locations that flashed at different times. Exceeding it alone is not proof of concurrent area failure. An envelope below the reference limit only describes observed sampled events. Downsampling, missed frames, gradual/asynchronous/moving flashes, experimental red evaluation and fine-pattern exceptions still limit coverage. Frequency candidates are retained even if measured area is small. No automatic WCAG conformance pass/fail is issued.

## Coverage still planned

See [TODO.md](../TODO.md). Local-video/URL decoding, encoded video fixtures, automatic scenario orchestration, responsive-state inventories, full temporal area validation, arbitrary multi-image trajectories, fine-pattern exceptions and separate SC 2.3.2/2.3.3 checks remain tracked work. A random sample or all alternating pairs cannot prove that every possible multi-image sequence passes.

## Verification

Run `node test-area.mjs`, `node test-image-sequence.mjs`, `node test-image-ui.mjs`, plus `node test.mjs`, `node test-ui.mjs`, `node test-regressions.mjs`, `node test-fixtures.mjs` and `node test-fixtures-ui.mjs`. These verify generated inputs and mocked browser contracts without visible flashing. Browser verification additionally loaded eight real PNGs through same-origin URLs and completed 56 ordered-pair tests. External-host CORS and real display/tab-capture timing require testing in the intended environment.

Source: [WCAG SC 2.3.1 and reference viewing conditions](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html).
