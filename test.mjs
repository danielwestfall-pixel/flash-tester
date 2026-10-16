import assert from 'node:assert/strict';
import {Analyzer,color} from './dist/analyzer.mjs';
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
assert.ok(Math.abs(color(255,255,255).y-1)<1e-9,'Linear sRGB luminance');
assert.equal(new Analyzer(1,1).report().outcome,'Insufficient capture');
const a=new Analyzer(1,1);a.push([0,0,0,255],0);a.push([255,255,255,255],.2);a.push([0,0,0,255],.2);
assert.equal(a.frames,2,'Duplicate timestamps ignored');
assert.ok(Math.abs(a.report().maxFrameGapSeconds-.2)<1e-9,'Gaps recorded');
assert.throws(()=>a.push([],1),/Frame size/);
// Independent spatial phases should not invent flashes by averaging the image.
const b=new Analyzer(2,1);for(let i=0;i<=120;i++){const v=i%20<10?0:255;b.push([v,v,v,255,255-v,255-v,255-v,255],i/120);}
assert.ok(b.report().peakGeneral>3,'Opposing regions remain detectable');
console.log('Analyzer checks passed');
