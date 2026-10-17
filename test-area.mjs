import assert from 'node:assert/strict';
import {AreaMeter,FIELD,areaSummary} from './dist/area.mjs';
import {Analyzer} from './dist/analyzer.mjs';
import {fixtures,fixtureFrame} from './dist/fixtures.mjs';
import {Evidence,csv,reportHtml} from './dist/evidence.mjs';
import {stampReport,reviewText} from './dist/report.mjs';
const calibration={cssWidth:1024,cssHeight:768};
function mask(w,h,rects){const out=new Uint8Array(w*h);for(const [x,y,rw,rh] of rects)for(let j=y;j<y+rh;j++)for(let i=x;i<x+rw;i++)out[j*w+i]=1;return out;}
const native=new AreaMeter(1024,768,calibration);
// Lit-cell values are exact on a native 1-CSS-pixel grid; upper bounds add a one-cell ring.
// Hand-computed: n lit pixels in 200-wide rows at (200,100) = 109 full rows plus n mod 200.
// Dilated: rows 99..209 at width 202 (199..400), plus row 210 over the partial row +-1.
for(const [n,upper] of [[21823,111*202+23+2],[21824,111*202+24+2],[21825,111*202+25+2]]){
  const pixels=new Uint8Array(1024*768);
  for(let i=0;i<n;i++)pixels[(100+Math.floor(i/200))*1024+200+i%200]=1;
  const r=native.measure(pixels);assert.equal(r.cssPixelsLit,n);assert.equal(r.litAboveReferenceLimit,n>21824);
  assert.equal(r.cssPixelsUpperBound,upper);assert.equal(r.aboveReferenceLimit,true,'Upper bound above limit near the boundary');
}
const lu=m=>{const r=native.measure(m);return [r.cssPixelsLit,r.cssPixelsUpperBound];};
assert.deepEqual(lu(mask(1024,768,[[900,700,64,64]])),[4096,66*66],'Edge field finds small region');
assert.deepEqual(lu(mask(1024,768,[[0,0,100,100],[140,0,100,100]])),[20000,101*101+102*101],'Nearby regions add (left/top ring clipped at frame edge)');
assert.deepEqual(lu(mask(1024,768,[[0,0,100,100],[900,0,100,100]])),[10000,102*101],'Separated regions outside one field are not globally summed');
const stagger=new AreaMeter(1024,768,calibration);
stagger.push(mask(1024,768,[[0,0,100,100]]),0);
const r=stagger.push(mask(1024,768,[[140,0,100,100]]),.5);
assert.deepEqual([r.completion.cssPixelsLit,r.completion.cssPixelsUpperBound],[10000,102*101]);
assert.deepEqual([r.envelope.cssPixelsLit,r.envelope.cssPixelsUpperBound],[20000,101*101+102*101]);
const expired=stagger.push(new Uint8Array(1024*768),1).envelope;
assert.deepEqual([expired.cssPixelsLit,expired.cssPixelsUpperBound],[10000,102*101],'Rolling envelope expires first sample');
// NF-06: at reduced resolution, partially covered edge cells can fall below the flash
// threshold (box blending) or miss the sample point (point sampling, as observed in
// Chrome's canvas downscale). The upper bound must never be below the true area.
function reducedRun(side,ox,oy,mode){
  const CW=1200,CH=646,W=320,H=172,cw=CW/W,ch=CH/H,a=new Analyzer(W,H,{calibration:{cssWidth:CW,cssHeight:CH}}),cov=new Float64Array(W*H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const ix=Math.max(0,Math.min((x+1)*cw,ox+side)-Math.max(x*cw,ox)),iy=Math.max(0,Math.min((y+1)*ch,oy+side)-Math.max(y*ch,oy));
    const cx=(x+.5)*cw,cy=(y+.5)*ch;
    cov[y*W+x]=mode==='point'?(cx>=ox&&cx<ox+side&&cy>=oy&&cy<oy+side?1:0):ix*iy/(cw*ch);}
  for(let i=0;i<=120;i++){const on=Math.floor(i/3)%2,px=new Uint8ClampedArray(W*H*4);
    for(let k=0;k<W*H;k++){const v=Math.round(255*on*cov[k]);px[k*4]=px[k*4+1]=px[k*4+2]=v;px[k*4+3]=255;}
    a.push(px,i/60);}
  return a.report().area.peakCompletion;
}
const counter=reducedRun(148,150*3.75,80*(646/172),'point');
assert.ok(counter.cssPixelsLit<21824,'Lit cells alone undercount a 148 x 148 region (the NF-06 counterexample)');
assert.ok(counter.cssPixelsUpperBound>=148*148&&counter.aboveReferenceLimit,'Upper bound covers the true 21,904 CSS px region');
let sweeps=0;
for(const mode of ['box','point'])for(const side of [35.6,100,148,150,160])for(let fx=0;fx<1;fx+=.25)for(let fy=0;fy<1;fy+=.25){
  const r=reducedRun(side,150*3.75+fx*3.75,80*(646/172)+fy*(646/172),mode);sweeps++;
  assert.ok(r.cssPixelsUpperBound>=Math.min(side*side,FIELD.width*FIELD.height)-1e-6,`${mode} ${side} (${fx},${fy}): upper ${r.cssPixelsUpperBound} < true ${side*side}`);
}
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
  if(id==='small-zone'){assert.equal(report.area.peakEnvelope.cssPixelsLit,4096);assert.equal(report.area.peakEnvelope.cssPixelsUpperBound,6*6*256,'4 x 4 cells of 16 CSS px plus a one-cell ring');assert.equal(report.status,'candidates-detected','Area never suppresses candidates');}
  if(id==='full-10')assert.equal(report.area.peakEnvelope.cssPixelsUpperBound,FIELD.width*FIELD.height);
  assert.ok(reportHtml(report).includes('Calibrated sampled area'));
  assert.ok(reviewText(report).includes('rolling spatial envelope'));
  assert.ok(csv(report.evidence,report).includes('envelope_area_css_px_upper_bound'));
  assert.ok(areaSummary(report.area).includes('Calibration 1024 × 768'));
  summary.push({id,completionLit:report.area.peakCompletion.cssPixelsLit,completionUpper:report.area.peakCompletion.cssPixelsUpperBound,envelopeUpper:report.area.peakEnvelope.cssPixelsUpperBound});
}
console.table(summary);console.log(`NF-06 upper-bound sweep: ${sweeps} reduced-resolution box/point cases never below true area.`);console.log('Area geometry, boundaries, nearby/separated/staggered masks, expiry, calibration, analyzer and exports passed.');
