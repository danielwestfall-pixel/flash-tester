// File-analysis sampling plans (video seek grid, animated-image timelines, browser
// display timing, loop seams) with independently computed expectations. Generated
// frames only; native decoding is verified by tools/verify-file-analysis.mjs.
import assert from 'node:assert/strict';
import {fileKind,imageType,videoSampleTimes,frameSeconds,playsFor,animationSamples} from './dist/file-source.mjs';
import {Analyzer} from './dist/analyzer.mjs';
assert.equal(fileKind({type:'video/mp4',name:'a.mp4'}),'video');assert.equal(fileKind({type:'',name:'clip.WEBM'}),'video');
assert.equal(fileKind({type:'image/gif',name:'a.gif'}),'image');assert.equal(fileKind({type:'',name:'a.apng'}),'image');assert.equal(fileKind({type:'image/jpeg',name:'a.jpg'}),null);
assert.equal(imageType({type:'image/apng'}),'image/png');assert.equal(imageType({type:'',name:'x.webp'}),'image/webp');
// Video grid: 4 s at 60 Hz -> 240 mid-frame samples at (k + 0.5) / 60.
const v=videoSampleTimes(4,60,30);assert.equal(v.times.length,240);assert.equal(v.times[0],1/120);assert.ok(Math.abs(v.times.at(-1)-(239.5/60))<1e-12);assert.equal(v.truncated,false);
const long=videoSampleTimes(100,30,10);assert.equal(long.times.length,300);assert.equal(long.truncated,true);
assert.throws(()=>videoSampleTimes(4,0,30));
// Display model: frames that specify <= 10 ms are shown for 100 ms; encoded keeps the value (1 ms floor).
assert.deepEqual(frameSeconds([0,10000,10001,120000],'display'),[.1,.1,.010001,.12]);
assert.deepEqual(frameSeconds([0,10000,120000],'encoded'),[.001,.01,.12]);
// repetitionCount counts repeats: 0 -> 1 play, 2 -> 3 plays; infinite loops fill the limit (at least 2 plays).
assert.equal(playsFor(0,1,30),1);assert.equal(playsFor(2,1,30),3);assert.equal(playsFor(Infinity,.24,30),125);assert.equal(playsFor(Infinity,100,30),2);
// Timeline: every frame start is sampled, holds every 1/60 s, final sample at the end.
const plan=animationSamples([.12,.12],2,30);
assert.deepEqual(plan.samples.filter(s=>s.time===0||s.time===.12||s.time===.24||s.time===.36).map(s=>[s.frame,s.play,s.time]),[[0,0,0],[1,0,.12],[0,1,.24],[1,1,.36]]);
assert.equal(plan.samples.at(-1).time,.48);assert.equal(plan.samples.at(-1).final,true);assert.ok(plan.samples.every((s,i,a)=>!i||s.time>a[i-1].time));
assert.ok(Math.max(...plan.samples.slice(1).map((s,i)=>s.time-plan.samples[i].time))<=1/60+1e-9,'Holds keep sampling at 60 Hz or denser');
const cut=animationSamples([.5],100,2);assert.equal(cut.truncated,true);assert.ok(cut.samples.at(-1).time<2);
// Analyzer over timelines (independent expectation: two 120 ms frames alternate 4.17 times/s).
function analyze(frames,durationsUs,repetitionCount,model='display',max=10){
  const seconds=frameSeconds(durationsUs,model),{samples}=animationSamples(seconds,playsFor(repetitionCount,seconds.reduce((a,b)=>a+b,0),max),max);
  const a=new Analyzer(1,1);for(const s of samples){const c=frames[s.frame];a.push(new Uint8ClampedArray([c,c,c,255]),s.time);}return a.report();
}
const seamLoop=analyze([0,255],[120000,120000],Infinity),seamOnce=analyze([0,255],[120000,120000],0);
assert.equal(seamLoop.peakGeneral,4,'Flashing across the loop seam is detected');assert.equal(seamLoop.status,'candidates-detected');
assert.equal(seamOnce.peakGeneral,0,'The same frames played once do not flash');
const fastDisplay=analyze([0,255],[10000,10000],Infinity,'display'),fastEncoded=analyze([0,255],[10000,10000],Infinity,'encoded');
assert.equal(fastDisplay.peakGeneral,5,'10 ms frames shown for 100 ms: 5 flashes/s');assert.equal(fastEncoded.peakGeneral,50,'As encoded: 50 flashes/s');
const twoHz=analyze([0,255],[250000,250000],Infinity);assert.equal(twoHz.peakGeneral,2);assert.equal(twoHz.status,'inconclusive-no-candidates');
console.log('File sources passed: video seek grid, display/encoded timing, loop counts, loop seams and timelines (generated frames).');
