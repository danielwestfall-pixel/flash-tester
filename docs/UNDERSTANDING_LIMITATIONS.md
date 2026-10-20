# Understanding Automated Flash Detection Limitations
*A plain-English guide to physical, mathematical, and regulatory boundaries in photosensitivity screening.*

---

## Executive Overview

No automated software tool running in a web browser can replace qualified human accessibility auditing or issue a legally binding WCAG 2.2 conformance certificate. 

While Flash Review detects dangerous brightness transitions, color shifts, and saturated red strobes, digital screen capture and mathematical modeling operate within strict physical laws, display hardware realities, and standards definitions. This guide explains why these boundaries exist using intuitive real-world analogies.

---

## 1. The Wagon-Wheel Effect: Camera Frame Rates & Harmonic Blindspots (RED-10)

### Real-World Analogy
Have you ever watched a video of a helicopter taking off where the rotor blades appeared completely stationary or spinning slowly backwards? Or a car commercial where the hubcaps look frozen in mid-air? 

That illusion (the stroboscopic or "wagon-wheel" effect) occurs because the camera takes a snapshot at the exact moment the blade or wheel completes a revolution.

```
Real Strobe (30 Hz):  [White] [Black] [White] [Black] [White] [Black]
Capture Frames (30 fps):  ^               ^               ^
Recorded Footage:     [White] ---------> [White] ---------> [White] (Looks Static!)
```

### Why Software Cannot "Code Around" This
Under the **Nyquist-Shannon sampling theorem**, to accurately detect and measure a flashing frequency $f$, a camera or screen capture pipeline must sample at a rate strictly greater than $2f$.

If an animation or video flashes at an exact integer fraction of the screen capture frame rate (for example, a 30 Hz strobe captured at 30 frames per second or 60 frames per second with fixed phase lock):
* Every captured frame happens to record the screen during its bright phase.
* The dark phase occurs entirely in the microsecond interval *between* frames.
* To the computer, the recorded video looks like a steady, calm, motionless white screen.

### Practical Mitigation & Audit Guidance
* **Variable framerate observation**: Never test only once at a single framerate.
* **Human visual inspection**: Human eyes have continuous analog photoreceptor integration and do not suffer from digital discrete frame-lock. If content looks like a strobe to the human eye, it is a hazard regardless of what a discrete capture graph reports.

---

## 2. The Starry Night Sky: Distributed Stipples vs. The 10° Visual Field (RED-05)

### Real-World Analogy
Imagine looking up at a dark night sky filled with hundreds of twinkling stars. If every star twinkles at the same time, the whole sky is changing, but no single tiny patch of sky contains a bright, blinding explosion of light.

Now imagine looking at a lighthouse beacon flashing directly in front of you. Even though the total amount of light might be comparable, the concentrated lighthouse beam overwhelms your central vision and can trigger photosensitive seizures.

### Why the WCAG Standard Works This Way
WCAG 2.2 Success Criterion 2.3.1 ("Three Flashes or Below Threshold") does not prohibit all flashing on a screen. It specifically restricts flashes that occupy more than a small safe area:
> *"The combined area of flashes occurring concurrently occupies no more than a total of .006 steradians within any 10 degree visual field on the screen."*

* A **10-degree visual field** represents your central gaze (roughly the width of your fist or four fingers held at arm's length from the monitor, or approximately $341 \times 256$ CSS pixels at standard desktop viewing distance).
* The **area limit** is 21,824 CSS pixels squared.
* If a webpage has fine sparkling snow, twinkling stars, or widely dispersed stipples where only 100 pixels flash inside any given 10° circle, **it is mathematically compliant under WCAG SC 2.3.1**.

### Practical Mitigation & Audit Guidance
* Our calibrated area meter uses a sliding window across the entire viewport to find the worst-case 10° field.
* Note that individuals with severe photosensitivity or sensory processing conditions may still experience discomfort or visual fatigue from whole-screen diffuse patterns even if they fall below the WCAG 10° threshold.

---

## 3. The Sunlight vs. Lightbulb Effect: HDR & Wide Color Gamuts (RED-03)

### Real-World Analogy
Looking at a standard computer screen is like looking at an indoor lightbulb (typically emitting 100 to 200 nits of light). Looking at an HDR (High Dynamic Range) OLED screen displaying sunlight or an explosion is like looking at actual bright sunlight (blasting up to 1,500+ nits into the room).

### Why Web Browsers Cannot Measure Real HDR Lumens
1. **WCAG 2.2 Definitions**: The official WCAG specification was written around standard sRGB monitors. It calculates relative luminance ($Y$) on a dimensionless mathematical scale from $0.0$ (black) to $1.0$ (white):
   $$Y = 0.2126 R + 0.7152 G + 0.0722 B$$
   WCAG does not define physical candelas per square meter (nits) or formulas for wide-gamut color spaces like Display P3 or Rec.2020.
2. **Browser Video Capture Limits**: Standard browser tab capture (`getDisplayMedia`) delivers an 8-bit standard dynamic range (SDR) video feed. 
   * A 200-nit SDR white pixel is sent as RGB `(255, 255, 255)`.
   * A 1,500-nit HDR highlight pixel is *also* sent as RGB `(255, 255, 255)` because the browser tone-maps and clamps HDR signals down to standard SDR.
3. The software has no physical light sensor pointed at the monitor. It cannot tell whether the display is a dim laptop screen at night or a massive HDR gaming monitor running at maximum brightness.

### Practical Mitigation & Audit Guidance
* All relative luminance ($Y$) numbers in Flash Review represent sRGB code values, not physical display wattage.
* Content that meets the 10% $\Delta Y$ contrast threshold on an SDR monitor can produce vastly more intense real-world optical energy on an HDR display. Always evaluate HDR video with hardware photometer probes when high peak lumens are present.

---

## 4. Counter-Phase Checkerboards & Downsampling (RED-04 — Mitigated in v0.4.3 / 0.4.2)

### The Problem
When a full 1080p ($1920 \times 1080$) screen is downsampled to $320 \times 180$ to allow real-time analysis without freezing the computer, each downsampled cell averages a $6 \times 6$ block of native pixels.

If content displays a fine 1-pixel checkerboard (alternating black and white pixels) that inverts phase 10 times a second:
* Frame 1: The $6 \times 6$ block has 18 black pixels and 18 white pixels $\to$ standard smoothed downsampling averages them to **gray (128)**.
* Frame 2: The checkerboard flips $\to$ the block still averages to **gray (128)**.
* The difference between frames is $\Delta Y = 0$! Standard smoothed downsampling acts as a low-pass filter, making violent full-screen pattern flicker appear completely static.

### The Code Fix in Flash Review
In v0.4.3 (algorithm 0.4.2), Flash Review **disables bilinear image smoothing** (`imageSmoothingEnabled = false`) on the downsampling pipeline. Point sampling samples exact native pixels without blurring them with their neighbors:
* Point sampling records black ($0$) on frame 1, and white ($255$) on frame 2.
* $\Delta Y$ jumps to $1.00$, and the 10 Hz strobe is flagged as an active candidate.

---

## Summary Reference Table

| Phenomenon | Why It Cannot Be Coded Away | How Auditors Should Address It |
| :--- | :--- | :--- |
| **Harmonic Aliasing (RED-10)** | Physical law: Nyquist sampling limit of discrete frame capture | Manually inspect animations; verify at multiple framerates |
| **Diffuse Stipples (RED-05)** | Regulatory definition: WCAG restricts area only within a 10° circle | Confirm no single 10° aperture exceeds limit; consider user comfort |
| **HDR Peak Lumens (RED-03)** | Hardware physics: Web capture tone-maps HDR highlights into 8-bit sRGB | Use hardware luminance meters (photometers) for HDR content |
| **Checkerboards (RED-04)** | **Mitigated**: Point sampling prevents bilinear blurring into gray | Verified in automated unit tests (`peakGeneral > 3`) |
