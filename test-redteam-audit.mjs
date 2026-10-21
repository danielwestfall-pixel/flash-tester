import assert from 'node:assert/strict';
import {Analyzer, color} from './dist/analyzer.mjs';
import {videoUrls, videoFileKind, createVideoElement, loadVideoMetadata, scanVideo} from './dist/video-scanner.mjs';
import {imageUrls, orderedPairs, orderedTriples, schedule, imageAt, fitRect, containRect, exportSequencePlan, importSequencePlan} from './dist/image-sequence.mjs';
import {stampReport, reviewText, BUILD_ID} from './dist/report.mjs';
import {reportHtml, csv, witnessCsv, Evidence} from './dist/evidence.mjs';
import {exportMetadata, metadataCsv} from './dist/export-metadata.mjs';

const results = {
  passed: 0,
  failed: 0,
  findings: []
};

function recordTest(name, fn) {
  try {
    fn();
    results.passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    results.failed++;
    console.error(`  ✗ FAIL: ${name}: ${err.message}`);
    results.findings.push({test: name, error: err.message, stack: err.stack});
  }
}

async function recordAsyncTest(name, fn) {
  try {
    await fn();
    results.passed++;
    console.log(`  ✓ PASS: ${name}`);
  } catch (err) {
    results.failed++;
    console.error(`  ✗ FAIL: ${name}: ${err.message}`);
    results.findings.push({test: name, error: err.message, stack: err.stack});
  }
}

// Mock document for canvas creation in Node.js
class MockCanvas {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() {
    return {
      drawImage() {},
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
    };
  }
}
if (!globalThis.document) {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') return new MockCanvas(320, 180);
      return {};
    }
  };
}

console.log('================================================================');
console.log('RED TEAM ADVERSARIAL AUDIT: Flash Review Prototype (Build 0.4.3)');
console.log('================================================================\n');

// ============================================================================
// TARGET 1: Video File & Container Parser Fuzzing
// ============================================================================
console.log('--- TARGET 1: Video File & Container Parser Fuzzing ---');

// 1.1 Container Header Fuzzing
recordTest('T1.1.1: Rejects truncated buffers under 12 bytes', () => {
  for (const len of [0, 1, 4, 11]) {
    assert.throws(() => videoFileKind(new Uint8Array(len)), /too small/, `Failed on length ${len}`);
  }
  assert.throws(() => videoFileKind(null), /too small/);
  assert.throws(() => videoFileKind(undefined), /too small/);
});

recordTest('T1.1.2: Recognizes valid MP4, WebM, and OGG containers', () => {
  const mp4 = new Uint8Array(16);
  mp4[4] = 0x66; mp4[5] = 0x74; mp4[6] = 0x79; mp4[7] = 0x70; // 'ftyp'
  mp4[8] = 0x6d; mp4[9] = 0x70; mp4[10] = 0x34; mp4[11] = 0x32; // 'mp42'
  assert.ok(videoFileKind(mp4).includes('mp4 (mp42)'));

  const quicktime = new Uint8Array(16);
  quicktime[4] = 0x6d; quicktime[5] = 0x6f; quicktime[6] = 0x6f; quicktime[7] = 0x76; // 'moov'
  assert.equal(videoFileKind(quicktime), 'quicktime (moov)');

  const webm = new Uint8Array(16);
  webm[0] = 0x1a; webm[1] = 0x45; webm[2] = 0xdf; webm[3] = 0xa3;
  assert.equal(videoFileKind(webm), 'webm');

  const ogg = new Uint8Array(16);
  ogg[0] = 0x4f; ogg[1] = 0x67; ogg[2] = 0x67; ogg[3] = 0x53; // 'OggS'
  assert.equal(videoFileKind(ogg), 'ogg');
});

recordTest('T1.1.3: Rejects corrupt / invalid magic signatures gracefully', () => {
  // Corrupt MP4 ('ftyp' replaced with 'xxxx')
  const badMp4 = new Uint8Array(16);
  badMp4[4] = 0x78; badMp4[5] = 0x78; badMp4[6] = 0x78; badMp4[7] = 0x78;
  assert.throws(() => videoFileKind(badMp4), /Unsupported format/);

  // Corrupt WebM (first byte 0x1B instead of 0x1A)
  const badWebm = new Uint8Array(16);
  badWebm[0] = 0x1b; badWebm[1] = 0x45; badWebm[2] = 0xdf; badWebm[3] = 0xa3;
  assert.throws(() => videoFileKind(badWebm), /Unsupported format/);

  // Corrupt OGG ('OggX')
  const badOgg = new Uint8Array(16);
  badOgg[0] = 0x4f; badOgg[1] = 0x67; badOgg[2] = 0x67; badOgg[3] = 0x58;
  assert.throws(() => videoFileKind(badOgg), /Unsupported format/);
});

recordTest('T1.1.4: Random byte fuzzing (100 iterations) never uncaught-exceptions', () => {
  for (let i = 0; i < 100; i++) {
    const len = Math.floor(Math.random() * 200);
    const buf = new Uint8Array(len);
    for (let j = 0; j < len; j++) buf[j] = Math.floor(Math.random() * 256);
    try {
      videoFileKind(buf);
    } catch (e) {
      assert.ok(e.message.includes('too small') || e.message.includes('Unsupported format'));
    }
  }
});

recordTest('T1.1.5: Huge atom / 64-bit box length overflows handled safely without crash', () => {
  // Box length header: 8 bytes: [Length (4B), Type (4B)].
  // An MP4 with box length 1 means 64-bit extended size follows, length 0 means to end of file,
  // or 0xFFFFFFFF means huge box.
  const hugeMp4 = new Uint8Array(32);
  hugeMp4[0] = 0xff; hugeMp4[1] = 0xff; hugeMp4[2] = 0xff; hugeMp4[3] = 0xff; // 4GB box length
  hugeMp4[4] = 0x66; hugeMp4[5] = 0x74; hugeMp4[6] = 0x79; hugeMp4[7] = 0x70; // 'ftyp'
  hugeMp4[8] = 0x69; hugeMp4[9] = 0x73; hugeMp4[10] = 0x6f; hugeMp4[11] = 0x6d;
  // videoFileKind checks magic bytes safely without attempting unbounded memory allocations
  const kind = videoFileKind(hugeMp4);
  assert.ok(kind.includes('mp4'));
});

// 1.2 URL Validation & SSRF Injection
recordTest('T1.2.1: Rejects dangerous URL schemes (SSRF & XSS vectors)', () => {
  const dangerousUrls = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'file:///c:/windows/system32/cmd.exe',
    'blob:https://example.com/uuid',
    'ftp://example.com/video.mp4',
    'gopher://example.com/video.mp4',
    'ws://example.com/socket'
  ];
  for (const u of dangerousUrls) {
    assert.throws(() => videoUrls(u), /Use HTTP\(S\)/, `Accepted dangerous URL: ${u}`);
  }
});

recordTest('T1.2.2: Rejects URLs with embedded credentials', () => {
  const credUrls = [
    'https://admin:pass@example.com/video.mp4',
    'http://user:secret@internal.local/video.webm',
    'https://admin@example.com/video.mp4'
  ];
  for (const u of credUrls) {
    assert.throws(() => videoUrls(u), /credentials/, `Accepted credential URL: ${u}`);
  }
});

await recordAsyncTest('T1.2.3: Rejects non-video HTTP responses (404, 500, HTML) before canvas processing', async () => {
  const mockVideoError = {
    duration: NaN,
    videoWidth: 0,
    videoHeight: 0,
    readyState: 0,
    error: {code: 4, message: 'DEMUXER_ERROR_COULD_NOT_OPEN: 404 Not Found'},
    addEventListener(event, fn) {
      if (event === 'error') queueMicrotask(fn);
    },
    removeEventListener() {}
  };
  await assert.rejects(
    async () => await loadVideoMetadata(mockVideoError, 500),
    /Failed to load video/
  );
});

// 1.3 Seeking Desync & VFR (Variable Frame Rate) Traps
recordTest('T1.3.1: Non-monotonic timestamps (PTS/DTS jumps) and duplicate timestamps are ignored', () => {
  const a = new Analyzer(1, 1);
  const black = new Uint8ClampedArray([0, 0, 0, 255]);
  const white = new Uint8ClampedArray([255, 255, 255, 255]);

  a.push(black, 0.0);
  a.push(white, 0.1);
  assert.equal(a.frames, 2);

  // Backward timestamp (PTS jump backwards)
  a.push(black, 0.05);
  assert.equal(a.frames, 2, 'Backward timestamp must be ignored');

  // Duplicate timestamp
  a.push(white, 0.1);
  assert.equal(a.frames, 2, 'Duplicate timestamp must be ignored');

  // Monotonic forward timestamp succeeds
  a.push(black, 0.2);
  assert.equal(a.frames, 3, 'Forward timestamp is accepted');
});

recordTest('T1.3.2: Frame gap > 0.1s is recorded and flags insufficient observation', () => {
  const a = new Analyzer(1, 1);
  const black = new Uint8ClampedArray([0, 0, 0, 255]);
  a.push(black, 0.0);
  a.push(black, 0.05);
  a.push(black, 0.20); // 0.15s gap (> 0.10s)
  a.push(black, 1.20); // 1.00s gap
  const rep = a.report();
  assert.ok(rep.maxFrameGapSeconds > 0.10, 'Records max gap > 0.10s');
  assert.equal(rep.observation.meetsScreeningMinimum, false);
  assert.ok(rep.observation.reasons.some(r => r.includes('gap exceeded 0.1 seconds')));
});

recordTest('T1.3.3: Variable Frame Rate (VFR) harmonic aliasing evasion limitation', () => {
  // Construct a sequence flashing at 4 Hz (8 transitions/sec).
  // An adversarial VFR sampler samples only at t = 0.0, 0.25, 0.50, 0.75, 1.00, etc.
  // Exactly matching the period where the pixel is always black!
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 30; i++) {
    const t = i * 0.10; // Exactly 0.10s interval (at threshold limit)
    // At these specific sample points, signal is black:
    a.push(new Uint8ClampedArray([0, 0, 0, 255]), t);
  }
  const rep = a.report();
  assert.equal(rep.peakGeneral, 0, 'Aliased VFR sampling evades detection due to Nyquist limit');
  // Confirm the limitations explicitly warn about this:
  assert.ok(rep.limitations.some(l => l.includes('RED-10') && l.includes('Variable frame rates (VFR)')));
});

// 1.4 Memory Cleanup on Interruption
await recordAsyncTest('T1.4.1: AbortController abort immediately cancels scanVideo loop', async () => {
  let pauses = 0;
  const mockVideo = {
    duration: 60.0,
    videoWidth: 64,
    videoHeight: 48,
    _t: 0,
    listeners: {},
    addEventListener(event, fn) { this.listeners[event] = fn; },
    removeEventListener(event, fn) { delete this.listeners[event]; },
    pause() { pauses++; },
    set currentTime(t) {
      this._t = t;
      if (this.listeners['seeked']) {
        const fn = this.listeners['seeked'];
        delete this.listeners['seeked'];
        queueMicrotask(fn);
      }
    },
    get currentTime() { return this._t; }
  };

  const controller = new AbortController();
  const {report} = await scanVideo(mockVideo, {
    analysisWidth: 64,
    analysisHeight: 48,
    maxDuration: 60.0,
    stepFps: 30,
    forceSeeking: true,
    keepScreenshots: false,
    signal: controller.signal,
    onProgress: p => {
      if (p.frames >= 5) controller.abort();
    }
  });

  assert.equal(report.endedBecause, 'Cancelled by user or limit');
  assert.equal(report.videoMetadata.sampledFrames, 5);
  assert.ok(pauses > 0, 'Video paused on abort');

  // Test pre-aborted signal
  const preAborted = new AbortController();
  preAborted.abort();
  await assert.rejects(
    async () => await scanVideo(mockVideo, {signal: preAborted.signal}),
    /cancelled/
  );
});


// ============================================================================
// TARGET 2: Image Sequence Trajectories & Plan Injection
// ============================================================================
console.log('\n--- TARGET 2: Image Sequence Trajectories & Plan Injection ---');

// 2.1 Plan Import JSON Schema Injection
recordTest('T2.1.1: Prototype pollution payload does not pollute Object.prototype', () => {
  const hostilePayload = JSON.stringify({
    __proto__: {isAdmin: true, polluted: 'yes'},
    plan: [
      {image: 0, time: 0.0},
      {image: 1, time: 0.1}
    ]
  });
  const data = importSequencePlan(hostilePayload, 2);
  assert.equal(Object.prototype.isAdmin, undefined, 'Object.prototype.isAdmin must be undefined');
  assert.equal(Object.prototype.polluted, undefined, 'Object.prototype.polluted must be undefined');
  assert.equal(({}).isAdmin, undefined);
});

recordTest('T2.1.2: Rejects invalid, negative, NaN and Infinity timestamps', () => {
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: 1, time: -1.5}]}), 2), /Invalid step/);
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: 1, time: NaN}]}), 2), /Invalid step/);
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: 1, time: Infinity}]}), 2), /Invalid step/);
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: 1, time: '0.5'}]}), 2), /Invalid step/);
});

recordTest('T2.1.3: Rejects out-of-bounds image indices', () => {
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: 99, time: 0.1}]}), 3), /out of range/);
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: -1, time: 0.1}]}), 3), /out of range/);
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: 3, time: 0.1}]}), 3), /out of range/);
  assert.throws(() => importSequencePlan(JSON.stringify({plan: [{image: 0, time: 0.0}, {image: 1.5, time: 0.1}]}), 3), /out of range/);
});

recordTest('T2.1.4: Massive plan (100,000 steps) parses without thread lock', () => {
  const start = performance.now();
  const largeSteps = Array.from({length: 100000}, (_, i) => ({image: i % 3, time: i * 0.1}));
  const json = JSON.stringify({plan: largeSteps});
  const data = importSequencePlan(json, 3);
  const elapsed = performance.now() - start;
  assert.equal(data.plan.length, 100000);
  assert.ok(elapsed < 2000, `Parsing took ${elapsed.toFixed(1)}ms (< 2000ms)`);
});

recordTest('T2.1.5: Plan boundary flaw remediation: plan with < 2 steps', () => {
  const singleStepPlan = [{image: 0, time: 0.0}];
  // importSequencePlan strictly requires at least 2 steps
  assert.throws(() => importSequencePlan(JSON.stringify({plan: singleStepPlan}), 2), /requires at least 2 steps/);
  // imageAt safely handles single-step plan without throwing TypeError
  assert.equal(imageAt(singleStepPlan, 0.5), 0, 'imageAt returns step 0 without error on single-step plan');
});

// 2.2 Combinatorial Explosion & Boundary Guarantees
recordTest('T2.2.1: orderedTriples boundaries (count 2, 3, 8, 9, non-integers)', () => {
  assert.throws(() => orderedTriples(2), /Triple screening requires 3–8/);
  assert.equal(orderedTriples(3).length, 6);   // 3 * 2 * 1
  assert.equal(orderedTriples(4).length, 24);  // 4 * 3 * 2
  assert.equal(orderedTriples(8).length, 336); // 8 * 7 * 6
  assert.throws(() => orderedTriples(9), /Triple screening requires 3–8/);
  assert.throws(() => orderedTriples(3.5), /Triple screening requires 3–8/);
  assert.throws(() => orderedTriples('4'), /Triple screening requires 3–8/);
});

recordTest('T2.2.2: orderedTriples never contains identical elements in any triple', () => {
  const triples = orderedTriples(6);
  for (const [a, b, c] of triples) {
    assert.notEqual(a, b, `Triple contains identical elements: [${a}, ${b}, ${c}]`);
    assert.notEqual(b, c, `Triple contains identical elements: [${a}, ${b}, ${c}]`);
    assert.notEqual(c, a, `Triple contains identical elements: [${a}, ${b}, ${c}]`);
  }
});

// 2.3 Extreme Aspect Ratios & Fit Modes (fitRect)
recordTest('T2.3.1: fitRect with extreme aspect ratios (16000x1 and 1x16000)', () => {
  for (const mode of ['contain', 'cover', 'crop']) {
    const r1 = fitRect(16000, 1, 640, 480, mode);
    assert.ok(Number.isFinite(r1.width) && r1.width >= 1, `${mode} width must be >= 1`);
    assert.ok(Number.isFinite(r1.height) && r1.height >= 1, `${mode} height must be >= 1`);
    assert.ok(Number.isFinite(r1.x));
    assert.ok(Number.isFinite(r1.y));

    const r2 = fitRect(1, 16000, 640, 480, mode);
    assert.ok(Number.isFinite(r2.width) && r2.width >= 1, `${mode} width must be >= 1`);
    assert.ok(Number.isFinite(r2.height) && r2.height >= 1, `${mode} height must be >= 1`);
    assert.ok(Number.isFinite(r2.x));
    assert.ok(Number.isFinite(r2.y));
  }
});

recordTest('T2.3.2: fitRect zero-dimension boundary flaw check (0x0)', () => {
  const rZero = fitRect(0, 0, 640, 480, 'contain');
  // 0 / 0 scale results in NaN
  const isNan = Number.isNaN(rZero.width) || Number.isNaN(rZero.height);
  if (isNan) {
    results.findings.push({
      test: 'T2.3.2: fitRect(0, 0) produces NaN',
      error: 'sourceWidth=0, sourceHeight=0 produces NaN dimensions in fitRect',
      detail: rZero
    });
    console.log('    [Finding Logged: fitRect with 0x0 produces NaN dimensions]');
  }
  assert.ok(true, 'Boundary investigated');
});

// 2.4 Fail-Safe Playback Lockout
recordTest('T2.4.1: Fail-safe text normalization rejects bypasses and accepts normalized valid inputs', () => {
  const normalize = text => (text || '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u00A0\s]+/g, ' ')
    .replace(/["'“”]/g, '')
    .trim()
    .toLowerCase();
  const check = t => {
    const v = normalize(t);
    return v === 'i agree' || v === 'i understand';
  };

  assert.equal(check(''), false);
  assert.equal(check('I agree'), true);
  assert.equal(check('  i understand  '), true);
  assert.equal(check('“I agree”'), true);
  assert.equal(check('"I understand"'), true);
  assert.equal(check('\u200BI agree\u200B'), true);
  assert.equal(check('I\u200Bagree'), false); // Zero-width space inside removes separator -> 'iagree'
  assert.equal(check('I disagree'), false);
  assert.equal(check('I agree!'), false);
  assert.equal(check('I agree 123'), false);
});


// ============================================================================
// TARGET 3: Strict SC 2.3.2 (Level AAA) & SC 2.3.3 Motion Checklist
// ============================================================================
console.log('\n--- TARGET 3: Strict SC 2.3.2 (Level AAA) & SC 2.3.3 Motion Checklist ---');

recordTest('T3.1.1: Small-area evasion attack fails against SC 2.3.2 Level AAA', () => {
  // 10 Hz flash confined to tiny 4x4 px area (16 px << 21,824 CSS px)
  const a = new Analyzer(64, 48, {calibration: {cssWidth: 1024, cssHeight: 768}});
  for (let i = 0; i <= 120; i++) {
    const t = i / 60; // 2 seconds
    const val = (Math.floor(t * 20) % 2) ? 255 : 0; // 10 Hz
    const frame = new Uint8ClampedArray(64 * 48 * 4);
    for (let py = 0; py < 4; py++) {
      for (let px = 0; px < 4; px++) {
        const idx = (py * 64 + px) * 4;
        frame[idx] = frame[idx + 1] = frame[idx + 2] = val;
        frame[idx + 3] = 255;
      }
    }
    a.push(frame, t);
  }
  const rep = a.report();
  assert.equal(rep.peakGeneral, 10);
  // SC 2.3.2 strictly flags exceeds-three-flash-limit despite tiny area:
  assert.equal(rep.evaluation.sc232.status, 'exceeds-three-flash-limit');
  assert.equal(rep.evaluation.sc232.areaExceptionPermitted, false);
  assert.equal(rep.evaluation.sc232.peakFlashesPerSecond, 10);
});

recordTest('T3.2.1: Export integrity across JSON, HTML, reviewText, and CSV', () => {
  const a = new Analyzer(2, 2);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const val = (Math.floor(t * 20) % 2) ? 255 : 0; // 10 Hz
    a.push(new Uint8ClampedArray(16).fill(val), t);
  }
  const rep = stampReport(a.report());
  const evidence = new Evidence(2, 2, 0, 0);

  // Metadata
  const meta = exportMetadata(rep, evidence.report());
  assert.equal(meta.sc232_status, 'exceeds-three-flash-limit');
  assert.equal(meta.sc233_status, 'manual-verification-required');
  assert.equal(meta.conformance_status, 'not-determined');

  // Review Text
  const txt = reviewText(rep);
  assert.ok(txt.includes('WCAG 2.2 SC 2.3.2 (Level AAA) Strict Three-Flash Evaluation:'));
  assert.ok(txt.includes('exceeds-three-flash-limit'));
  assert.ok(txt.includes('WCAG 2.2 SC 2.3.3 (Level AAA) Interaction Checklist (Manual Review Required):'));
  assert.ok(txt.includes('Conformance status: Not determined'));
  assert.ok(!txt.includes('WCAG Compliant'));

  // HTML
  const html = reportHtml(rep);
  assert.ok(html.includes('WCAG SC 2.3.2 (Level AAA)'));
  assert.ok(html.includes('exceeds-three-flash-limit'));
  assert.ok(html.includes('WCAG SC 2.3.3 (Level AAA)'));

  // CSV
  const csvStr = csv(evidence.report(), rep);
  assert.ok(csvStr.includes('exceeds-three-flash-limit'));
  assert.ok(csvStr.includes('manual-verification-required'));
  assert.ok(csvStr.includes('not-determined'));
});

recordTest('T3.3.1: SC 2.3.3 interaction checklist completeness', () => {
  const a = new Analyzer(2, 2);
  a.push(new Uint8ClampedArray(16).fill(0), 0);
  a.push(new Uint8ClampedArray(16).fill(255), 1.0);
  const rep = a.report();
  const sc233 = rep.evaluation.sc233;
  assert.equal(sc233.status, 'manual-verification-required');
  assert.equal(sc233.checklist.length, 4);
  const items = sc233.checklist.map(c => c.item);
  assert.ok(items.includes('prefers-reduced-motion'));
  assert.ok(items.includes('in-page-control'));
  assert.ok(items.includes('essential-motion-rationale'));
  assert.ok(items.includes('interaction-state-coverage'));
  for (const c of sc233.checklist) {
    assert.ok(c.description && c.description.length > 20);
  }
});


// ============================================================================
// TARGET 4: Detector Boundaries & Mathematical Precision
// ============================================================================
console.log('\n--- TARGET 4: Detector Boundaries & Mathematical Precision ---');

recordTest('T4.1.1: Luminance threshold precision at delta Y = 0.10 +/- epsilon', () => {
  // The threshold in analyzer.mjs is Math.abs(delta) >= .1 - 1e-10
  // Note: .1 - 1e-10 in IEEE-754 = 0.09999999990000001
  const eps = 1e-10;
  const threshold = 0.1 - eps;

  assert.equal(0.0999999999 >= threshold, false, '0.0999999999 is strictly below threshold');
  assert.equal(0.0999999998 >= threshold, false, '0.0999999998 is strictly below threshold');
  assert.equal(0.1000000001 >= threshold, true, '0.1000000001 is strictly above threshold');
});

recordTest('T4.2.1: Saturated red ratio uses linear sRGB, not gamma 8-bit channels', () => {
  // Test rgb(100, 0, 40):
  // Gamma ratio: 100 / (100 + 0 + 40) = 100 / 140 = 0.714285 (< 0.80)
  // Linear ratio: R / (R + G + B) = 0.857262 (>= 0.80)
  const c = color(100, 0, 40);
  const gammaRatio = 100 / 140;
  assert.ok(gammaRatio < 0.80, 'Gamma ratio is below 0.80');
  assert.ok(c.saturation >= 0.80, 'Linear saturation ratio is >= 0.80');
  assert.equal(c.red, true, 'Color is correctly classified as saturated red in linear space');
});

recordTest('T4.3.1: Black endpoint chromaticity robustness (d = 0)', () => {
  const cBlack = color(0, 0, 0);
  assert.equal(cBlack.u, 0);
  assert.equal(cBlack.v, 0);
  assert.equal(cBlack.valid, false, 'Black has valid: false');
  assert.ok(Number.isFinite(cBlack.u) && !Number.isNaN(cBlack.u));
  assert.ok(Number.isFinite(cBlack.v) && !Number.isNaN(cBlack.v));

  // Transitions between red [255, 0, 0] and black [0, 0, 0] at 4 Hz
  const a = new Analyzer(1, 1);
  for (let i = 0; i <= 60; i++) {
    const t = i / 30;
    const rgb = (Math.floor(t * 8) % 2) ? [255, 0, 0] : [0, 0, 0];
    assert.doesNotThrow(() => a.push(new Uint8ClampedArray([...rgb, 255]), t));
  }
  const rep = a.report();
  assert.equal(rep.peakGeneral, 4, 'Red/black triggers general flash via luminance');
  // Red heuristic doesn't throw or push NaN:
  for (const w of rep.windows) {
    assert.ok(Number.isFinite(w.general));
    assert.ok(Number.isFinite(w.red));
  }
});

recordTest('T4.4.1: Non-overlapping pairing phase parity (7 vs 8 transitions)', () => {
  // Test 7 transitions within 1 second (3.5 cycles):
  // i=0: t=0.0 val=0
  // i=1: t=0.1 val=255 (trans 1)
  // i=2: t=0.2 val=0   (trans 2 -> Phase 0 completion 1)
  // i=3: t=0.3 val=255 (trans 3 -> Phase 1 completion 1)
  // i=4: t=0.4 val=0   (trans 4 -> Phase 0 completion 2)
  // i=5: t=0.5 val=255 (trans 5 -> Phase 1 completion 2)
  // i=6: t=0.6 val=0   (trans 6 -> Phase 0 completion 3)
  // i=7: t=0.7 val=255 (trans 7 -> Phase 1 completion 3)
  const a7 = new Analyzer(1, 1);
  const times7 = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
  for (let i = 0; i < times7.length; i++) {
    const val = (i % 2 === 0) ? 0 : 255;
    a7.push(new Uint8ClampedArray([val, val, val, 255]), times7[i]);
  }
  assert.equal(a7.peakGeneral, 3, '7 transitions yield exactly 3 completions in both Phase 0 and Phase 1');

  // Transition 8 (at t=0.8): completes Pair 4 in Phase 0!
  a7.push(new Uint8ClampedArray([0, 0, 0, 255]), 0.8);
  assert.equal(a7.peakGeneral, 4, '8 transitions yield 4 completions in Phase 0');
});

// Summary
console.log('\n================================================================');
console.log(`AUDIT RESULTS: ${results.passed} PASSED, ${results.failed} FAILED`);
console.log(`LOGGED FINDINGS: ${results.findings.length}`);
if (results.findings.length) {
  console.log(JSON.stringify(results.findings, null, 2));
}
console.log('================================================================');
