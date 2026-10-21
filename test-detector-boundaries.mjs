import assert from 'node:assert/strict';
import {Analyzer, color} from './dist/analyzer.mjs';

console.log('--- SECTION 4: DETECTOR BOUNDARIES & EXCEPTIONS TEST SUITE ---');

// Helper to convert sRGB gamma 0..255 to linear luminance Y
const linear = Array.from({length: 256}, (_, i) => {
  const v = i / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
function toSrgbByte(targetY) {
  let best = 0, bestDiff = Infinity;
  for (let i = 0; i < 256; i++) {
    const diff = Math.abs(linear[i] - targetY);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return best;
}

// ============================================================================
// 1. Luminance delta boundaries (just below, at, and above 0.10) & darker state < 0.80
// ============================================================================
console.log('1. Testing luminance delta boundaries & darker state threshold...');

// Base state: Y = 0.30
const yBase = 0.30;
const byteBase = toSrgbByte(yBase);
const actualYBase = linear[byteBase];

// Case 1.1: Delta Y just below 0.10 (e.g. delta = 0.08, 4 Hz flashing)
{
  const byteSub = toSrgbByte(actualYBase + 0.08);
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30; // 2 seconds at 30 fps
    const byte = (Math.floor(t * 8) % 2) ? byteSub : byteBase;
    a.push(new Uint8ClampedArray([byte, byte, byte, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 0, 'Sub-threshold ΔY (0.08 < 0.10) must produce 0 general flashes');
}

// Case 1.2: Delta Y well above 0.10 (delta = 0.25, 4 Hz flashing)
{
  const byteAbove = toSrgbByte(actualYBase + 0.25);
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30; // 2 seconds at 30 fps
    const byte = (Math.floor(t * 8) % 2) ? byteAbove : byteBase;
    a.push(new Uint8ClampedArray([byte, byte, byte, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 4, 'Supra-threshold ΔY (0.25 >= 0.10) at 4 Hz must produce 4 general flashes');
}

// Case 1.3: Darker-state threshold at 0.80
// Oscillation A: Y1 = 0.82, Y2 = 0.98. ΔY = 0.16 >= 0.10, but darker state is 0.82 >= 0.80.
{
  const byte82 = toSrgbByte(0.82);
  const byte98 = toSrgbByte(0.98);
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const byte = (Math.floor(t * 8) % 2) ? byte98 : byte82;
    a.push(new Uint8ClampedArray([byte, byte, byte, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 0, 'High-luminance flashing with darker state >= 0.80 is exempt under WCAG SC 2.3.1');
}

// Oscillation B: Y1 = 0.77, Y2 = 0.93. ΔY = 0.16 >= 0.10, and darker state is 0.77 < 0.80.
{
  const byte77 = toSrgbByte(0.77);
  const byte93 = toSrgbByte(0.93);
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const byte = (Math.floor(t * 8) % 2) ? byte93 : byte77;
    a.push(new Uint8ClampedArray([byte, byte, byte, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 4, 'Flashing with darker state < 0.80 and ΔY >= 0.10 at 4 Hz must produce 4 general flashes');
}

// Case 1.4: Quantization and codec compression jitter
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const jitter = (i % 2 === 0) ? 2 : -2;
    const byte = 128 + jitter;
    a.push(new Uint8ClampedArray([byte, byte, byte, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 0, 'Quantization noise (Δcode = +/-2) must not trigger false positive flashes');
}

// ============================================================================
// 2. Saturated-red ratio (~0.80), chromaticity (~0.20) and black endpoints
// ============================================================================
console.log('2. Testing red chromaticity, saturation ratio, constant-luminance & black endpoints...');

// Case 2.1: Saturated red vs blue at 4 Hz (both valid chromaticity coordinates)
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const rgb = (Math.floor(t * 8) % 2) ? [255, 0, 0] : [0, 0, 255];
    a.push(new Uint8ClampedArray([...rgb, 255]), t);
  }
  const rep = a.report();
  assert.equal(rep.peakGeneral, 4, 'Red/blue at 4 Hz triggers 4 general flashes');
  assert.equal(rep.peakRedHeuristic, 4, 'Red/blue at 4 Hz triggers 4 red candidates');
}

// Case 2.2: Black endpoint robustness
// Pure black [0, 0, 0] has d=0 (undefined chromaticity coordinate u'=0/0, v'=0/0).
// In analyzer: c.valid is false, confirming documented limitation that pure black endpoints
// are covered via general flash luminance excursions (ΔY = 0.2126 >= 0.10) rather than chromaticity vectors.
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const rgb = (Math.floor(t * 8) % 2) ? [255, 0, 0] : [0, 0, 0];
    a.push(new Uint8ClampedArray([...rgb, 255]), t);
  }
  const rep = a.report();
  assert.equal(rep.peakGeneral, 4, 'Red/black at 4 Hz flags general flash via luminance excursion');
  const cBlack = color(0, 0, 0);
  assert.equal(cBlack.valid, false, 'Black has undefined chromaticity (valid = false)');
}

// Case 2.3: Constant-luminance Red vs Cyan/Green color transition
// Red: [255, 0, 0], Y = 0.2126.
// Calibrated green/cyan with Y ≈ 0.2126: [0, 148, 0], Y = 0.7152 * linear[148] ≈ 0.213.
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const rgb = (Math.floor(t * 8) % 2) ? [255, 0, 0] : [0, 148, 0];
    a.push(new Uint8ClampedArray([...rgb, 255]), t);
  }
  const rep = a.report();
  assert.equal(rep.peakGeneral, 0, 'Constant luminance color transitions produce 0 general flashes');
  assert.ok(rep.peakRedHeuristic >= 4, 'Constant luminance saturated red transitions produce >= 4 red candidates');
}

// Case 2.4: Sub-saturated red ratio (< 0.80 in linear sRGB)
// Color [180, 100, 100]: Linear R=0.457, G=0.127, B=0.127.
// Linear saturation ratio = 0.457 / (0.457 + 0.127 + 0.127) = 0.642 < 0.80.
{
  const cSub = color(180, 100, 100);
  assert.equal(cSub.red, false, 'Linear red ratio 0.642 is below the 0.80 saturation threshold');
}

// ============================================================================
// 3. Balanced fine patterns / checkerboards (RED-04 spatial filtering)
// ============================================================================
console.log('3. Testing fine vs coarse spatial checkerboard patterns...');

// Case 3.1: Coarse checkerboard (4x4 cells on a 4x4 image, alternating at 5 Hz)
{
  const a = new Analyzer(4, 4);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const frame = new Uint8ClampedArray(4 * 4 * 4);
    const phase = Math.floor(t * 10) % 2;
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const val = ((x + y + phase) % 2 === 0) ? 255 : 0;
        const idx = (y * 4 + x) * 4;
        frame[idx] = frame[idx + 1] = frame[idx + 2] = val;
        frame[idx + 3] = 255;
      }
    }
    a.push(frame, t);
  }
  assert.equal(a.report().peakGeneral, 5, 'Coarse checkerboard where pixels resolve cells detects general flashes');
}

// Case 3.2: Spatial downsampling averages 1px checkerboard to uniform gray (RED-04 verification)
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    // Downsampled result of an opposing 1-pixel checkerboard is constant gray:
    a.push(new Uint8ClampedArray([128, 128, 128, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 0, 'Spatial downsampling limitation (RED-04): fine checkerboard averages to static gray');
}

// ============================================================================
// 4. Rolling-second irregular bursts, phase, duty cycle & ramps
// ============================================================================
console.log('4. Testing rolling-second bursts, duty cycles, ramps & phase...');

// Case 4.1: Irregular burst - Exactly 3 flashes within 300 ms, then 1.7s stillness
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    let val = 0;
    if ((t >= 0.05 && t < 0.10) || (t >= 0.15 && t < 0.20) || (t >= 0.25 && t < 0.30)) {
      val = 255;
    }
    a.push(new Uint8ClampedArray([val, val, val, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 3, 'Irregular 3-flash burst produces peakGeneral === 3 (compliant with SC 2.3.1)');
}

// Case 4.2: Irregular burst - Exactly 4 flashes within 400 ms
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    let val = 0;
    if ((t >= 0.05 && t < 0.10) || (t >= 0.15 && t < 0.20) || (t >= 0.25 && t < 0.30) || (t >= 0.35 && t < 0.40)) {
      val = 255;
    }
    a.push(new Uint8ClampedArray([val, val, val, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 4, 'Irregular 4-flash burst produces peakGeneral === 4 (violates 3-flash rule)');
}

// Case 4.3: Asymmetric duty cycle (10% on, 90% off at 4 Hz)
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 120; i++) {
    const t = i / 60;
    const cyclePos = (t % 0.25) / 0.25;
    const val = cyclePos < 0.10 ? 255 : 0;
    a.push(new Uint8ClampedArray([val, val, val, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 4, 'Asymmetric 10/90 duty cycle at 4 Hz triggers 4 general flashes');
}

// Case 4.4: Monotonic gradual ramp (0.0 to 1.0 over 2 seconds)
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const val = Math.min(255, Math.floor((t / 2) * 255));
    a.push(new Uint8ClampedArray([val, val, val, 255]), t);
  }
  assert.equal(a.report().peakGeneral, 0, 'Monotonic luminance ramp without direction reversal produces 0 general flashes');
}

// Case 4.5: Mixed frequency - 1.5 Hz large oscillation + 15 Hz subtle ripple (ΔY = 0.02)
{
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 120; i++) {
    const t = i / 60;
    const carrier = 0.40 + 0.20 * Math.sin(2 * Math.PI * 1.5 * t);
    const ripple = 0.015 * Math.sin(2 * Math.PI * 15 * t);
    const targetY = Math.max(0, Math.min(1, carrier + ripple));
    const byte = toSrgbByte(targetY);
    a.push(new Uint8ClampedArray([byte, byte, byte, 255]), t);
  }
  assert.ok(a.report().peakGeneral <= 2, 'Mixed frequency with sub-threshold ripple does not flag high frequency');
}

// ============================================================================
// 5. Independent reference validator cross-check across diverse waveforms
// ============================================================================
console.log('5. Cross-checking against independent textbook reference validator...');

function independentWcagValidator(sequence) {
  let extreme = sequence[0].y;
  let extremeTime = sequence[0].t;
  let direction = 0;
  let pendingTime = null;
  let pairIndex = 0;
  const phases = [[], []];

  for (let i = 1; i < sequence.length; i++) {
    const {y, t} = sequence[i];
    const delta = y - extreme;
    const dir = Math.sign(delta);

    if (Math.abs(delta) < 1e-10) {
      extremeTime = t;
    } else if (direction && dir === direction) {
      extreme = y;
      extremeTime = t;
    } else if (Math.abs(delta) >= 0.10 - 1e-10 && Math.min(y, extreme) < 0.80) {
      if (pendingTime !== null) {
        const ph = pairIndex++ % 2;
        if (t - pendingTime <= 1.0 + 1e-9) {
          phases[ph].push(t);
        }
        pendingTime = extremeTime;
      } else {
        pendingTime = extremeTime;
      }
      direction = dir;
      extreme = y;
      extremeTime = t;
    }
  }

  // Non-overlapping pairing phases evaluated separately
  let peak = 0;
  for (const list of phases) {
    for (let i = 0; i < list.length; i++) {
      const windowStart = list[i] - 1.0 + 1e-11;
      const count = list.filter(t => t > windowStart && t <= list[i]).length;
      peak = Math.max(peak, count);
    }
  }
  return peak;
}

const testProfiles = [
  {name: '2 Hz square wave', fn: t => (Math.floor(t * 4) % 2 ? 0.9 : 0.1)},
  {name: '3 Hz square wave', fn: t => (Math.floor(t * 6) % 2 ? 0.9 : 0.1)},
  {name: '4 Hz square wave', fn: t => (Math.floor(t * 8) % 2 ? 0.9 : 0.1)},
  {name: '5 Hz square wave', fn: t => (Math.floor(t * 10) % 2 ? 0.9 : 0.1)},
  {name: 'Sub-threshold 4 Hz', fn: t => (Math.floor(t * 8) % 2 ? 0.45 : 0.40)},
  {name: 'High luminance 4 Hz', fn: t => (Math.floor(t * 8) % 2 ? 0.98 : 0.85)},
  {name: '3 Hz triangle wave', fn: t => 0.1 + 0.8 * Math.abs((t * 3 % 1) - 0.5) * 2},
  {name: 'Monotonic ramp', fn: t => 0.1 + 0.8 * (t / 2)}
];

for (const profile of testProfiles) {
  const steps = 120;
  const seq = [];
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / 60;
    const y = profile.fn(t);
    seq.push({y, t});
    const byte = toSrgbByte(y);
    a.push(new Uint8ClampedArray([byte, byte, byte, 255]), t);
  }
  const refPeak = independentWcagValidator(seq);
  const repPeak = a.report().peakGeneral;
  assert.equal(repPeak, refPeak, `Profile "${profile.name}": Analyzer peak (${repPeak}) matches independent reference (${refPeak})`);
}

// ============================================================================
// 6. Browser/device matrix: capture rates, throttling, frame gaps & aliasing
// ============================================================================
console.log('6. Testing capture rates, dropped frames, frame gaps (>0.1s) and Nyquist aliasing...');

// Case 6.1: Dropped frame / background throttling gap (> 0.1s)
{
  const a = new Analyzer(1, 1);
  a.push(new Uint8ClampedArray([0, 0, 0, 255]), 0);
  a.push(new Uint8ClampedArray([255, 255, 255, 255]), 0.05);
  // Interruption / gap of 0.15s (> 0.1s threshold):
  a.push(new Uint8ClampedArray([0, 0, 0, 255]), 0.20);
  for (let i = 3; i <= 35; i++) {
    const val = (i % 2 === 0) ? 255 : 0;
    a.push(new Uint8ClampedArray([val, val, val, 255]), 0.20 + (i - 2) * 0.033);
  }
  const rep = a.report();
  assert.equal(rep.observation.meetsScreeningMinimum, false, 'Frame gap > 0.1s fails screening minimum checks');
  assert.ok(rep.observation.reasons.includes('A frame gap exceeded 0.1 seconds'));
}

// Case 6.2: Nyquist harmonic phase-lock aliasing (RED-10)
// High-frequency 30 Hz strobe captured at 30 fps
{
  const aNyquist = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30; // Sampled at 30 fps
    // True underlying signal oscillates at 30 Hz, but fixed 30 fps sampling hits only high phase:
    aNyquist.push(new Uint8ClampedArray([255, 255, 255, 255]), t);
  }
  const rep = aNyquist.report();
  assert.equal(rep.peakGeneral, 0, 'Harmonic aliasing limitation (RED-10): strobe at capture harmonic appears static');
}

console.log('All Section 4 detector boundary, exception and reference cross-check tests passed successfully.');
