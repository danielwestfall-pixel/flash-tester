import {areaSummary} from './area.mjs';
import {exportMetadata} from './export-metadata.mjs';
export const BUILD_ID='flash-review-0.4.3-20261019';
export function stampReport(report){
  return {...report,reportId:globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
    buildId:BUILD_ID,sourceType:(report.sourceType&&report.sourceType!=='generated-frames')?report.sourceType:(report.synthetic?'generated-frames':'shared-surface-capture')};
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
    areaSummary(report.area),`Area measurement details: ${JSON.stringify(report.area)}`,
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
