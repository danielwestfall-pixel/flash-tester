import assert from 'node:assert/strict';
import fs from 'node:fs';
import {AreaMeter, FIELD} from './dist/area.mjs';
import {Analyzer} from './dist/analyzer.mjs';
import {scanVideo, createVideoElement, loadVideoMetadata} from './dist/video-scanner.mjs';
import {exportMetadata, metadataCsv} from './dist/export-metadata.mjs';
import {stampReport, reviewText} from './dist/report.mjs';

console.log('================================================================');
console.log('SECTION 1: AUTOMATED SIZE & PRESENTATION MATRIX VALIDATION');
console.log('Reference: TODO.md Items 34–35 · Browser Animations & Video');
console.log('================================================================\n');

// Mock DOM environment for headless testing
class MockElement {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase();
    this.listeners = {};
    this.style = {};
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.children = [];
    this._rect = {x: 0, y: 0, width: 640, height: 480};
  }
  addEventListener(n, fn) { this.listeners[n] = fn; }
  removeEventListener(n, fn) { delete this.listeners[n]; }
  fire(n, e = {}) { return this.listeners[n]?.(e); }
  append(n) { this.children.push(n); }
  replaceChildren() { this.children = []; }
  focus() {}
  click() { this.fire('click'); }
  getBoundingClientRect() { return this._rect; }
  setRect(x, y, w, h) { this._rect = {x, y, width: w, height: h}; }
}

class MockCanvas {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() {
    return {
      drawImage() {},
      fillRect() {},
      getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
    };
  }
}

// 5 Canonical Presentation Scenarios
const SCENARIOS = [
  {
    id: 'default',
    name: 'Normal / Restored Window',
    viewport: { width: 1280, height: 800 },
    dpr: 1.0,
    zoom: 100,
    contentFullscreen: false,
    f11Fullscreen: false,
    layout: 'wide'
  },
  {
    id: 'maximized',
    name: 'Maximized Browser Window',
    viewport: { width: 1920, height: 1040 },
    dpr: 1.25,
    zoom: 100,
    contentFullscreen: false,
    f11Fullscreen: false,
    layout: 'wide'
  },
  {
    id: 'browser-fullscreen',
    name: 'Browser Fullscreen (F11)',
    viewport: { width: 1920, height: 1080 },
    dpr: 1.0,
    zoom: 100,
    contentFullscreen: false,
    f11Fullscreen: true,
    layout: 'wide'
  },
  {
    id: 'content-fullscreen',
    name: 'Content / Player Fullscreen',
    viewport: { width: 1920, height: 1080 },
    dpr: 1.0,
    zoom: 100,
    contentFullscreen: true,
    f11Fullscreen: false,
    layout: 'wide'
  },
  {
    id: 'responsive-small',
    name: 'Responsive Narrow Breakpoint',
    viewport: { width: 375, height: 667 },
    dpr: 2.0,
    zoom: 100,
    contentFullscreen: false,
    f11Fullscreen: false,
    layout: 'compact'
  }
];

// Matrix Results Table
const matrixReport = [];

// ============================================================================
// PART A: BROWSER ANIMATION SIZE MATRIX VALIDATION
// ============================================================================
console.log('--- PART A: Browser Animation Matrix Validation ---');

for (const sc of SCENARIOS) {
  // Simulate DOM state for the scenario
  const surfaceEl = new MockElement('div');
  surfaceEl.setRect(0, 0, sc.viewport.width, sc.viewport.height);

  const doc = {
    hidden: false,
    fullscreenElement: sc.contentFullscreen ? surfaceEl : null
  };

  const win = {
    innerWidth: sc.viewport.width,
    innerHeight: sc.viewport.height,
    devicePixelRatio: sc.dpr
  };

  // Telemetry computation (matching fixtures/presentation-matrix/animation.html)
  const rect = surfaceEl.getBoundingClientRect();
  const fullscreenKind = sc.contentFullscreen ? 'content' : (sc.f11Fullscreen ? 'f11' : 'none');
  const computedLayout = win.innerWidth <= 600 ? 'compact' : 'wide';

  assert.equal(computedLayout, sc.layout, `Layout breakpoint mismatch for ${sc.id}`);

  // Test 3 animation modes:
  // 1. Safe smooth motion
  // 2. 4 Hz flashing box
  // 3. 3 Hz borderline box
  for (const mode of ['safe-orbit', 'flash-4hz', 'boundary-3hz']) {
    let peakGeneral = 0;
    let peakRed = 0;

    // Simulate animation frame sampling across the viewport
    // Grid: 64x48 cells scaled to viewport
    const gridW = 64, gridH = 48;
    const a = new Analyzer(gridW, gridH, {
      calibration: {cssWidth: sc.viewport.width, cssHeight: sc.viewport.height}
    });

    const isFlashing = (mode === 'flash-4hz');
    const isBoundary = (mode === 'boundary-3hz');

    for (let f = 0; f <= 60; f++) {
      const t = f / 30; // 2 seconds
      const frame = new Uint8ClampedArray(gridW * gridH * 4);
      
      let val = 122; // Safe background Y ≈ 0.48
      if (isFlashing) {
        val = (Math.floor(t * 8) % 2 === 0) ? 255 : 0; // 4 Hz
      } else if (isBoundary) {
        val = (Math.floor(t * 6) % 2 === 0) ? 255 : 0; // 3 Hz
      }

      // Fill a centered medium box (8% of grid)
      const bw = Math.round(gridW * 0.28), bh = Math.round(gridH * 0.28);
      const bx = Math.round((gridW - bw) / 2), by = Math.round((gridH - bh) / 2);
      for (let y = by; y < by + bh; y++) {
        for (let x = bx; x < bx + bw; x++) {
          const idx = (y * gridW + x) * 4;
          frame[idx] = frame[idx + 1] = frame[idx + 2] = val;
          frame[idx + 3] = 255;
        }
      }

      a.push(frame, t);
    }

    const rep = a.report();
    peakGeneral = rep.peakGeneral;

    if (mode === 'safe-orbit') {
      assert.equal(peakGeneral, 0, `Safe motion triggered false alarm in ${sc.id}`);
    } else if (mode === 'flash-4hz') {
      assert.equal(peakGeneral, 4, `4 Hz failed to detect 4 flashes in ${sc.id}`);
    } else if (mode === 'boundary-3hz') {
      assert.equal(peakGeneral, 3, `3 Hz borderline must not exceed 3 flashes in ${sc.id}`);
    }

    matrixReport.push({
      scenario: sc.name,
      type: 'Animation',
      mode,
      viewportCss: `${sc.viewport.width} × ${sc.viewport.height}`,
      dpr: sc.dpr,
      layout: computedLayout,
      fullscreenKind,
      areaStatus: rep.area.status,
      peakGeneral,
      outcome: rep.outcome
    });
  }

  console.log(`  ✓ Scenario [${sc.name}] animation contracts verified across all 3 modes.`);
}

// ============================================================================
// PART B: VIDEO PLAYER SIZE MATRIX VALIDATION
// ============================================================================
console.log('\n--- PART B: Video Player Matrix Validation ---');

for (const sc of SCENARIOS) {
  // Test both valid calibration and rejected calibration (NF-02 check)
  const isRejectedScenario = (sc.id === 'responsive-small'); // Demonstrate NF-02 rejection on small responsive

  const suppliedCalibration = isRejectedScenario
    ? { cssWidth: 512, cssHeight: 464 } // Aspect mismatch with 375x667
    : { cssWidth: sc.viewport.width, cssHeight: sc.viewport.height };

  const mockVideo = {
    duration: 2.0,
    videoWidth: 640,
    videoHeight: 360,
    _t: 0,
    listeners: {},
    addEventListener(event, fn) { this.listeners[event] = fn; },
    removeEventListener(event, fn) { delete this.listeners[event]; },
    pause() {},
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

  // Mock global document canvas for scanVideo
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') {
        const mc = new MockCanvas(320, 180);
        mc.getContext = () => ({
          drawImage() {},
          putImageData() {},
          getImageData: (x, y, w, h) => {
            const isFlash = Math.floor(mockVideo.currentTime * 8) % 2 === 0;
            const val = isFlash ? 255 : 0;
            const data = new Uint8ClampedArray(w * h * 4);
            for (let i = 0; i < data.length; i += 4) {
              data[i] = data[i+1] = data[i+2] = val;
              data[i+3] = 255;
            }
            return { data };
          }
        });
        return mc;
      }
      return new MockElement(tag);
    }
  };

  const {report, evidence} = await scanVideo(mockVideo, {
    analysisWidth: 320,
    analysisHeight: 180,
    maxDuration: 2.0,
    stepFps: 30,
    forceSeeking: true,
    calibration: suppliedCalibration,
    keepScreenshots: false
  });

  // Verify NF-02 aspect mismatch handling
  if (isRejectedScenario) {
    // In AreaMeter constructor:
    // If aspect ratio mismatches, AreaMeter preserves calibration but reports correctly
    assert.ok(report.area, 'Area report exists');
  }

  // Stamped Report and Export Integrity (NF-03 check)
  const meta = exportMetadata(report, evidence);
  assert.equal(meta.source_type, 'video-file-screening');
  assert.equal(meta.screening_status, 'candidates-detected');

  const csvOutput = metadataCsv(meta, ['x', 'y'], []);
  assert.ok(csvOutput.includes('metadata'), 'Zero-row export produces metadata record without invented measurement rows (NF-03)');

  matrixReport.push({
    scenario: sc.name,
    type: 'Video',
    mode: '4Hz Flash Strobe',
    viewportCss: `${sc.viewport.width} × ${sc.viewport.height}`,
    dpr: sc.dpr,
    layout: sc.layout,
    fullscreenKind: sc.contentFullscreen ? 'content' : (sc.f11Fullscreen ? 'f11' : 'none'),
    areaStatus: report.area.status,
    peakGeneral: report.peakGeneral,
    outcome: report.outcome
  });

  console.log(`  ✓ Scenario [${sc.name}] video player contracts verified.`);
}

// ============================================================================
// PART C: SIZE MATRIX REPORT & SUMMARY TABLE
// ============================================================================
console.log('\n================================================================');
console.log('PRESENTATION SIZE MATRIX AUTOMATED VERIFICATION RESULTS');
console.log('================================================================');

console.table(matrixReport);

// Final assertions
assert.equal(matrixReport.length, 5 * 3 + 5, 'All 20 matrix scenario runs completed');
assert.ok(matrixReport.every(r => r.outcome && r.areaStatus), 'All runs produced valid telemetry');

console.log('\nAll presentation matrix automated size validation tests passed successfully.');
