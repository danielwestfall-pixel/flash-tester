import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Analyzer} from './dist/analyzer.mjs';

const html = fs.readFileSync(new URL('./dist/passing-suite.html', import.meta.url), 'utf8');

// Verify structure and essential elements
assert.ok(html.includes('id="start-motion"'));
assert.ok(html.includes('id="stop-motion"'));
assert.ok(html.includes('id="start-pulse"'));
assert.ok(html.includes('id="stop-pulse"'));
assert.ok(html.includes('id="run-benchmarks"'));
assert.ok(html.includes('id="benchmark-table"'));
assert.ok(html.includes('id="benchmark-rows"'));

// Verify ground-truth values mathematically
const linear = Array.from({length: 256}, (_, i) => {
  const v = i / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
});
function getLuminance(r, g, b) {
  return 0.2126 * linear[r] + 0.7152 * linear[g] + 0.0722 * linear[b];
}

const yBlack = getLuminance(0, 0, 0);
const yWhite = getLuminance(255, 255, 255);
assert.equal(yBlack, 0);
assert.ok(Math.abs(yWhite - 1) < 1e-9);

// Case 1: 2.0 Hz sub-threshold
const a2 = new Analyzer(16, 12);
const fBlack = new Uint8ClampedArray(16 * 12 * 4).fill(0);
const fWhite = new Uint8ClampedArray(16 * 12 * 4);
for (let i = 0; i < fWhite.length; i += 4) { fWhite[i] = 255; fWhite[i+1] = 255; fWhite[i+2] = 255; fWhite[i+3] = 255; }
for (let i = 0; i < fBlack.length; i += 4) { fBlack[i+3] = 255; }

for (let i = 0; i <= 360; i++) {
  const t = i / 120;
  const phase = Math.floor(t * 2 * 2) % 2; // 2 Hz = 4 transitions/s
  a2.push(phase === 0 ? fBlack : fWhite, t);
}
const r2 = a2.report();
assert.equal(r2.peakGeneral, 2, '2 Hz produces exactly 2 general pairs');
assert.equal(r2.status, 'inconclusive-no-candidates', '2 Hz is under the 3-flash limit');

// Case 2: 3.0 Hz boundary
const a3 = new Analyzer(16, 12);
for (let i = 0; i <= 360; i++) {
  const t = i / 120;
  const phase = Math.floor(t * 3 * 2) % 2; // 3 Hz = 6 transitions/s
  a3.push(phase === 0 ? fBlack : fWhite, t);
}
const r3 = a3.report();
assert.equal(r3.peakGeneral, 3, '3 Hz produces exactly 3 general pairs');
assert.equal(r3.status, 'inconclusive-no-candidates', '3 Hz is at the boundary and allowed');

// Case 3: 10.0 Hz soft gray (#B0B0B0 / #B8B8B8)
const yB0 = getLuminance(176, 176, 176);
const yB8 = getLuminance(184, 184, 184);
const deltaGray = Math.abs(yB0 - yB8);
assert.ok(deltaGray < 0.10, 'Gray pair delta must be under 0.10 threshold');

const aGray = new Analyzer(16, 12);
const fGrayA = new Uint8ClampedArray(16 * 12 * 4);
const fGrayB = new Uint8ClampedArray(16 * 12 * 4);
for (let i = 0; i < fGrayA.length; i += 4) {
  fGrayA[i] = 176; fGrayA[i+1] = 176; fGrayA[i+2] = 176; fGrayA[i+3] = 255;
  fGrayB[i] = 184; fGrayB[i+1] = 184; fGrayB[i+2] = 184; fGrayB[i+3] = 255;
}
for (let i = 0; i <= 360; i++) {
  const t = i / 120;
  const phase = Math.floor(t * 10 * 2) % 2; // 10 Hz = 20 transitions/s
  aGray.push(phase === 0 ? fGrayA : fGrayB, t);
}
const rGray = aGray.report();
assert.equal(rGray.peakGeneral, 0, 'Low-contrast 10 Hz oscillation must produce 0 general pairs');
assert.equal(rGray.status, 'inconclusive-no-candidates', 'Low-contrast pair passes without candidates');

console.log('Passing-only calibration and quality test suite verified: all reference cases pass with expected known values.');
