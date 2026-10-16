import {FIELD} from './area.mjs';
// Shared context for standalone exports, including files with no numeric rows.
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
    area_method:report.area?.method??'Not evaluated',
    evaluation_coverage_json:JSON.stringify(report.evaluation??{conformance:'not-determined'}),
    observation_coverage_json:JSON.stringify(report.observation??null),
    evidence_coverage_json:JSON.stringify(evidence?.coverage??null),
    area_limitations_json:JSON.stringify(report.area?.limitations??[]),
    screening_limitations_json:JSON.stringify(report.limitations??[]),
    capture_settings_json:JSON.stringify(report.captureSettings??null),captured_viewport_json:JSON.stringify(report.viewport??null)
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
