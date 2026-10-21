import assert from 'node:assert/strict';
import {AreaMeter, FIELD} from './dist/area.mjs';
import {Analyzer, color} from './dist/analyzer.mjs';

console.log('================================================================');
console.log('SECTION 1: TEMPORAL OVERLAP & MOVING FLASH REFERENCE VALIDATION');
console.log('Reference: WCAG 2.2 SC 2.3.1 (Item 32) · Temporal Area Semantics');
console.log('================================================================\n');

/**
 * Independent Reference Temporal-Overlap Flash Area Validator
 * 
 * Formal Definition:
 * Each pixel (x, y) that undergoes a flash transition enters an active
 * excursion interval I(x, y) = [t_start, t_end].
 * 
 * At any instant t, the concurrent active flashing area is the sum of areas
 * of all pixels whose active excursion intervals enclose t:
 *   A_concurrent(t) = Sum_{ (x,y) : t_start(x,y) <= t <= t_end(x,y) } (dx * dy)
 * 
 * Within a 341 x 256 CSS pixel reference viewing field, the maximum
 * concurrent flashing area across any position (bx, by) is:
 *   Peak A_concurrent = max_t max_{bx, by} A_concurrent(bx, by, t)
 */
export class TemporalAreaValidator {
  constructor(width, height, calibration) {
    this.width = width;
    this.height = height;
    this.calibration = calibration;
    this.dx = calibration.cssWidth / width;
    this.dy = calibration.cssHeight / height;
    this.fw = Math.min(width, Math.ceil(FIELD.width / this.dx) + (Number.isInteger(FIELD.width / this.dx) ? 0 : 1));
    this.fh = Math.min(height, Math.ceil(FIELD.height / this.dy) + (Number.isInteger(FIELD.height / this.dy) ? 0 : 1));
    
    // Pixel excursion records: array of {start, end, x, y}
    this.intervals = [];
    this.history = []; // {t, mask}
  }

  recordPixelExcursion(x, y, start, end) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
      throw Error('Pixel out of bounds');
    }
    this.intervals.push({x, y, start, end});
  }

  /**
   * Evaluates concurrent active flash area at an exact continuous time t.
   */
  activeMaskAt(t) {
    const mask = new Uint8Array(this.width * this.height);
    for (const interval of this.intervals) {
      if (t >= interval.start && t <= interval.end) {
        mask[interval.y * this.width + interval.x] = 1;
      }
    }
    return mask;
  }

  /**
   * Scans a mask within the 341x256 CSS px reference field.
   */
  measureFieldMax(mask) {
    const w = this.width, h = this.height;
    const stride = w + 1;
    const prefix = new Uint32Array((w + 1) * (h + 1));

    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) {
        const n = mask[y * w + x] ? 1 : 0;
        row += n;
        prefix[(y + 1) * stride + x + 1] = prefix[y * stride + x + 1] + row;
      }
    }

    let maxCells = 0;
    for (let y = 0; y <= h - this.fh; y++) {
      for (let x = 0; x <= w - this.fw; x++) {
        const n = prefix[(y + this.fh) * stride + x + this.fw]
                - prefix[y * stride + x + this.fw]
                - prefix[(y + this.fh) * stride + x]
                + prefix[y * stride + x];
        if (n > maxCells) maxCells = n;
      }
    }

    return maxCells * this.dx * this.dy;
  }

  /**
   * Sweeps time across [t_start, t_end] with step dt to find peak concurrent area.
   */
  peakConcurrentArea(tStart, tEnd, dt = 0.01) {
    let peak = 0;
    let peakTime = tStart;

    for (let t = tStart; t <= tEnd + 1e-9; t += dt) {
      const mask = this.activeMaskAt(t);
      const area = this.measureFieldMax(mask);
      if (area > peak) {
        peak = area;
        peakTime = t;
      }
    }

    return {
      peakConcurrentCssPixels: Math.min(FIELD.width * FIELD.height, peak),
      peakTime,
      aboveReferenceLimit: peak > FIELD.limit
    };
  }
}

// ============================================================================
// 1. MOVING FLASH COUNTEREXAMPLE (The "Swept Trail" Trap)
// ============================================================================
console.log('1. Testing Moving Flash Counterexample (Swept Trail vs Instantaneous Area)...');

// Scenario: A 40x40 CSS px box (1,600 CSS px² << 21,824 threshold) flashes at 4 Hz
// while translating horizontally across a 640x480 CSS px viewport over 1.0 second.
// Grid resolution: 64x48 cells (dx = 10 CSS px, dy = 10 CSS px).
// Box in grid cells: 4x4 cells (4*10 = 40 CSS px).
{
  const width = 64, height = 48;
  const calibration = {cssWidth: 640, cssHeight: 480};
  const areaMeter = new AreaMeter(width, height, calibration);
  const temporalRef = new TemporalAreaValidator(width, height, calibration);

  // Box size in grid cells: 4 x 4 (area = 4 * 4 * 10 * 10 = 1,600 CSS px²)
  const boxW = 4, boxH = 4;
  const fps = 30;
  const duration = 1.0;
  const totalFrames = fps * duration;

  for (let f = 0; f <= totalFrames; f++) {
    const t = f / fps;
    const mask = new Uint8Array(width * height);

    // Box position moves across X from cell 2 to cell 50 over 1 second
    const posX = Math.floor(2 + (f / totalFrames) * 48);
    const posY = 20;

    // 4 Hz flash: box is in active completion every 0.25s (e.g. at f=7, 15, 22, 30)
    const isFlashCompletion = (f % 7 === 0);

    if (isFlashCompletion) {
      for (let dy = 0; dy < boxH; dy++) {
        for (let dx = 0; dx < boxW; dx++) {
          const idx = (posY + dy) * width + (posX + dx);
          mask[idx] = 1;
          // Record 50ms active flash excursion in temporal reference
          temporalRef.recordPixelExcursion(posX + dx, posY + dy, t, t + 0.05);
        }
      }
    }

    areaMeter.push(mask, t);
  }

  const meterReport = areaMeter.report();
  const peakCompletion = meterReport.peakCompletion.cssPixelsUpperBound;
  const peakEnvelope = meterReport.peakEnvelope.cssPixelsUpperBound;
  const temporalResult = temporalRef.peakConcurrentArea(0.0, 1.0, 0.01);

  console.log(`   Moving Box Single-Frame Area: 1,600.0 CSS px²`);
  console.log(`   AreaMeter Peak Completion:    ${peakCompletion.toFixed(1)} CSS px²`);
  console.log(`   AreaMeter Rolling Envelope:   ${peakEnvelope.toFixed(1)} CSS px²`);
  console.log(`   Temporal Reference Peak:      ${temporalResult.peakConcurrentCssPixels.toFixed(1)} CSS px²`);
  console.log(`   WCAG Reference Limit:         ${FIELD.limit} CSS px²`);

  // Assertions:
  // 1. Instantaneous peak area never exceeds 1,600 CSS px² (sub-threshold, complies with SC 2.3.1 area rule)
  assert.equal(peakCompletion, 1600.0, 'Sample-aligned completion accurately matches the 1,600 CSS px² box');
  assert.equal(temporalResult.peakConcurrentCssPixels, 1600.0, 'Temporal reference confirms instantaneous area is 1,600 CSS px²');
  assert.equal(temporalResult.aboveReferenceLimit, false, 'Moving box does NOT exceed reference limit');

  // 2. Rolling envelope accumulates the trail of the moving box within the 341x256 field:
  // Across the 35-cell field window, the envelope captures 6,000 CSS px² of the trail
  assert.ok(peakEnvelope >= 3 * 1600.0, 'Rolling envelope reflects the spatial union of the moving trail within the reference field');
  assert.ok(peakEnvelope > peakCompletion, 'Rolling envelope is strictly greater than instantaneous completion');
  console.log('   ✓ Moving flash verified: sample-aligned and temporal reference accurately distinguish instantaneous area from spatial union trail.');
}

// ============================================================================
// 2. ASYNCHRONOUS / STAGGERED FLASH COUNTEREXAMPLE (The "Sample Desync" Trap)
// ============================================================================
console.log('\n2. Testing Asynchronous / Staggered Flash Counterexample (Temporal Overlap)...');

// Scenario: Two adjacent zones (Zone A and Zone B), each 12x12 grid cells (120x120 CSS px = 14,400 CSS px² each).
// Calibration: 640x480 CSS px on 64x48 grid (dx = 10, dy = 10).
// Reference Field: 341x256 CSS px (35x26 grid cells). Both zones fit easily inside the same field.
// Separately: 14,400 CSS px² < 21,824 threshold (PASSES if measured in isolation).
// Combined:   14,400 + 14,400 = 28,800 CSS px² > 21,824 threshold (FAILS if flashing concurrently).
//
// Staggered timing:
// Zone A completes pair at t = 0.10 (active excursion [0.05, 0.15]).
// Zone B completes pair at t = 0.12 (active excursion [0.07, 0.17]).
// At t in [0.07, 0.15], BOTH zones are in an active flash excursion (28,800 CSS px² active!).
{
  const width = 64, height = 48;
  const calibration = {cssWidth: 640, cssHeight: 480};
  const areaMeter = new AreaMeter(width, height, calibration);
  const temporalRef = new TemporalAreaValidator(width, height, calibration);

  // Zone A: [10..21, 10..21] -> 12x12 cells = 14,400 CSS px²
  // Zone B: [22..33, 10..21] -> 12x12 cells = 14,400 CSS px² (adjacent to Zone A)
  const zoneSize = 12;

  // Frame at t = 0.00 (stillness)
  areaMeter.push(new Uint8Array(width * height), 0.00);

  // Frame at t = 0.10: Zone A completes
  const maskA = new Uint8Array(width * height);
  for (let y = 10; y < 10 + zoneSize; y++) {
    for (let x = 10; x < 10 + zoneSize; x++) {
      maskA[y * width + x] = 1;
      temporalRef.recordPixelExcursion(x, y, 0.05, 0.15); // Active 0.05 - 0.15
    }
  }
  areaMeter.push(maskA, 0.10);

  // Frame at t = 0.12: Zone B completes (Zone A completion was at t=0.10, so maskB has only Zone B)
  const maskB = new Uint8Array(width * height);
  for (let y = 10; y < 10 + zoneSize; y++) {
    for (let x = 22; x < 22 + zoneSize; x++) {
      maskB[y * width + x] = 1;
      temporalRef.recordPixelExcursion(x, y, 0.07, 0.17); // Active 0.07 - 0.17
    }
  }
  areaMeter.push(maskB, 0.12);

  // Frame at t = 0.20 (end of cycle)
  areaMeter.push(new Uint8Array(width * height), 0.20);

  const meterReport = areaMeter.report();
  const peakSampleAligned = meterReport.peakCompletion.cssPixelsUpperBound;
  const peakEnvelope = meterReport.peakEnvelope.cssPixelsUpperBound;
  const temporalResult = temporalRef.peakConcurrentArea(0.0, 0.20, 0.005);

  console.log(`   Zone A / Zone B Individual Area: 14,400.0 CSS px² (< 21,824 threshold)`);
  console.log(`   Combined Physical Area:          28,800.0 CSS px² (> 21,824 threshold)`);
  console.log(`   Sample-Aligned Peak Completion:  ${peakSampleAligned.toFixed(1)} CSS px²`);
  console.log(`   Temporal Overlap Concurrent:     ${temporalResult.peakConcurrentCssPixels.toFixed(1)} CSS px²`);
  console.log(`   Rolling Spatial Envelope:        ${peakEnvelope.toFixed(1)} CSS px²`);

  // Assertions demonstrating the exact limitation in TODO Item 32:
  // 1. Sample-aligned completion misses the temporal concurrence because completions fall on different frames:
  assert.equal(peakSampleAligned, 14400.0, 'Sample-aligned completion only sees 14,400 CSS px² on each discrete frame');
  assert.ok(peakSampleAligned < FIELD.limit, 'Sample-aligned completion erroneously appears below limit');

  // 2. The temporal-overlap reference analyzer proves that during [0.07, 0.15], both zones overlap concurrently:
  assert.equal(temporalResult.peakConcurrentCssPixels, 28800.0, 'Temporal reference captures true concurrent overlap of 28,800 CSS px²');
  assert.equal(temporalResult.aboveReferenceLimit, true, 'Temporal reference flags concurrent area above 21,824 limit');

  // 3. The 1-second spatial envelope correctly envelopes the joint area:
  assert.equal(peakEnvelope, 28800.0, 'Rolling spatial envelope captures both zones');
  console.log('   ✓ Asynchronous flash verified: temporal reference captures concurrent overlap where sample-aligned completion desyncs.');
}

// ============================================================================
// 3. GRADUAL RAMPING & NON-INSTANTANEOUS TRANSITIONS
// ============================================================================
console.log('\n3. Testing Gradual Ramping & Slope Excursions...');

// Scenario: A gradual 100ms luminance ramp from Y = 0.10 to Y = 0.85 (Delta Y = 0.75 >= 0.10)
// spanning 5 frames at 30 fps, hold for 2 frames, ramp down over 5 frames.
// Repeat 4 times at 4 Hz.
{
  const a = new Analyzer(1, 1);
  const rampUp = [0.10, 0.25, 0.40, 0.55, 0.70, 0.85];
  const rampDown = [0.85, 0.70, 0.55, 0.40, 0.25, 0.10];

  // Map Y to grayscale byte
  const linear = Array.from({length: 256}, (_, i) => {
    const v = i / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const toByte = y => {
    let best = 0, bestDiff = Infinity;
    for (let i = 0; i < 256; i++) {
      const diff = Math.abs(linear[i] - y);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    return best;
  };

  let t = 0.0;
  const dt = 1 / 60; // 60 fps simulation

  // 4 cycles of ramping flash
  for (let cycle = 0; cycle < 4; cycle++) {
    // Ramp up
    for (const y of rampUp) {
      const b = toByte(y);
      a.push(new Uint8ClampedArray([b, b, b, 255]), t);
      t += dt;
    }
    // Plateau hold
    for (let h = 0; h < 2; h++) {
      const b = toByte(0.85);
      a.push(new Uint8ClampedArray([b, b, b, 255]), t);
      t += dt;
    }
    // Ramp down
    for (const y of rampDown) {
      const b = toByte(y);
      a.push(new Uint8ClampedArray([b, b, b, 255]), t);
      t += dt;
    }
    // Low hold
    for (let h = 0; h < 2; h++) {
      const b = toByte(0.10);
      a.push(new Uint8ClampedArray([b, b, b, 255]), t);
      t += dt;
    }
  }

  const rep = a.report();
  console.log(`   Gradual Ramping 4-Cycle Oscillation: peakGeneral = ${rep.peakGeneral}`);
  assert.equal(rep.peakGeneral, 4, 'Gradual multi-frame ramp registers exactly 4 general flashes');
  console.log('   ✓ Gradual ramping verified: multi-frame slopes and plateau holds track correctly without fragmentation.');
}

// ============================================================================
// 4. RANDOMIZED ASYNCHRONOUS MASKS & CROSS-VALIDATION
// ============================================================================
console.log('\n4. Cross-validating 100 Randomized Spatial Configurations...');

{
  let consistentChecks = 0;
  for (let iter = 0; iter < 100; iter++) {
    const width = 32, height = 24;
    const calibration = {cssWidth: 320, cssHeight: 240};
    const areaMeter = new AreaMeter(width, height, calibration);
    const temporalRef = new TemporalAreaValidator(width, height, calibration);

    const mask = new Uint8Array(width * height);
    const numPixels = Math.floor(Math.random() * 50);
    for (let p = 0; p < numPixels; p++) {
      const x = Math.floor(Math.random() * width);
      const y = Math.floor(Math.random() * height);
      mask[y * width + x] = 1;
      temporalRef.recordPixelExcursion(x, y, 0.0, 0.1);
    }

    const meterRes = areaMeter.measure(mask);
    const refArea = temporalRef.measureFieldMax(mask);

    assert.equal(meterRes.cssPixelsUpperBound, refArea, `Disagreement at iteration ${iter}`);
    consistentChecks++;
  }
  assert.equal(consistentChecks, 100);
  console.log('   ✓ 100 randomized spatial configurations verified: exact numerical correspondence between AreaMeter and TemporalAreaValidator.');
}

console.log('\n================================================================');
console.log('ALL SECTION 1 TEMPORAL AREA & MOVING FLASH REFERENCE TESTS PASS');
console.log('================================================================');
