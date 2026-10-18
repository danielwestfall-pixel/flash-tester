// Detector boundary regressions: general flash ΔY 0.10, darker state 0.80, three vs four
// flashes, rolling-window edges, gradual ramps, red saturation 0.8 and u'v' 0.2, and the
// SC 2.3.2 strict channel. Expected values are computed here with an independent
// colour implementation, not with dist/analyzer.mjs helpers. Generated frames only.
import assert from 'node:assert/strict';
import {Analyzer} from './dist/analyzer.mjs';
const lin=c=>{const s=c/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;};
const Y=([r,g,b])=>.2126*lin(r)+.7152*lin(g)+.0722*lin(b);
const uv=([r,g,b])=>{const R=lin(r),G=lin(g),B=lin(b),X=.4124564*R+.3575761*G+.1804375*B,Yv=.2126729*R+.7151522*G+.072175*B,Z=.0193339*R+.119192*G+.9503041*B,d=X+15*Yv+3*Z;return [4*X/d,9*Yv/d];};
const sat=([r,g,b])=>{const R=lin(r),G=lin(g),B=lin(b);return R/(R+G+B);};
// Uniform frames: states[i] shown from times[i]; 1x1 analysis grid, 120 fps sampling.
function run(sequence,seconds=3,fps=120,size=[1,1]){
  const a=new Analyzer(...size),px=new Uint8ClampedArray(size[0]*size[1]*4);
  for(let i=0;i<=seconds*fps;i++){const t=i/fps,c=sequence(t);for(let k=0;k<px.length;k+=4){px[k]=c[0];px[k+1]=c[1];px[k+2]=c[2];px[k+3]=255;}a.push(px,t);}
  return a.report();
}
const square=(a,b,hz,delay=0)=>t=>t<delay?a:Math.floor((t-delay+1e-9)*hz*2)%2?b:a;
// 1. General ΔY threshold: find gray levels straddling ΔY = 0.10 from black.
let below=0;while(Y([below+1,below+1,below+1])<.1)below++;const above=below+1;
assert.ok(Y([below,below,below])<.1&&Y([above,above,above])>=.1);
assert.equal(run(square([0,0,0],[below,below,below],4)).peakGeneral,0,`ΔY ${Y([below,below,below]).toFixed(5)} < 0.10 is not a general transition`);
const justAbove=run(square([0,0,0],[above,above,above],4));
assert.equal(justAbove.peakGeneral,4);assert.equal(justAbove.status,'candidates-detected',`ΔY ${Y([above,above,above]).toFixed(5)} >= 0.10 counts`);
// 2. Darker state 0.80: white against a gray whose Y is just below / at or above 0.80.
let g80=255;while(Y([g80-1,g80-1,g80-1])>=.8)g80--;const g79=g80-1;
assert.ok(Y([g79,g79,g79])<.8&&Y([g80,g80,g80])>=.8&&1-Y([g79,g79,g79])>=.1&&1-Y([g80,g80,g80])>=.1);
assert.equal(run(square([g79,g79,g79],[255,255,255],4)).peakGeneral,4,'Darker state below 0.80 counts');
const bright=run(square([g80,g80,g80],[255,255,255],4));
assert.equal(bright.peakGeneral,0,'Both states at or above 0.80: not a general flash under SC 2.3.1');
assert.equal(bright.sc232.peakPairs,4,'SC 2.3.2 strict screening has no 0.80 exemption');
assert.equal(bright.sc232.status,'candidates-detected');
// RT2-01: at reduced resolution a flash on a bright background blends above 0.80, so
// brightness-exempt frequent pairs make SC 2.3.1 inconclusive rather than "no candidates".
assert.equal(bright.status,'insufficient-observation');assert.equal(bright.windows.length,0,'Still no SC 2.3.1 candidate');
assert.ok(bright.observation.reasons.some(r=>r.startsWith('Frequent opposing changes of 0.10 or more were found where both states are at or above 0.80')));
// Below the 0.10 change the brightness rule does not apply: a bright 0.05 flicker stays "no candidates".
{let lo=255;while(1-Y([lo-1,lo-1,lo-1])<.06)lo--;const faint=run(square([lo,lo,lo],[255,255,255],4));
  assert.ok(1-Y([lo,lo,lo])<.1);assert.equal(faint.status,'inconclusive-no-candidates');assert.equal(faint.sc232.status,'inconclusive-no-candidates');}
// 2b. SC 2.3.2 keeps the 0.10 change floor: a bright pair just under 0.10 is not a strict
// pair; just over is. (A bright pair can never have its darker state above 0.90.)
{let a=255;while(1-Y([a-1,a-1,a-1])<.1)a--;const under=run(square([a,a,a],[255,255,255],4)),over=run(square([a-1,a-1,a-1],[255,255,255],4));
  assert.ok(1-Y([a,a,a])<.1&&1-Y([a-1,a-1,a-1])>=.1);
  assert.equal(under.sc232.peakPairs,0,'Strict channel ignores changes below 0.10');assert.equal(over.sc232.peakPairs,4,'Strict channel counts 0.10 bright pairs');
  const top=run(square([229,229,229],[255,255,255],4));assert.ok(Y([229,229,229])>=.78&&Y([229,229,229])<.8);}
// 2c. Observation minimums: 30 fps and a 0.10 s gap are the boundaries (tested either side; 0.10 is not exact in binary).
{const at=(fps,gap)=>{const a=new Analyzer(1,1),px=new Uint8ClampedArray([128,128,128,255]);for(let i=0;i<=fps*2;i++)a.push(px,i/fps);a.push(px,2+gap);return a.report().observation.reasons;};
  assert.ok(!at(30,1/30).some(r=>r.includes('30 fps')),'30 fps meets the minimum');assert.ok(at(29,1/29).some(r=>r.includes('below 30 fps')),'29 fps does not');
  assert.ok(!at(60,.0999).some(r=>r.includes('gap')),'A gap just under 0.10 s is allowed');assert.ok(at(60,.11).some(r=>r.includes('gap exceeded 0.1')),'A 0.11 s gap is not');}
// 3. Three vs four flashes per second, and SC 2.3.2 follows the same frequency.
const three=run(square([0,0,0],[255,255,255],3)),four=run(square([0,0,0],[255,255,255],4));
assert.deepEqual([three.peakGeneral,three.status,three.sc232.status],[3,'inconclusive-no-candidates','inconclusive-no-candidates']);
assert.deepEqual([four.peakGeneral,four.status,four.sc232.status],[4,'candidates-detected','candidates-detected']);
// 4. Rolling-window edge: four pairs starting at 0, 0.25, 0.5, 0.75 s complete within 1 s;
// stretching the burst so the fourth pair completes after 1 s from the first start avoids a flag.
function burst(starts,width){return t=>starts.some(s=>t>=s&&t<s+width)?[255,255,255]:[0,0,0];}
const inside=run(burst([1,1.25,1.5,1.75],.125),4,240),outside=run(burst([1,1.34,1.68,2.02],.125),4,240);
assert.equal(inside.peakGeneral,4,'Four pairs inside one second');assert.equal(inside.status,'candidates-detected');
assert.ok(outside.peakGeneral<=3,'Pairs spread beyond one second are not four in any rolling second');
// 5. Gradual ramps: a 0 -> 1 -> 0 luminance ramp over several frames is one excursion pair,
// even though no single frame step reaches 0.10.
const enc=y=>Math.round(255*(y<=.0031308?12.92*y:1.055*y**(1/2.4)-.055));
const ramp=hz=>t=>{const p=(t*hz)%1,y=p<.5?p*2:2-p*2;const v=enc(y);return [v,v,v];};
const r=run(ramp(4),3,240);
assert.ok(r.peakGeneral>=3,'Ramped excursions accumulate across frames');
// 6. Experimental red: saturation boundary 0.8, with u'v' distance above 0.2 and ΔY small.
function redPair(target){
  // Search a red-ish colour with a given saturation side, paired with a colour > 0.2 away in u'v' and |ΔY| < 0.1.
  for(let r=255;r>100;r--)for(let g=0;g<80;g++){const c=[r,g,0],s=sat(c);if(target==='above'?s<.8||s>.82:s>=.8||s<.78)continue;
    for(const o of [[0,r>200?110:90,0],[0,90,90],[0,80,140],[0,100,60]]){const [u1,v1]=uv(c),[u2,v2]=uv(o);if(Math.hypot(u1-u2,v1-v2)>.21&&Math.abs(Y(c)-Y(o))<.08&&sat(o)<.5)return [c,o];}}
  throw Error('no red pair found for '+target);
}
const [ra,rb]=redPair('above'),[sa,sb]=redPair('below');
// Lower edge of the red saturation band too: saturation in [0.800, 0.806) still forms red pairs.
{let found=null;for(let r=255;r>100&&!found;r--)for(let g=0;g<80&&!found;g++){const c=[r,g,0],s=sat(c);if(s<.8||s>=.806)continue;for(const o of [[0,r>200?110:90,0],[0,90,90],[0,80,140],[0,100,60]]){const [u1,v1]=uv(c),[u2,v2]=uv(o);if(Math.hypot(u1-u2,v1-v2)>.21&&Math.abs(Y(c)-Y(o))<.08&&sat(o)<.5){found=[c,o];break;}}}
  assert.ok(found,'colour near saturation 0.80');assert.equal(run(square(...found,4)).peakRedHeuristic,4,`Saturation ${sat(found[0]).toFixed(4)} counts`);}
const redAbove=run(square(ra,rb,4)),redBelow=run(square(sa,sb,4));
assert.equal(redAbove.peakRedHeuristic,4,`Saturation ${sat(ra).toFixed(3)} >= 0.8 forms red candidates`);
assert.equal(redAbove.peakGeneral,0,'Red-only pair has no general flash');
assert.equal(redBelow.peakRedHeuristic,0,`Saturation ${sat(sa).toFixed(3)} < 0.8 forms no red candidates`);
assert.equal(redAbove.sc232.status,'candidates-detected','SC 2.3.2 strict screening includes red pairs');assert.equal(redAbove.sc232.peakPairs,4,'SC 2.3.2 peak counts red pairs');
// 7. u'v' distance boundary: saturated red against colours just under / over 0.2 away.
function uvPair(side){
  const red=[255,0,0],[u0,v0]=uv(red);
  for(let g=0;g<256;g++)for(let b=0;b<256;b+=1){const c=[255,g,b],d=Math.hypot(uv(c)[0]-u0,uv(c)[1]-v0);
    if(Math.abs(Y(c)-Y(red))>=.1)continue;if(side==='below'?d>.19&&d<.2:d>.2&&d<.21)return c;}
  throw Error('no u\'v\' pair '+side);
}
const uvBelow=run(square([255,0,0],uvPair('below'),4)),uvAbove=run(square([255,0,0],uvPair('above'),4));
assert.equal(uvBelow.peakRedHeuristic,0,"u'v' distance below 0.2 forms no red candidates");
assert.equal(uvAbove.peakRedHeuristic,4,"u'v' distance above 0.2 forms red candidates");
// 8. SC 2.3.2 has no area exception: a single flashing pixel in a large grid is a strict candidate.
{const a=new Analyzer(64,48,{calibration:{cssWidth:1024,cssHeight:768}}),px=new Uint8ClampedArray(64*48*4).fill(0);
  for(let i=0;i<=360;i++){const on=Math.floor(i/15)%2;for(let k=3;k<px.length;k+=4)px[k]=255;px[0]=px[1]=px[2]=on?255:0;a.push(px,i/120);}
  const rep=a.report();assert.equal(rep.sc232.status,'candidates-detected');assert.ok(rep.area.peakEnvelope.cssPixelsUpperBound<21824,'Small area for SC 2.3.1');}
// The luminance formula stated to reviewers must match the implementation (RT-08).
{const fs=await import('node:fs'),{reportHtml}=await import('./dist/evidence.mjs');
  const html=reportHtml({...four,reportId:'x',buildId:'x',sourceType:'generated-frames',createdAt:'x',limitations:[]});
  for(const [label,text] of [['HTML report',html],['main page',fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8')]]){assert.ok(text.includes('((s+0.055)/1.055)^2.4'),`${label} states exponent 2.4`);assert.ok(!/\(\(s\+0\.055\)\/1\.055\)\^2(?!\.4)/.test(text),`${label} has no exponent-2 formula`);}}
console.log(`Threshold boundaries passed: ΔY ${Y([below,below,below]).toFixed(4)}/${Y([above,above,above]).toFixed(4)}, darker Y ${Y([g79,g79,g79]).toFixed(4)}/${Y([g80,g80,g80]).toFixed(4)}, 3/4 flashes, rolling-window edge, ramps, red saturation ${sat(sa).toFixed(3)}/${sat(ra).toFixed(3)}, u'v' 0.2, SC 2.3.2 strict channel (generated frames).`);
