import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Analyzer} from './dist/analyzer.mjs';
import {schedule,imageAt} from './dist/image-sequence.mjs';
import {Evidence,csv,witnessCsv,reportHtml} from './dist/evidence.mjs';
import {stampReport,reviewText} from './dist/report.mjs';
import {areaSummary} from './dist/area.mjs';

const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/shuffle-orphan.json',import.meta.url)));
assert.deepEqual(schedule(fixture.count,3,fixture.rate,fixture.seed),fixture.plan);
for(const inverted of [false,true]){
  const a=new Analyzer(1,1),e=new Evidence(1,1);
  for(let i=0;i<=360;i++){
    const v=fixture.palette[imageAt(fixture.plan,i/120)],n=inverted?255-v:v,raw=Uint8ClampedArray.of(n,n,n,255);
    e.push(raw,i/120,a.push(raw,i/120),()=>null);
  }
  assert.equal(a.report().peakGeneral,4,'AI-01 frozen 32-image shuffle must detect four flashes');
  assert.equal(a.report().status,'candidates-detected');
  assert.equal(e.report().witness.pairStarts.length,4,'Witness retains one nonoverlapping phase');
}
// One unmatched transition, then a plateau and a finite burst. Window-local
// counts must be independent of the orphan and must not double-count phases.
for(const hz of [3,4])for(const delay of [1,2,10])for(const invert of [false,true])for(const red of [false,true]){
  const a=new Analyzer(1,1);
  for(let i=0;i<=(delay+1)*120;i++){
    const t=i/120,local=t-delay;
    let high=t<.125||(local>=0&&local<1&&Math.floor((local+1e-9)*2*hz)%2===0);
    if(invert)high=!high;
    const c=red?(high?[255,0,0]:[0,148,0]):(high?[255,255,255]:[0,0,0]);
    a.push([...c,255],t);
  }
  const r=a.report();assert.equal(red?r.peakRedHeuristic:r.peakGeneral,hz,`${hz}Hz/orphan/delay${delay}/invert${invert}/red${red}`);
  assert.equal(r.windows.length>0,hz===4);
}

// Independent RFC 4180 reader: metadata JSON contains commas and quotes;
// hostile labels also include newlines and must not split numeric records.
function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
  row.push(cell);rows.push(row);assert.equal(quoted,false);return rows;
}
const a=new Analyzer(1,1,{calibration:{cssWidth:1024,cssHeight:1024}}),e=new Evidence(1,1);
for(let i=0;i<=120;i++){const raw=Uint8ClampedArray.of(0,0,0,255);e.push(raw,i/120,a.push(raw,i/120),()=>null);}
const report=stampReport({...a.report(),evidence:e.report(),captureSettings:{presentation:'browser-fullscreen',calibration:{cssWidth:1024,cssHeight:1024}},viewport:{width:2048,height:2048},createdAt:'test'});
for(const [format,content] of [['probe',csv(report.evidence,report)],['empty witness',witnessCsv(report.evidence,report)]]){
  const [header,...rows]=parseCsv(content),first=Object.fromEntries(header.map((k,i)=>[k,rows[0][i]]));
  assert.ok(rows.every(row=>row.length===header.length),`${format}: equal column counts`);
  assert.equal(first.presentation_scenario,'browser-fullscreen');assert.equal(first.build_id,report.buildId);
  assert.equal(first.calibration_css_width,'1024');assert.equal(first.calibration_css_height,'1024');
  assert.equal(first.reference_area_limit_css_px,'21824');assert.equal(first.calibration_status,'calibrated-screening');
  assert.equal(JSON.parse(first.evaluation_coverage_json).conformance,'not-determined');
  assert.equal(JSON.parse(first.evidence_coverage_json).rows,121);
  assert.ok(JSON.parse(first.area_limitations_json).length>0);
  assert.equal(first.record_type,format==='empty witness'?'metadata':'measurement');
  if(format==='empty witness')assert.equal(first.time_seconds,'','No invented witness measurements');
}
for(const value of ['default','maximized','browser-fullscreen','content-fullscreen','responsive-small','browser-fullscreen,\n"<script>bad</script>"']){
  const r={...report,captureSettings:{...report.captureSettings,presentation:value}};
  const html=reportHtml(r);assert.ok(html.includes('Presentation scenario:'));assert.ok(!html.includes('<script>bad'));
  const [header,row]=parseCsv(witnessCsv(r.evidence,r));assert.equal(row[header.indexOf('presentation_scenario')],value);
  assert.ok(reviewText(r).includes('presentation_scenario'));
}
const empty=new Evidence(1,1).report();
assert.equal(parseCsv(csv(empty,report))[1].includes('metadata'),true,'Zero-row probe export retains metadata');

// NF-02 / NF-03: Zero-frame calibration rejection preserves mismatch status,
// attempted geometry, and supplies metadata-only CSV downloads without evidence.
const rejectedArea = {
  status: 'rejected',
  reason: 'Area calibration aspect ratio does not match the shared surface; area not evaluated.',
  calibration: {cssWidth: 1264, cssHeight: 445},
  observedDimensions: {width: 1922, height: 762},
  method: 'Not evaluated'
};
const rejectedAnalyzer = new Analyzer(0, 0, {area: rejectedArea});
const rejectedReport = stampReport({
  ...rejectedAnalyzer.report(),
  captureSettings: {presentation: 'maximized', calibration: {cssWidth: 1264, cssHeight: 445}},
  endedBecause: 'Area calibration aspect ratio does not match the shared surface; correct CSS dimensions and start a new capture',
  viewport: {width: 1922, height: 762},
  createdAt: 'test'
});
assert.equal(rejectedReport.area.status, 'rejected');
assert.equal(rejectedReport.area.reason, 'Area calibration aspect ratio does not match the shared surface; area not evaluated.');
assert.deepEqual(rejectedReport.area.calibration, {cssWidth: 1264, cssHeight: 445});
assert.deepEqual(rejectedReport.area.observedDimensions, {width: 1922, height: 762});
assert.deepEqual(rejectedReport.viewport, {width: 1922, height: 762});
assert.ok(!areaSummary(rejectedReport.area).includes('not supplied'), 'Area summary must not claim dimensions were not supplied');
assert.ok(areaSummary(rejectedReport.area).includes('aspect ratio'), 'Area summary preserves aspect mismatch explanation');

for (const [format, content] of [['probe', csv(rejectedReport.evidence, rejectedReport)], ['witness', witnessCsv(rejectedReport.evidence, rejectedReport)]]) {
  const [header, ...rows] = parseCsv(content), first = Object.fromEntries(header.map((k, i) => [k, rows[0][i]]));
  assert.equal(rows.length, 1, `${format}: exactly one metadata row`);
  assert.ok(rows.every(row => row.length === header.length), `${format}: equal column count`);
  assert.equal(first.record_type, 'metadata', `${format}: record_type is metadata`);
  assert.equal(first.calibration_status, 'rejected');
  assert.equal(first.calibration_css_width, '1264');
  assert.equal(first.calibration_css_height, '445');
  assert.deepEqual(JSON.parse(first.captured_viewport_json), {width: 1922, height: 762});
  assert.equal(first.time_seconds, '', `${format}: no invented measurements`);
}

console.log('AI-01, AI-03, NF-02, and NF-03 regressions passed: both pairing phases, frozen shuffle, three/four boundaries, red orphan cases, zero-frame calibration mismatch status/geometry, and metadata-only CSV exports without evidence.');
