import assert from 'node:assert/strict';
import {Analyzer} from './dist/analyzer.mjs';
import {stampReport,reviewText} from './dist/report.mjs';
import {reportHtml,csv,witnessCsv,Evidence} from './dist/evidence.mjs';
import {exportMetadata} from './dist/export-metadata.mjs';

console.log('Testing SC 2.3.2 (Level AAA) and SC 2.3.3 (Level AAA) criteria...');

// 1. SC 2.3.2 Strict Evaluation with small area (small-zone case)
// Under SC 2.3.1, small-zone passes the 21,824 CSS px area exception.
// Under SC 2.3.2, no area exception is allowed: 10 Hz flashing MUST be flagged as exceeds-three-flash-limit.
const a10Hz = new Analyzer(64, 48, {calibration: {cssWidth: 1024, cssHeight: 768}});
for (let i = 0; i <= 120; i++) {
  const t = i / 60; // 2 seconds
  const val = (Math.floor(t * 20) % 2) ? 255 : 0; // 10 Hz
  const frame = new Uint8ClampedArray(64 * 48 * 4);
  // Flash only in a tiny 4x4 region (16 analysis pixels << threshold)
  for (let py = 0; py < 4; py++) {
    for (let px = 0; px < 4; px++) {
      const idx = (py * 64 + px) * 4;
      frame[idx] = frame[idx + 1] = frame[idx + 2] = val;
      frame[idx + 3] = 255;
    }
  }
  a10Hz.push(frame, t);
}
const report10Hz = a10Hz.report();
assert.equal(report10Hz.peakGeneral, 10, 'Peak general flashes is 10');
assert.equal(report10Hz.evaluation.sc232.criterion, 'SC 2.3.2 Three Flashes (Level AAA)');
assert.equal(report10Hz.evaluation.sc232.status, 'exceeds-three-flash-limit', 'SC 2.3.2 flags 10 Hz flashing regardless of tiny area');
assert.equal(report10Hz.evaluation.sc232.areaExceptionPermitted, false, 'SC 2.3.2 explicitly disallows area exemptions');
assert.equal(report10Hz.evaluation.sc232.peakFlashesPerSecond, 10);

// 2. Safe 2 Hz flashing (SC 2.3.1 and SC 2.3.2 compliant)
const a2Hz = new Analyzer(2, 2);
for (let i = 0; i <= 60; i++) {
  const t = i / 30; // 2 seconds
  const val = (Math.floor(t * 4) % 2) ? 255 : 0; // 2 Hz (4 transitions/s)
  const frame = new Uint8ClampedArray(2 * 2 * 4).fill(val);
  for (let j = 3; j < frame.length; j += 4) frame[j] = 255;
  a2Hz.push(frame, t);
}
const report2Hz = a2Hz.report();
assert.equal(report2Hz.peakGeneral, 2);
assert.equal(report2Hz.evaluation.sc232.status, 'no-excess-flashes-in-sample', '2 Hz complies with SC 2.3.2');
assert.equal(report2Hz.evaluation.sc232.peakFlashesPerSecond, 2);

// 3. Insufficient observation (< 1 second)
const aShort = new Analyzer(1, 1);
aShort.push(new Uint8ClampedArray([0, 0, 0, 255]), 0);
aShort.push(new Uint8ClampedArray([255, 255, 255, 255]), 0.5);
const reportShort = aShort.report();
assert.equal(reportShort.evaluation.sc232.status, 'insufficient-observation');

// 4. SC 2.3.3 Animation from Interactions (Level AAA)
assert.equal(report10Hz.evaluation.sc233.criterion, 'SC 2.3.3 Animation from Interactions (Level AAA)');
assert.equal(report10Hz.evaluation.sc233.status, 'manual-verification-required');
assert.equal(report10Hz.evaluation.sc233.checklist.length, 4);
const checklistKeys = report10Hz.evaluation.sc233.checklist.map(c => c.item);
assert.ok(checklistKeys.includes('prefers-reduced-motion'));
assert.ok(checklistKeys.includes('in-page-control'));
assert.ok(checklistKeys.includes('essential-motion-rationale'));
assert.ok(checklistKeys.includes('interaction-state-coverage'));

// 5. Verification of exports formatting
const stamped = stampReport(report10Hz);
const text = reviewText(stamped);
assert.ok(text.includes('WCAG 2.2 SC 2.3.2 (Level AAA) Strict Three-Flash Evaluation'));
assert.ok(text.includes('exceeds-three-flash-limit'));
assert.ok(text.includes('WCAG 2.2 SC 2.3.3 (Level AAA) Interaction Checklist'));
assert.ok(text.includes('prefers-reduced-motion'));

const html = reportHtml(stamped);
assert.ok(html.includes('WCAG SC 2.3.2 (Level AAA) — Strict Three-Flash Evaluation'));
assert.ok(html.includes('exceeds-three-flash-limit'));
assert.ok(html.includes('WCAG SC 2.3.3 (Level AAA) — Interaction &amp; Motion Animation Checklist'));
assert.ok(html.includes('prefers-reduced-motion'));

const meta = exportMetadata(stamped);
assert.equal(meta.sc232_status, 'exceeds-three-flash-limit');
assert.equal(meta.sc233_status, 'manual-verification-required');

console.log('SC 2.3.2 strict Level AAA evaluation and SC 2.3.3 motion interaction checklist tests passed cleanly.');
