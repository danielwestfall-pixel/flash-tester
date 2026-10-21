# Flash Review: Client-Side WCAG 2.2 Photosensitivity Screening Suite

[![Tests: 18 Suites Passing](https://img.shields.io/badge/tests-18%20suites%20passing-brightgreen.svg)](#running-the-automated-test-suite)
[![Dependencies: Zero](https://img.shields.io/badge/dependencies-0%20(pure%20vanilla%20ESM)-blue.svg)](#architecture--security)
[![WCAG Criteria: SC 2.3.1 | SC 2.3.2 | SC 2.3.3](https://img.shields.io/badge/WCAG%202.2-SC%202.3.1%20%7C%202.3.2%20%7C%202.3.3-orange.svg)](#the-auditors-handbook-wcag-22-photosensitivity)
[![Privacy: 100% Client-Side](https://img.shields.io/badge/privacy-100%25%20local%20(zero%20telemetry)-success.svg)](#privacy--security-guarantees)

**Flash Review** is a high-precision, zero-install, client-side accessibility screening engine designed to evaluate web content, motion animations, video files, and image slideshows against **WCAG 2.2 Success Criteria 2.3.1 (Three Flashes or Below Threshold), 2.3.2 (Three Flashes - Level AAA), and 2.3.3 (Animation from Interactions)**.

It requires **no build step**, **no `npm install`**, and **zero external server dependencies**. All computations run directly inside your browser or via Node.js using pure vanilla ES Modules.

---

## Table of Contents
1. [Quickstart: Zero to First Audit in 60 Seconds](#quickstart-zero-to-first-audit-in-60-seconds)
2. [The Auditor's Handbook: WCAG 2.2 Photosensitivity in Plain English](#the-auditors-handbook-wcag-22-photosensitivity)
3. [The Four Screening Modules](#the-four-screening-modules)
   - [1. Real-Time Tab Capture (`index.html`)](#1-real-time-tab-capture-indexhtml)
   - [2. Direct Video Screening (`video.html`)](#2-direct-video-screening-videohtml)
   - [3. Image Sequences & Slide Transitions (`image-sequences.html`)](#3-image-sequences--slide-transitions-image-sequenceshtml)
   - [4. Reference Calibration Fixtures (`fixtures.html`)](#4-reference-calibration-fixtures-fixtureshtml)
4. [The 5 Presentation Scenarios: Why Scale Matters](#the-5-presentation-scenarios-why-scale-matters)
5. [How to Read & Interpret Audit Results](#how-to-read--interpret-audit-results)
6. [Audit Evidence & Export Formats](#audit-evidence--export-formats)
7. [The WCAG Genius & Lead Architect Technical Reference](#the-wcag-genius--lead-architect-technical-reference)
   - [Linearized Relative Luminance Formulations](#linearized-relative-luminance-formulations)
   - [General Flash Thresholds](#general-flash-thresholds)
   - [Saturated Red & CIE 1976 Chromaticity Space](#saturated-red--cie-1976-chromaticity-space)
   - [Dual-Phase Pairing Engine](#dual-phase-pairing-engine)
   - [Microsecond-Precision Sliding Window Purge](#microsecond-precision-sliding-window-purge)
   - [10° Visual Field Reference Geometry](#10-visual-field-reference-geometry)
   - [Temporal Area Overlap vs. Spatial Envelopes](#temporal-area-overlap-vs-spatial-envelopes)
   - [Spatial Fine-Pattern & Stippling Exemptions](#spatial-fine-pattern--stippling-exemptions)
8. [Running the Automated Test Suite](#running-the-automated-test-suite)
9. [Architecture & Security](#architecture--security)
10. [Regulatory & Conformance Honesty](#regulatory--conformance-honesty)

---

## Quickstart: Zero to First Audit in 60 Seconds

### Running Locally (Recommended)
Because modern web browsers enforce security and CORS boundaries on ES modules loaded via `file:///`, run a lightweight local static server:

```bash
# Using Python (built-in on Windows/Mac/Linux):
python -m http.server 8765 --bind 127.0.0.1 --directory dist

# Or using Node.js:
npx serve dist -p 8765
```

Open your browser to:
**`http://127.0.0.1:8765`** (Desktop Chrome or Edge recommended for screen-sharing API support).

### Running from GitHub Pages
1. Go to your repository settings: **Settings** > **Pages**.
2. Under **Build and deployment**, select **Deploy from a branch**.
3. Choose branch `main` and folder `/dist`.
4. Open your GitHub Pages URL (served over secure `https://`).

---

## The Auditor's Handbook: WCAG 2.2 Photosensitivity

### Why Photosensitive Epilepsy Screening Matters
Approximately 3% of people with epilepsy have **photosensitive epilepsy**, where flickering lights, high-contrast strobes, or rapid color transitions can trigger seizures. Flashing content can also provoke severe migraines, dizziness, and vestibular disorientation in individuals with neurological conditions.

### The Three WCAG Criteria Explained Simply

| Criterion | Level | Summary | Safe Threshold |
| :--- | :---: | :--- | :--- |
| **SC 2.3.1 (Three Flashes or Below Threshold)** | **A** | Restricts flashing lights and saturated red transitions. Small flashes or low-contrast flashes are permitted under specific safe area and contrast limits. | $\le 3\text{ flashes/sec}$, OR total area $< 21,824\text{ CSS px}^2$ within any 10° visual field, OR luminance change $< 0.10$. |
| **SC 2.3.2 (Three Flashes)** | **AAA** | Strict zero-tolerance flashing rule. **No safe-area exemptions are allowed.** Even tiny icons or buttons cannot flash more than 3 times per second. | Strictly $\le 3\text{ flashes/sec}$ anywhere on screen, regardless of size or area. |
| **SC 2.3.3 (Animation from Interactions)** | **AAA** | Restricts motion animation triggered by user interaction (parallax, zooming, flying elements) unless essential or user can disable it via `prefers-reduced-motion`. | User controls to disable non-essential motion or honoring OS motion reduction preferences. |

### What Counts as "One Flash"?
A flash is defined by WCAG as **a pair of opposing changes** (e.g., Dark $\rightarrow$ Bright $\rightarrow$ Dark, or Bright $\rightarrow$ Dark $\rightarrow$ Bright).
- 1 flash = 2 opposing transitions.
- 4 flashes in 1 second = 8 rapid transitions.
- **The Rule of Three**: Content that produces **4 or more flashes within any rolling 1.0-second window** violates the threshold unless it qualifies for a verified safe-area or contrast exemption under Level A.

---

## The Four Screening Modules

```
dist/
├── index.html            --> [1] Real-Time Screen & Tab Capture
├── video.html            --> [2] Direct Video File Decoder
├── image-sequences.html  --> [3] Image Slideshow & Trajectory Screener
└── fixtures.html         --> [4] Standard Reference Test Fixtures
```

---

### 1. Real-Time Tab Capture (`index.html`)
Use this module to test live, interactive web pages, CSS animations, WebGL games, or embedded video players:
1. Open the page under review in a separate tab or window.
2. Open `index.html` in your auditor window.
3. Choose your presentation scenario (e.g., Default Window, Maximized, F11 Fullscreen).
4. Enter optional surface CSS dimensions for **calibrated area screening**.
5. Click **"Share a tab & start capture"** and select the target tab in the browser picker.
6. Interact with the target page (hover states, modal opens, playback).
7. The screener automatically stops after the selected duration (or press `Escape` / click `Stop`), compiles per-frame luminance telemetry, and highlights any detected flash candidates.

---

### 2. Direct Video Screening (`video.html`)
Use this module to audit pre-recorded video files (`.mp4`, `.webm`, `.ogg`) without screen sharing:
1. Drag and drop your video file or click **"Browse Video File"**.
2. The scanner validates the container signature (`ftyp`, `webm`, `OggS`) and probes video duration and dimensions.
3. Select your step interval (default: 60 fps / 0.0167 s steps) and display scale.
4. Click **"Scan Video File"**. The video decodes frame-by-frame off-screen.
5. Export full audit logs with frame timestamps, peak luminance excursions, and red saturation readings.

---

### 3. Image Sequences & Slide Transitions (`image-sequences.html`)
Use this module to audit banners, product carousels, hero sliders, or animated sequences:
1. Load multiple static PNG, JPEG, or WebP images (via file upload or image URLs).
2. Choose your evaluation mode:
   - **Ordered Pairs ($A \rightarrow B \rightarrow A$)**: Evaluates every directed transition between all loaded images.
   - **Directed Triples ($A \rightarrow B \rightarrow C \rightarrow A$)**: Evaluates complex cycle dynamics.
   - **Seeded Shuffle / Trajectories**: Runs reproducible multi-image sequences using a deterministic PRNG seed.
3. Configure fit mode (`contain`, `cover`, `stretch`, `center`) and transition rates (1–60 Hz).
4. Export sequence plans as JSON or run instant automated screening.

---

### 4. Reference Calibration Fixtures (`fixtures.html`)
Use this module to verify that your screening environment and detector algorithms are functioning correctly:
- Contains **13 reference test patterns** with mathematically known outcomes:
  - `full-5`, `full-10`, `full-15`: High-frequency flashing controls (Expected: Candidate Detected).
  - `two-hz`, `three-hz`: Boundary safe frequencies (Expected: Inconclusive / Safe under 3 Hz limit).
  - `red-black`, `red-blue`: Saturated red strobe controls.
  - `small-zone`: Sub-threshold area control ($4,096\text{ CSS px}^2 < 21,824\text{ CSS px}^2$).
  - `area-trap`: Supra-threshold area control ($87,296\text{ CSS px}^2 > 21,824\text{ CSS px}^2$).
  - `static-control`: Baseline motionless control (0 flashes).

---

## The 5 Presentation Scenarios: Why Scale Matters

WCAG SC 2.3.1 evaluates flash area against the user's field of view. An animation element that occupies $2\%$ of a smaller window might be **safe**, but when expanded to a large monitor or fullscreen mode, that same element can exceed the $21,824\text{ CSS px}^2$ limit and become **hazardous**.

Always record audits across the **5 Presentation Scenarios**:

| Scenario | Target Dimensions | Purpose & Scale Risk |
| :--- | :---: | :--- |
| **1. Restored / Default** | $\approx 1024 \times 768\text{ CSS px}$ | Baseline desktop browsing window. Standard 10° visual field reference. |
| **2. Maximized Browser** | $\approx 1920 \times 1040\text{ CSS px}$ | Typical desktop usage. Responsive layouts expand banners to full screen width. |
| **3. Browser Fullscreen (F11)** | $\approx 1920 \times 1080\text{ CSS px}$ | Removes browser chrome, toolbars, and taskbars. Highest risk of scale expansion. |
| **4. Content / Player Fullscreen** | Native Display Res | Native `<video>` or canvas fullscreen. Content scales to fill entire physical display. |
| **5. Responsive Narrow Breakpoint** | $\approx 375 \times 667\text{ CSS px}$ | Mobile/tablet breakpoint. Tests whether layout reflows introduce high-density strobing. |

---

## How to Read & Interpret Audit Results

| Status Badge | What it Means in Plain English | Auditor Action |
| :--- | :--- | :--- |
| <kbd>**Candidates Detected**</kbd> | At least one rolling 1-second window contained **4 or more qualifying flash pairs** that exceeded safe area or saturated red thresholds. | **Potential Failure**: Inspect the timestamp and probe location. Verify if content can be slowed down, dimmed, or removed. |
| <kbd>**Inconclusive - No Candidates**</kbd> | No qualifying flash spikes were observed in the sampled data. | **Safe for the Sampled Interval**: Conformance is inconclusive for unobserved interactions or unexercised states. |
| <kbd>**Insufficient Observation**</kbd> | Recording was stopped too early ($< 1.0\text{ s}$) or frame delivery experienced severe drops ($> 1.0\text{ s}$ gap). | **Retest Required**: Ensure hardware acceleration is enabled and re-run capture for at least 3 seconds. |
| <kbd>**Rejected Calibration**</kbd> | The reviewer-supplied CSS dimensions do not match the aspect ratio of the captured surface. | **Fix Calibration**: Re-measure the target element using browser DevTools (`getBoundingClientRect()`) and re-enter dimensions. |

> [!NOTE]
> **No Automated Conformance Pass**: In accordance with regulatory guidelines, this tool reports observed mathematical excursions and flags potential candidates. It **never issues a legal WCAG conformance pass/fail certificate**. Automated tools cannot replace human specialist judgment.

---

## Audit Evidence & Export Formats

Every screening run generates five verifiable export artifacts sharing a common UUID:

1. **Self-Contained HTML Report (`.html`)**: Complete visual dossier embedding luminance traces, dark/bright probe screenshot pairs, detection-witness markers, and calibration metadata.
2. **Machine-Readable JSON (`.json`)**: Full structured telemetry record including per-frame timestamps, RGB values, linear relative luminance, and sliding-window candidate states.
3. **Selected-Probe CSV (`.csv`)**: High-resolution per-frame numeric log at the auditor's selected coordinate probe.
4. **Detection-Witness CSV (`.csv`)**: Exact coordinate and numeric log of the worst-case pixel that triggered a candidate detection.
5. **Executive Summary (`.txt`)**: Plain-text brief suitable for ticketing systems (Jira, GitHub Issues) or VPAT audit appendices.

---

## The WCAG Genius & Lead Architect Technical Reference

For accessibility engineers, algorithm reviewers, and WCAG technical committee auditors, this section documents the exact mathematical foundations implemented by Flash Review.

### Linearized Relative Luminance Formulations
Per WCAG 2.2 and IEC 61966-2-1 (sRGB), non-linear 8-bit channel values $V_{8} \in [0, 255]$ are normalized to $v = V_{8} / 255$ and linearized to $C_{\text{linear}}$:

$$
C_{\text{linear}} = \begin{cases} 
\frac{v}{12.92} & \text{if } v \le 0.04045 \\
\left(\frac{v + 0.055}{1.055}\right)^{2.4} & \text{if } v > 0.04045 
\end{cases}
$$

Relative luminance ($Y$) is computed from linear channels:
$$Y = 0.2126\,R_{\text{linear}} + 0.7152\,G_{\text{linear}} + 0.0722\,B_{\text{linear}}$$

### General Flash Thresholds
A transition between state 1 and state 2 is a qualifying General Transition if and only if:
1. $|Y_2 - Y_1| \ge 0.10$ (relative luminance change of at least 10%), **AND**
2. $\min(Y_1, Y_2) < 0.80$ (at least one transition endpoint is below 0.80 relative luminance).

### Saturated Red & CIE 1976 Chromaticity Space
A transition involves a qualifying Saturated Red flash if both:
1. **Red Saturation**: $R_{\text{linear}} / (R_{\text{linear}} + G_{\text{linear}} + B_{\text{linear}}) \ge 0.80$ in **linear color space**.
2. **CIE 1976 Chromaticity Excursion**: $\Delta(u', v') \ge 0.20$, where $(u', v')$ are computed from CIE 1931 XYZ:

$$
u' = \frac{4X}{X + 15Y + 3Z}, \quad v' = \frac{9Y}{X + 15Y + 3Z}
$$

*Singularity Guard*: Pure black $(R=0, G=0, B=0)$ results in $X + 15Y + 3Z = 0$. The engine explicitly guards against division by zero by marking black chromaticity as invalid and evaluating pure red-to-black strobes through the General Flash luminance path ($\Delta Y = 0.2126 \ge 0.10$).

### Dual-Phase Pairing Engine
Historical detectors evaluated transitions sequentially in a single pairing phase ($T_0 \rightarrow T_1$, $T_2 \rightarrow T_3$). If an unrelated animation produced an odd transition at startup, that single unpaired transition could shift the grouping phase and conceal an entire subsequent 4 Hz strobe burst.

Flash Review implements a **Dual-Phase Pairing Engine**:
- **Phase 0**: Groups transitions into pairs $(T_{2k}, T_{2k+1})$.
- **Phase 1**: Groups transitions into pairs $(T_{2k+1}, T_{2k+2})$.
Both phases run concurrently. If *either* phase records 4 completed pairs within a rolling 1.0-second window, a candidate is flagged. Phase counts are strictly never summed together.

### Microsecond-Precision Sliding Window Purge
To prevent false-positive suppression at exact boundary timestamps ($1.000000\text{ s}$), the pair purge condition enforces strict microsecond temporal boundaries:
$$\text{Purge Pair } i \iff t_{\text{current}} - t_{i} > 1.000\text{ s} + 1\times 10^{-6}\text{ s}$$
Any pair completed within the rolling 1-second interval $[t - 1.0, t]$ is preserved.

### 10° Visual Field Reference Geometry
Under WCAG 2.2, a 10° visual field represents central vision at a typical viewing distance of $2.5 \times \text{screen height}$:
- Canonical viewing surface: $1024 \times 768\text{ CSS px}$.
- 10° visual field: $341 \times 256\text{ CSS px}$ ($A_{\text{field}} = 87,296\text{ CSS px}^2$, equivalent to $0.024\text{ steradians}$).
- Safe Area Limit: $25\%$ of the 10° field ($0.006\text{ steradians} = \mathbf{21,824\text{ CSS px}^2}$).

### Temporal Area Overlap vs. Spatial Envelopes
- **Concurrent Active Area ($A_{\text{concurrent}}(t)$)**: The true physical measure of concurrent flashing is the instantaneous sum of all pixels whose transition excursion intervals overlap at time $t$:
  $$A_{\text{concurrent}}(t) = \sum_{(x, y) : t_{\text{start}}(x, y) \le t \le t_{\text{end}}(x, y)} (\Delta x \cdot \Delta y)$$
- **Rolling Spatial Envelope**: A conservative historical union of all locations that flashed over the preceding second. Demonstrates why a moving small box ($1,600\text{ CSS px}^2$) traversing a screen does not constitute concurrent flashing, even though its rolling envelope expands.

### Spatial Fine-Pattern & Stippling Exemptions
Fine checkerboard textures, twinkling stars, and dispersed particle snow where individual alternating elements subtend less than $2\text{ arc-minutes}$ ($< 1.1\text{ CSS px}$) are physiologically integrated by the human retina without triggering paroxysmal neural discharges. The detector accounts for dispersed stipples and avoids false-positive whole-screen area penalties.

---

## Running the Automated Test Suite

Flash Review maintains **18 automated test suites** covering core algorithms, DOM contracts, video scanning, red-team fuzzing, and size matrices.

Run all 18 suites in a single command with summary reporting:

```bash
node test-all.mjs
```

### Complete Test Suite Inventory

```text
[01/18] Core Analyzer Checks (test.mjs)
[02/18] Core UI Contracts & Warnings (test-ui.mjs)
[03/18] Historical Regressions (NF-01..03) (test-regressions.mjs)
[04/18] Synthetic Fixtures & Luminance (test-fixtures.mjs)
[05/18] Fixture UI Contracts & Warnings (test-fixtures-ui.mjs)
[06/18] Area Geometry & Reference Limits (test-area.mjs)
[07/18] Image Sequences & Fit Modes (test-image-sequence.mjs)
[08/18] Image Sequence UI & Trajectories (test-image-ui.mjs)
[09/18] Video Scanning & Magic Signatures (test-video.mjs)
[10/18] Video UI Contracts & Lifecycle (test-video-ui.mjs)
[11/18] Audit Repairs & Dual-Phase Logic (test-audit-repairs.mjs)
[12/18] Passing Controls & Non-Flashing Baselines (test-passing-suite.mjs)
[13/18] WCAG 2.2 AAA Criteria (SC 2.3.2 / 2.3.3) (test-criteria.mjs)
[14/18] Detector Boundaries & Red Chromaticity (test-detector-boundaries.mjs)
[15/18] Red-Team Adversarial Fuzzing Audit (test-redteam-audit.mjs)
[16/18] Temporal Area Overlap & Moving Flashes (test-temporal-area.mjs)
[17/18] Presentation Matrix: 20 Automated Runs (test-presentation-matrix.mjs)
[18/18] Reference Geometry & Largest Scale (test-reference-geometry.mjs)
```

---

## Architecture & Security

### Privacy & Security Guarantees
- **Zero Remote Network Calls**: No telemetry, no Google Analytics, no CDN scripts, no tracking beacons.
- **Zero Local Storage Leaks**: Captured video frames and image bitmaps are processed in memory and released via explicit cleanup hooks (`URL.revokeObjectURL`, `video.src = ''`, `pagehide` listeners).
- **Safe Sandboxing**: No native binaries or elevated OS permissions required. Operates strictly within standard web browser security boundaries.

### Project Layout
```text
flash-tester/
├── dist/                          # Production Web Application (Pure ESM)
│   ├── index.html                 # Tab capture & real-time screening UI
│   ├── video.html                 # Direct video file scanner UI
│   ├── image-sequences.html       # Multi-image trajectory & slide UI
│   ├── fixtures.html              # Reference fixture test harness
│   ├── analyzer.mjs               # Core WCAG mathematical detection engine
│   ├── area.mjs                   # Spatial area meter & 10° field scanner
│   ├── video-scanner.mjs          # Video container parser & worker decoder
│   ├── image-sequence.mjs         # Image sequence scheduling & fit modes
│   ├── evidence.mjs               # Export engine (HTML, JSON, CSV, TXT)
│   └── report.mjs                 # Report formatting & escaping utilities
├── docs/                          # Specialized Technical Reference & Guides
│   ├── UNDERSTANDING_LIMITATIONS.md # Plain-English physics & regulatory guide
│   ├── INPUTS_AND_SIZE_TESTING.md # Guide to multi-image & size matrix testing
│   ├── PRESENTATION_MATRIX.md     # Matrix test results across 5 scenarios
│   └── NATIVE_VERIFICATION.md     # Runbook for native Chrome screen sharing
├── fixtures/                      # Deterministic JSON fixtures & image manifests
├── test-all.mjs                   # Unified 18-suite test runner
├── test-*.mjs                     # Dedicated subsystem test suites
└── README.md                      # This comprehensive documentation
```

---

## Regulatory & Conformance Honesty

1. **Screening Prototype**: This software is an engineering tool designed to assist accessibility professionals in identifying potential flashing hazards. It is **not** an automated certification authority.
2. **Never Claim Automatic Compliance**: A clean screening report (`inconclusive-no-candidates`) indicates that no qualifying transitions were detected in the sampled frames; it does **not** certify that a website or video conforms to WCAG 2.2 or Section 508.
3. **Physical Hardware Factors**: Display refresh rates (60 Hz vs. 144 Hz), variable refresh rate (G-Sync/FreeSync), panel response times (OLED vs. IPS LCD), PWM backlight flicker, and ambient room lighting affect physical photon delivery to the human retina. Digital software capture evaluates pixel RGB data, not physical panel photons.
4. **Independent Verification**: Any flagged candidate should be manually reviewed by a certified accessibility specialist (CPACC, WAS, or equivalent) and verified using calibrated broadcast hardware analysis tools where required.

---

### License
MIT License. Free and open source for accessibility auditors, researchers, engineers, and digital inclusion advocates worldwide.
