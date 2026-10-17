import assert from 'node:assert/strict';
import {Analyzer} from './dist/analyzer.mjs';
import {Evidence,csv,witnessCsv,reportHtml} from './dist/evidence.mjs';
import {examples,syntheticExample} from './dist/examples.mjs';
import {reviewText,stampReport} from './dist/report.mjs';
function series(fn,seconds,fps=120){const a=new Analyzer(1,1);for(let i=0;i<=seconds*fps;i++)a.push([...fn(i/fps),255],i/fps);return a.report();}
const gray=v=>[v,v,v],pulse=(t,hz=4)=>gray(Math.floor((t+1e-9)*hz*2)%2?255:0);
// F1: finite bursts after plateaus, opposite polarity, duty cycle and phase.
for(const delay of [0,2,10])for(const inverted of [false,true])for(const duty of [.25,.5,.75]){
  const r=series(t=>{const local=t-delay;const value=local<0||local>=1?0:((local*4)%1)>=duty?255:0;return gray(inverted?255-value:value);},delay+1);
  assert.equal(r.peakGeneral,4,`Delayed burst ${delay}/${inverted}/${duty}`);
}
for(const phase of [0,.037,.1]){
  assert.equal(series(t=>pulse(t+phase,3),3).peakGeneral,3,'Three-flash frequency boundary');
  assert.equal(series(t=>pulse(t+phase,4),3).peakGeneral,4,'Four-flash frequency boundary');
}
// F2: gradual, constant-luminance red excursions now accumulate into candidates.
const smooth=syntheticExample(examples.find(e=>e.id==='smooth-red'),()=>null);
assert.equal(smooth.peakGeneral,0);assert.equal(smooth.peakRedHeuristic,4);
assert.equal(smooth.evaluation.red,'experimental-incomplete','Improved candidates are not red conformance clearance');
assert.equal(smooth.evaluation.area,'not-evaluated');
// F3: provenance and IDs are consistent in all generated output formats.
const txt=reviewText(smooth);
assert.ok(txt.includes('no webpage was captured'));assert.ok(!txt.includes('A browser capture'));
assert.ok(!txt.includes('VPAT/ACR working note'));
for(const output of [txt,reportHtml(smooth),csv(smooth.evidence,smooth),witnessCsv(smooth.evidence,smooth)]){
  assert.ok(output.includes(smooth.reportId),'Stable common report ID');
  assert.ok(output.includes(smooth.sourceType),'Source type in every export');
}
assert.ok(reviewText(stampReport({...smooth,synthetic:false})).includes('A shared surface was sampled'));
// F4: selected probe stays static; witness trace and images belong to flashing pixel.
const a=new Analyzer(2,1),e=new Evidence(2,1,100,50);
for(let i=0;i<=240;i++){
  const v=pulse(i/120)[0],rgba=new Uint8ClampedArray([v,v,v,255,128,128,128,255]);
  const f=a.push(rgba,i/120);e.push(rgba,i/120,f,h=>h?'data:image/png;base64,HISTORY':null);
}
const ev=e.report();assert.equal(ev.range,0);assert.equal(ev.witness.x,0);assert.equal(ev.probe.x,1);
assert.ok(ev.witness.trace.some(r=>r.luminance===0)&&ev.witness.trace.some(r=>r.luminance===1));
assert.equal(ev.witness.completeWindowRetained,true);assert.equal(ev.witness.latestPair.states.length,3);
assert.equal(ev.witness.screenshots.length,3);assert.equal(ev.witness.general,4);
assert.ok(csv(ev).includes('frame_wide_max_general'));assert.ok(witnessCsv(ev).includes('witness_Y'));
// A capped witness window must say it is incomplete instead of inventing history.
const tiny=new Evidence(2,1,50,50,{maxHistoryBytes:8});const b=new Analyzer(2,1);
for(let i=0;i<=120;i++){const v=pulse(i/120)[0],raw=new Uint8ClampedArray([v,v,v,255,v,v,v,255]);tiny.push(raw,i/120,b.push(raw,i/120),()=>null);}
assert.equal(tiny.report().witness.completeWindowRetained,false);
// F5: short, sparse and gapped observations cannot produce a reassuring outcome.
const short=series(t=>gray(t?255:0),.01,100);assert.equal(short.status,'insufficient-observation');
assert.ok(!short.outcome.includes('No candidates'));
const sparse=series(()=>gray(0),2,10);assert.equal(sparse.status,'insufficient-observation');
const adequate=series(()=>gray(0),2,60);assert.equal(adequate.status,'inconclusive-no-candidates');
const alias=series(t=>pulse(t,30),2,30);assert.equal(alias.peakGeneral,0);assert.ok(alias.outcome.includes('inconclusive'));
assert.equal(alias.evaluation.conformance,'not-determined');
// F6: an entire evidence span freezes consistently; adjacent deltas still use real previous input.
const capped=new Evidence(1,1,50,50,{maxRows:3});const f={luminanceMin:0,luminanceMean:0,luminanceMax:0,general:0,red:0,fraction:0};
for(let i=0;i<3;i++)capped.push(new Uint8ClampedArray([0,0,0,255]),i/60,f,()=>null);
capped.push(new Uint8ClampedArray([255,255,255,255]),3/60,f,()=>null);
const last=capped.push(new Uint8ClampedArray([255,255,255,255]),4/60,f,()=>null);
assert.equal(last.deltaYFromPrevious,0);assert.equal(capped.report().maximum,0);assert.equal(capped.report().trace.at(-1).luminance,0);
assert.equal(capped.report().coverage.end,2/60);assert.equal(capped.report().coverage.droppedFrames,2);
assert.equal(capped.report().traceTruncated,true);
assert.throws(()=>new Analyzer(1,1).push([0,0,0,255],NaN),/timestamp/);
console.log('All six audit findings: regression checks passed; aliasing remains explicitly inconclusive');
// NF-08: measurement modules carry their algorithm version; a stale cached module is reported, not mixed silently.
{const {ALGORITHM}=await import('./dist/analyzer.mjs'),{AREA_ALGORITHM}=await import('./dist/area.mjs'),rep=await import('./dist/report.mjs');
assert.equal(ALGORITHM,rep.EXPECTED_ALGORITHM);assert.equal(AREA_ALGORITHM,rep.EXPECTED_ALGORITHM);assert.equal(rep.moduleVersionProblem(),null,'Current files are consistent');}
