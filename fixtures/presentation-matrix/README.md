# Static presentation matrix target

Run from the repository root:

```powershell
python -m http.server 8774 --bind 127.0.0.1 --directory fixtures/presentation-matrix
```

Open `http://127.0.0.1:8774/` in a separate native Chrome window from the analyzer. The target is static RGB 176 gray with a compact geometry panel. It plays no animation/video and has no network/upload dependencies.

Set actual browser zoom to 100% and enter each native presentation mode manually. The scenario dropdown and zoom input are reviewer reports; selecting them does not change or prove the native mode/zoom. F11 and the explicit content-fullscreen button are different cases. The content-fullscreen API state is measured directly. Do not infer native maximize/F11 from dimensions alone.

Save a geometry JSON before and after each separate capture. The session ID links those files to the original capture screenshot. Resize/fullscreen/visibility observations record DOM geometry, not displayed/captured frame timing. The history retains 128 events and explicitly counts dropped events. Sharing may change the viewport: verify the readout in the original captured image, not only before sharing. Never derive CSS calibration from encoded pixels or DPR.

The whole target surface is fixed to the viewport and the panel scrolls internally, keeping content height from changing the target bounds. The bottom-right 95%/95% probe stays outside the panel. A 600 CSS-pixel fixture breakpoint changes panel layout; this is a test fixture choice, not a universal WCAG dimension.

Static captures verify geometry/calibration/scenario/export plumbing only. Actual browser-animation states, browser-presented video/player fullscreen, positive witness cases and physical timing still require separate evidence. No conformance or safety verdict is produced.
