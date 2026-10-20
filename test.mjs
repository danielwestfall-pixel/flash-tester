import assert from 'node:assert/strict';
import {Analyzer,color} from './dist/analyzer.mjs';
import {Evidence,csv,chart,reportHtml} from './dist/evidence.mjs';
import {examples,exampleValues,syntheticExample} from './dist/examples.mjs';
function series(fn,duration=2,fps=120){const a=new Analyzer(1,1);for(let i=0;i<=duration*fps;i++)a.push([...fn(i/fps),255],i/fps);return a.report();}
const gray=v=>[v,v,v];
assert.equal(series(()=>gray(100)).peakGeneral,0,'Static frames');
assert.equal(series(t=>gray(t<1?0:255)).peakGeneral,0,'A single transition is not a flash');
const pulse=hz=>t=>gray(Math.floor(t*hz*2)%2?255:0);
assert.equal(series(pulse(3)).peakGeneral,3,'Three flashes stays at three');
assert.ok(series(pulse(4)).peakGeneral>3,'Four flashes flagged');
assert.ok(series(pulse(4)).windows.length,'Flagged intervals retained');
assert.equal(series(t=>gray(Math.floor(t*12)%2?50:45)).peakGeneral,0,'Low contrast');
assert.equal(series(t=>gray(Math.floor(t*12)%2?255:235)).peakGeneral,0,'Both luminances above 0.8');
assert.ok(series(t=>gray(Math.round(127.5*(1-Math.cos(t*2*Math.PI*5))))).peakGeneral>3,'Smooth general ramps');
assert.ok(series(t=>Math.floor(t*10)%2?[255,0,0]:[0,255,0]).peakRedHeuristic>3,'Alternating red/green');
assert.equal(series(t=>Math.floor(t*10)%2?[0,0,255]:[0,255,0]).peakRedHeuristic,0,'Non-red transitions');
assert.equal(series(pulse(.5),4).peakGeneral,0,'Slow opposing transitions do not fit a second');
assert.ok(series(pulse(3.2),3).peakGeneral>3,'RED-01: 3.2 Hz square wave flags candidates');
assert.ok(series(t=>Math.floor(t*20)%2?[230,20,0]:[200,75,0]).peakRedHeuristic>3,'RED-02: 10 Hz saturated red/orange chromatic strobe flags candidates');
assert.equal(series(t=>[Math.round(50+205*t/2),0,0],2).peakRedHeuristic,0,'TEST-04: Monotonic pure red ramp has zero red flashes');
assert.ok(Math.abs(color(255,255,255).y-1)<1e-9,'Linear sRGB luminance');
assert.equal(new Analyzer(1,1).report().status,'insufficient-observation');
const a=new Analyzer(1,1);a.push([0,0,0,255],0);a.push([255,255,255,255],.2);a.push([0,0,0,255],.2);
assert.equal(a.frames,2,'Duplicate timestamps ignored');
assert.ok(Math.abs(a.report().maxFrameGapSeconds-.2)<1e-9,'Gaps recorded');
assert.throws(()=>a.push([],1),/Frame size/);
// Independent spatial phases should not invent flashes by averaging the image.
const b=new Analyzer(2,1);for(let i=0;i<=120;i++){const v=i%20<10?0:255;b.push([v,v,v,255,255-v,255-v,255-v,255],i/120);}
assert.ok(b.report().peakGeneral>3,'Opposing regions remain detectable');
// RED-04: 10 Hz 2D counter-phase checkerboard flags candidates
const cb=new Analyzer(4,4);
for(let i=0;i<=180;i++){
  const t=i/60,isP1=Math.floor(t*20)%2===0,raw=new Uint8ClampedArray(4*4*4);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){
    const k=(y*4+x)*4,val=((x+y)%2===0)?(isP1?0:255):(isP1?255:0);
    raw[k]=raw[k+1]=raw[k+2]=val;raw[k+3]=255;
  }
  cb.push(raw,t);
}
assert.ok(cb.report().peakGeneral>3,'RED-04: 10 Hz counter-phase checkerboard detected');
console.log('Analyzer checks passed');
for(const example of examples){
  const report=syntheticExample(example,()=> 'data:image/png;base64,TEST');
  assert.equal(report.windows.length>0,example.fail,`${example.id}: expected candidate detection`);
  assert.equal(report.evidence.trace.length,361,'Every synthetic frame measured');
  assert.ok(report.evidence.screenshots.length>=3,'Initial/darkest/brightest images retained');
  assert.ok(report.evidence.screenshots.length<=4,'Bounded screenshot retention');
  if(!example.smooth)assert.ok(Math.abs(report.evidence.range-exampleValues(example).delta)<1e-9,'Probe Y range matches known colors');
  assert.equal(report.synthetic,true);
  const html=reportHtml({...report,reference:'<script>alert("x")</script>'});
  assert.ok(html.includes('&lt;script&gt;'),'Reviewer input escaped in HTML');
  assert.ok(!html.includes('<script>'),'Report is script-free');
  assert.ok(html.includes('data:image/png;base64,TEST'),'Report embeds screenshots');
  assert.ok(html.includes('<details>'),'Screenshot evidence starts collapsed');
  assert.equal(csv(report.evidence).split('\n').length,362,'CSV header plus every frame');
  assert.ok(chart(report.evidence).includes('<polyline'),'Luminance trace drawn');
}
const e=new Evidence(2,1,100,100);assert.equal(e.x,1);assert.equal(e.y,0);
const measure=new Analyzer(2,1),raw=[0,0,0,255,255,255,255,255];
const f=measure.push(raw,0);assert.equal(f.luminanceMin,0);assert.equal(f.luminanceMax,1);assert.equal(f.luminanceMean,.5);
e.push(new Uint8ClampedArray(raw),0,f,()=>null);assert.equal(e.report().screenshots.length,0,'Screenshot opt-out');
assert.equal(e.report().maximum,1,'Probe reads selected pixel');
assert.equal(e.report().trace[0].uPrime!==null,true,'White chromaticity defined');
assert.equal(color(255,0,0).saturation,1);
assert.equal(exampleValues(examples[1]).chromaDistance,null,'Black has no defined chromaticity');
assert.equal(new Evidence(1,1).report().minimum,null,'Empty evidence remains unknown');
console.log('Example expectations, luminance evidence, exports, escaping and screenshot controls passed');
