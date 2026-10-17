import {areaSummary} from './area.mjs?v=0.5.0';
import {exportMetadata,startupSummary,sc232Summary} from './export-metadata.mjs?v=0.5.0';
import * as analyzerModule from './analyzer.mjs?v=0.5.0';
import * as areaModule from './area.mjs?v=0.5.0';
import * as exportModule from './export-metadata.mjs?v=0.5.0';
import * as evidenceModule from './evidence.mjs?v=0.5.0';
export const MODULE_BUILD='flash-review-0.5.0-20261017';
export const BUILD_ID='flash-review-0.5.0-20261017';
export const EXPECTED_ALGORITHM='flash-screen-0.5.0';
// Browsers can cache modules independently after an update, and a partial deploy can
// serve mixed files. Every module carries MODULE_BUILD; the measurement modules also
// carry their algorithm. Namespace imports keep a stale module from breaking linking,
// so a mismatch is reported instead. Entry pages pass their own namespaces in `extra`.
export function moduleVersionProblem(extra={}){
  const builds={analyzer:analyzerModule.MODULE_BUILD,area:areaModule.MODULE_BUILD,'export-metadata':exportModule.MODULE_BUILD,evidence:evidenceModule.MODULE_BUILD,report:MODULE_BUILD,...extra};
  const stale=Object.entries(builds).filter(([,v])=>v!==BUILD_ID).map(([k,v])=>`${k} ${v??'unversioned'}`);
  for(const [k,v] of [['analyzer algorithm',analyzerModule.ALGORITHM],['area algorithm',areaModule.AREA_ALGORITHM]])if(v!==EXPECTED_ALGORITHM)stale.push(`${k} ${v??'unversioned'}`);
  return stale.length?`Mixed Flash Review files are loaded (${stale.join(', ')}; expected ${EXPECTED_ALGORITHM} for ${BUILD_ID}). Hard-reload this page (Shift + Reload) before testing.`:null;
}
export function stampReport(report){
  return {...report,reportId:globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    buildId:BUILD_ID,sourceType:report.synthetic?'generated-frames':report.localFile?'local-file-decoded':'shared-surface-capture'};
}
export function reviewText(report){
  const synthetic=report.sourceType==='generated-frames'||report.synthetic;
  const e=report.evidence;
  return [
    'SC 2.3.1 — SCREENING REVIEW NOTES','Conformance status: Not determined',
    `Report ID: ${report.reportId}`,`Build: ${report.buildId}`,`Algorithm: ${report.algorithm}`,
    `Evidence source: ${report.sourceType} · ${synthetic?'Generated synthetic frames — no webpage was captured':'Shared surface capture; page identity is reviewer supplied'}`,
    `Structured result: ${report.status}`,`Screening result: ${report.outcome}`,`Date: ${report.createdAt}`,
    `Reference (reviewer supplied): ${report.reference||'Not supplied'}`,`Interactions / fixture expectation: ${report.interactions||'Not supplied'}`,
    `Sampled: ${report.duration.toFixed(3)} seconds; ${report.frames} frames; ${report.observedFps.toFixed(1)} observed fps; largest gap ${report.maxFrameGapSeconds.toFixed(4)} s`,
    `Observation checks: ${JSON.stringify(report.observation)}`,`Evaluation coverage: ${JSON.stringify(report.evaluation)}`,
    areaSummary(report.area),`Area measurement details: ${JSON.stringify(report.area)}`,sc232Summary(report.sc232),
    ...(report.startupSettling?[startupSummary(report.startupSettling)]:[]),...(report.sourceFile?[`Source file (reviewer supplied, decoded locally): ${JSON.stringify(report.sourceFile)}`]:[]),
    `Capture settings: ${JSON.stringify(report.captureSettings)}`,`Viewport: ${JSON.stringify(report.viewport)}`,`Analysis resolution: ${JSON.stringify(report.analysisResolution)}`,
    `Export context: ${JSON.stringify(exportMetadata(report))}`,
    `Ended: ${report.endedBecause}`,`Frame-wide peak general pairs / rolling second: ${report.peakGeneral}`,`Frame-wide peak experimental red candidates: ${report.peakRedHeuristic}`,
    ...(e?[`Selected probe: (${e.probe.x}, ${e.probe.y}); Y minimum=${e.minimum}; maximum=${e.maximum}; range=${e.range} (not a flash amplitude)`,
      `Evidence coverage: ${JSON.stringify(e.coverage)}`,`Detection witness: ${e.witness?JSON.stringify({...e.witness,trace:undefined,screenshots:undefined}):'None retained'}`,
      'Use the HTML report for static images and separate probe/witness CSV downloads for numeric traces.']:[]),
    '', 'Flagged intervals (relative seconds):',...report.windows.map(w=>`${w.start.toFixed(3)}–${w.end.toFixed(3)}; general=${w.general}; red=${w.red}; flagged sample fraction=${w.fraction}; region=${JSON.stringify(w.box)}`),
    '', 'Limitations:',...report.limitations.map(s=>`- ${s}`),'',
    synthetic?'Synthetic test note — not a VPAT observation:':'VPAT/ACR working note — requires reviewer validation:',
    synthetic?'Only generated fixture frames were analyzed. This run provides no browser capture or conformance evidence for any real webpage.':
      `A shared surface was sampled during the reviewer-described interactions. Result: ${report.outcome}. Page identity and test coverage require reviewer confirmation. General screening, experimental red evaluation, and optional calibrated area screening do not determine support for SC 2.3.1.`,
    '', 'Reference: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html'
  ].join('\n');
}
