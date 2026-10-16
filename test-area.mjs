import assert from 'node:assert/strict';
import {AreaMeter,FIELD,areaSummary} from './dist/area.mjs';
import {Analyzer} from './dist/analyzer.mjs';
import {fixtures,fixtureFrame} from './dist/fixtures.mjs';
import {Evidence,csv,reportHtml} from './dist/evidence.mjs';
import {stampReport,reviewText} from './dist/report.mjs';
const calibration={cssWidth:1024,cssHeight:768};
function mask(w,h,rects){const out=new Uint8Array(w*h);for(const [x,y,rw,rh] of rects)for(let j=y;j<y+rh;j++)for(let i=x;i<x+rw;i++)out[j*w+i]=1;return out;}
const native=new AreaMeter(1024,768,calibration);
for(const n of [21823,21824,21825]){
  const pixels=new Uint8Array(1024*768);
  for(let i=0;i<n;i++)pixels[(100+Math.floor(i/200))*1024+200+i%200]=1;
  const r=native.measure(pixels);assert.equal(r.cssPixelsUpperBound,n);assert.equal(r.aboveReferenceLimit,n>21824);
}
assert.equal(native.measure(mask(1024,768,[[900,700,64,64]])).cssPixelsUpperBound,4096,'Edge field finds small region');
assert.equal(native.measure(mask(1024,768,[[0,0,100,100],[140,0,100,100]])).cssPixelsUpperBound,20000,'Nearby regions add');
assert.equal(native.measure(mask(1024,768,[[0,0,100,100],[900,0,100,100]])).cssPixelsUpperBound,10000,'Separated regions outside one field are not globally summed');
const stagger=new AreaMeter(1024,768,calibration);
stagger.push(mask(1024,768,[[0,0,100,100]]),0);
const r=stagger.push(mask(1024,768,[[140,0,100,100]]),.5);
assert.equal(r.completion.cssPixelsUpperBound,10000);assert.equal(r.envelope.cssPixelsUpperBound,20000);
assert.equal(stagger.push(new Uint8Array(1024*768),1).envelope.cssPixelsUpperBound,10000,'Rolling envelope expires first sample');
assert.throws(()=>stagger.push(new Uint8Array(1),2),/size/);
assert.throws(()=>new AreaMeter(1,1,{cssWidth:NaN,cssHeight:1}),/dimensions/);
assert.equal(new Analyzer(1,1).report().evaluation.area,'not-evaluated');
const reduced=new AreaMeter(64,48,calibration);
assert.ok(reduced.measure(new Uint8Array(64*48).fill(1)).cssPixelsUpperBound<=341*256);
const tiny=new AreaMeter(10,10,{cssWidth:10,cssHeight:10});assert.equal(tiny.measure(new Uint8Array(100).fill(1)).cssPixelsUpperBound,100);
const summary=[];
for(const id of ['full-10','small-zone','large-zone','area-trap','two-hz','red-blue']){
  const f=fixtures.find(f=>f.id===id),a=new Analyzer(64,48,{calibration}),e=new Evidence(64,48);
  for(let i=0;i<=240;i++){const raw=fixtureFrame(f,i);const frame=a.push(raw,i/120);e.push(raw,i/120,frame,()=>null);}
  const report=stampReport({...a.report(),synthetic:true,evidence:e.report(),createdAt:'test',viewport:{width:1024,height:768}});
  assert.equal(report.evaluation.area,'calibrated-screening');
  assert.equal(report.evaluation.conformance,'not-determined');
  if(id==='small-zone'){assert.equal(report.area.peakEnvelope.cssPixelsUpperBound,4096);assert.equal(report.status,'candidates-detected','Area never suppresses candidates');}
  if(id==='full-10')assert.equal(report.area.peakEnvelope.cssPixelsUpperBound,FIELD.width*FIELD.height);
  assert.ok(reportHtml(report).includes('Calibrated sampled area'));
  assert.ok(reviewText(report).includes('rolling spatial envelope'));
  assert.ok(csv(report.evidence,report).includes('envelope_area_css_px_upper_bound'));
  assert.ok(areaSummary(report.area).includes('Calibration 1024 × 768'));
  summary.push({id,completion:report.area.peakCompletion.cssPixelsUpperBound,envelope:report.area.peakEnvelope.cssPixelsUpperBound});
}
console.table(summary);console.log('Area geometry, boundaries, nearby/separated/staggered masks, expiry, calibration, analyzer and exports passed.');
