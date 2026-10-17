import {FIELD} from './area.mjs?v=0.5.0';
export const MODULE_BUILD='flash-review-0.5.0-20261017';
// Shared context for standalone exports, including files with no numeric rows.
// Shown in the capture UI and in every export: startup frames are never discarded silently.
export function startupSummary(st){
  if(!st)return '';
  const parts=[`Startup settling: ${st.discardedFrames} frame(s) over ${st.discardedMediaSeconds.toFixed(2)} s at changing or invalid sizes were discarded for area`];
  if(st.transitionalScreening.length)parts.push(`screened separately for flashing frequency (${st.transitionalScreening.length} segment(s)${st.transitionalCandidates?', CANDIDATES FOUND':', no candidates'})`);
  parts.push(`${st.analyzedStartupFrames} startup frame(s) at the final size were analyzed${st.geometryConfirmed?'':' without confirmation that the size was stable'}`);
  return parts.join('; ')+'.';
}
export function sc232Summary(s){return s?`SC 2.3.2 (Level AAA) strict screening, no area or brightness exception: ${s.outcome} (peak ${s.peakPairs} pairs per rolling second at one sampled pixel; ${s.windows.length} flagged interval(s)). Screening only.`:'SC 2.3.2 strict screening: not evaluated.';}
export function exportMetadata(report={},evidence=report.evidence){
  const calibration=report.area?.calibration??report.captureSettings?.calibration;
  return {
    report_id:report.reportId??'not-supplied',build_id:report.buildId??'not-supplied',
    source_type:report.sourceType??'not-supplied',algorithm:report.algorithm??'not-supplied',
    screening_status:report.status??'not-supplied',conformance_status:report.evaluation?.conformance??'not-determined',
    presentation_scenario:report.captureSettings?.presentation??'not-supplied',
    calibration_status:report.area?.status??'not-evaluated',
    calibration_css_width:calibration?.cssWidth??null,calibration_css_height:calibration?.cssHeight??null,
    reference_field_css_width:FIELD.width,reference_field_css_height:FIELD.height,reference_area_limit_css_px:FIELD.limit,
    area_method:report.area?.method??'Not evaluated',area_reason:report.area?.reason??'',
    area_observed_source_pixels_json:JSON.stringify(report.area?.observedSourcePixels??null),
    evaluation_coverage_json:JSON.stringify(report.evaluation??{conformance:'not-determined'}),
    observation_coverage_json:JSON.stringify(report.observation??null),
    evidence_coverage_json:JSON.stringify(evidence?.coverage??{status:'not-collected',reason:'Capture ended before luminance evidence was initialized; no measurement rows exist.'}),
    area_limitations_json:JSON.stringify(report.area?.limitations??[]),
    screening_limitations_json:JSON.stringify(report.limitations??[]),
    sc232_status:report.sc232?.status??'not-evaluated',sc232_peak_pairs:report.sc232?.peakPairs??null,sc232_json:JSON.stringify(report.sc232?{...report.sc232,windows:report.sc232.windows.length}:null),
    source_file_json:JSON.stringify(report.sourceFile??null),
    capture_settings_json:JSON.stringify(report.captureSettings??null),startup_settling_json:JSON.stringify(report.startupSettling??null),captured_viewport_json:JSON.stringify(report.viewport??null)
  };
}
export function csvCell(value){
  let s=String(value??'');
  // Preserve numeric values, but prevent metadata strings being spreadsheet formulas.
  if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;
  return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
}
export function metadataCsv(metadata,columns,rows){
  const prefix=Object.values(metadata).map(csvCell).join(',');
  const header=[...Object.keys(metadata),'record_type',...columns].map(csvCell).join(',');
  const data=rows.length?rows.map(row=>prefix+',measurement,'+row.map(csvCell).join(',')):
    [prefix+',metadata,'+columns.map(()=> '').join(',')];
  return [header,...data].join('\n');
}
