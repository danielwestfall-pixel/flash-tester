import { spawnSync } from 'child_process';

const testSuites = [
  { name: 'Core Analyzer Checks', script: 'test.mjs' },
  { name: 'Core UI Contracts & Warnings', script: 'test-ui.mjs' },
  { name: 'Historical Regressions (NF-01..03)', script: 'test-regressions.mjs' },
  { name: 'Synthetic Fixtures & Luminance', script: 'test-fixtures.mjs' },
  { name: 'Fixture UI Contracts & Warnings', script: 'test-fixtures-ui.mjs' },
  { name: 'Area Geometry & Reference Limits', script: 'test-area.mjs' },
  { name: 'Image Sequences & Fit Modes', script: 'test-image-sequence.mjs' },
  { name: 'Image Sequence UI & Trajectories', script: 'test-image-ui.mjs' },
  { name: 'Video Scanning & Magic Signatures', script: 'test-video.mjs' },
  { name: 'Video UI Contracts & Lifecycle', script: 'test-video-ui.mjs' },
  { name: 'Audit Repairs & Dual-Phase Logic', script: 'test-audit-repairs.mjs' },
  { name: 'Passing Controls & Non-Flashing Baselines', script: 'test-passing-suite.mjs' },
  { name: 'WCAG 2.2 AAA Criteria (SC 2.3.2 / 2.3.3)', script: 'test-criteria.mjs' },
  { name: 'Detector Boundaries & Red Chromaticity', script: 'test-detector-boundaries.mjs' },
  { name: 'Red-Team Adversarial Fuzzing Audit', script: 'test-redteam-audit.mjs' },
  { name: 'Temporal Area Overlap & Moving Flashes', script: 'test-temporal-area.mjs' },
  { name: 'Presentation Matrix (20 Automated Runs)', script: 'test-presentation-matrix.mjs' },
  { name: 'Reference Geometry (1024x768) & F11 Scale', script: 'test-reference-geometry.mjs' },
];

console.log('='.repeat(70));
console.log('FLASH REVIEW: COMPREHENSIVE AUTOMATED TEST SUITE RUNNER');
console.log(`Running all ${testSuites.length} test suites sequentially...`);
console.log('='.repeat(70));

const results = [];
let allPassed = true;

for (let i = 0; i < testSuites.length; i++) {
  const { name, script } = testSuites[i];
  const num = (i + 1).toString().padStart(2, '0');
  process.stdout.write(`[${num}/${testSuites.length}] Running ${name} (${script})... `);
  
  const startTime = Date.now();
  const res = spawnSync(process.execPath, [script], { stdio: 'pipe', encoding: 'utf-8' });
  const durationMs = Date.now() - startTime;
  
  if (res.status === 0) {
    console.log(`PASSED (${durationMs}ms)`);
    results.push({ id: num, name, script, status: 'PASS', durationMs });
  } else {
    console.log(`FAILED (Exit Code ${res.status})`);
    console.error(res.stderr || res.stdout);
    results.push({ id: num, name, script, status: 'FAIL', durationMs });
    allPassed = false;
  }
}

console.log('='.repeat(70));
console.log('TEST EXECUTION SUMMARY');
console.log('='.repeat(70));
console.table(results);

if (allPassed) {
  console.log(`\nALL ${testSuites.length} TEST SUITES PASSED CLEANLY (100% PASS RATE).`);
  process.exit(0);
} else {
  console.error('\nONE OR MORE TEST SUITES FAILED.');
  process.exit(1);
}
