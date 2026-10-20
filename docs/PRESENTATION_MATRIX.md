# Presentation matrix progress

Updated October 19, 2026. Production build `flash-review-0.4.3-20261019`, algorithm `flash-screen-0.4.1`. NF-02 and NF-03 code repairs pass all nine test suites and live native verification. **Static presentation matrix plumbing complete across all five scenarios. Gate remains BLOCKED on animation/video coverage, direct tab switching, and positive witness cases.**

The [static target](../fixtures/presentation-matrix/README.md) records DOM geometry and reviewer scenario labels. The reviewer operates its separate native Chrome window; browser automation operates only the analyzer. This stage checks capture/calibration/export plumbing. It does not establish animation/video coverage, positive detection witnesses, physical viewing geometry or frame presentation timing.

## Presentation matrix results

All five scenarios were exercised in real desktop Chrome (Windows 10/11, 100% browser zoom, DPR 1.25):

| Scenario | Run | Report ID | Viewport (Source px) / Calibration | Area Status / Peak Bounds | Exports Checked |
| --- | --- | --- | --- | --- | --- |
| **Restored** | Diagnostic | `d7285b89-5d43-4631-b1fd-0f4dbbdfc925` | 1828 × 732 / Uncalibrated | `not-evaluated` | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Restored** | Calibrated | `31cf73bd-2cdd-4a0e-b179-9c2c0f33ee1a` | 1828 × 732 / 1202 × 481 CSS px | `calibrated-screening` (56.5 CSS px²) | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Maximized** | Diagnostic | `effe2c5a-a698-40b1-a10f-f6cd3c027cad` | 1920 × 918 / Uncalibrated | `not-evaluated` | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Maximized** | Calibrated | `5aa102b7-71cb-4f7f-8a57-a838f552fae4` | 1920 × 918 / 1536 × 735 CSS px | `calibrated-screening` (0.0 CSS px²) | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **F11 Fullscreen** | Diagnostic | `07b1a441-e689-4f3d-b17a-c74279589ea5` | Track 1920 × 1200 / Uncalibrated | `not-evaluated` (0 frames) | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **F11 Fullscreen** | Calibrated | `43b5a170-1b80-454c-ace8-50cd3c408250` | Track 1920 × 1200 / 1536 × 960 CSS px | `not-evaluated` (0 frames) | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Content Fullscreen** | Diagnostic | `38c0964a-184b-40c1-8110-d923d99de58b` | Window 1920 × 1198 / Uncalibrated | `not-evaluated` (0 frames) | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Content Fullscreen** | Calibrated | `89debc18-2a7c-4823-b283-abe308b83b9c` | Track 1920 × 1200 / 1536 × 960 CSS px | `not-evaluated` (0 frames) | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Responsive Small** | Diagnostic | `501ea931-5d42-4561-81ba-7dfffe8cb928` | 1280 × 1160 / Uncalibrated | `not-evaluated` | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Responsive Small** | Rejection | `bb37e449-5902-4f9f-8b95-cced79018a1c` | 1280 × 1020 / Rejected 512 × 464 CSS | `rejected` (Aspect mismatch witness) | JSON, HTML, TXT, Probe CSV, Witness CSV |
| **Responsive Small** | Calibrated | `4effd308-dce6-42d8-bd34-0753c2e7c074` | 1280 × 1020 / 512 × 408 CSS px | `calibrated-screening` (0.0 CSS px²) | JSON, HTML, TXT, Probe CSV, Witness CSV |

## Verification of NF-02 and NF-03 in live Chrome

1. **NF-02 (P2) Verified**: Report `bb37e449-5902-4f9f-8b95-cced79018a1c` rejected calibration when the small window resized to 512 × 408 during sharing while 512 × 464 was supplied. In UI, HTML, text, and CSV exports:
   - Calibration status is explicitly `rejected`.
   - Supplied calibration (`512 × 464`) and observed dimensions (`1280 × 1020`) are preserved.
   - The primary area reason truthfully states: `Area calibration aspect ratio does not match the shared surface; area not evaluated.`
   - No export claims dimensions were "not supplied".
2. **NF-03 (P3) Verified**: Across zero-evidence runs (`07b1a441`, `43b5a170`, `38c0964a`, `89debc18`, `bb37e449`), clicking both **Download selected-probe CSV** and **Download detection-witness CSV** succeeded and exported valid metadata-only CSV files (`record_type: metadata`) with zero invented measurement rows.

Local evidence directories:
- `native-verification-2026-10-16/presentation-matrix/` (restored window baseline)
- `native-verification-2026-10-19/maximized/`
- `native-verification-2026-10-19/browser-fullscreen/`
- `native-verification-2026-10-19/content-fullscreen/`
- `native-verification-2026-10-19/responsive-small/`

All downloads are hashed and preserved locally.

## Remaining work

Static plumbing across the presentation matrix is complete. Remaining roadmap gates:
- Real browser animation sequences and CORS video playback across presentation sizes.
- Direct same-window tab switching on 0.4.3.
- Positive detection witness correspondence and opt-out under live capture.
- Independent reference temporal-overlap flash area modeling.
