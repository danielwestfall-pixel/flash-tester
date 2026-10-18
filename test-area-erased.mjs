// RT-02: near-threshold regions that half-cover analysis cells blend below 0.10 and are
// never lit; the area upper bound must still cover them. True areas are computed here
// from rectangle geometry. Generated frames (box/gamma downscale at 3.75 CSS px cells).
import assert from 'node:assert/strict';
import {Analyzer} from './dist/analyzer.mjs';
import {areaSummary} from './dist/area.mjs';
const CW=1200,CH=646,W=320,H=172,cw=CW/W,ch=CH/H;
const lin=v=>{v/=255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;};
let near=0;while(lin(near)<0.107)near++;
const ov=(a0,a1,b0,b1)=>Math.max(0,Math.min(a1,b1)-Math.max(a0,b0));
function run(regions){
  const frame=on=>{const px=new Uint8ClampedArray(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let v=0;
    for(const {r:[rx,ry,rw,rh],b} of regions)v+=on?b*ov(x*cw,(x+1)*cw,rx,rx+rw)*ov(y*ch,(y+1)*ch,ry,ry+rh)/(cw*ch):0;
    const k=(y*W+x)*4;px[k]=px[k+1]=px[k+2]=Math.round(v);px[k+3]=255;}return px;};
  const a=new Analyzer(W,H,{calibration:{cssWidth:CW,cssHeight:CH}}),off=frame(0),on=frame(1);
  for(let i=0;i<=72;i++)a.push(Math.floor(i/6)%2?on:off,i/60);  // 5 Hz for 1.2 s
  return a.report();
}
// Counterexample: a 120 x 120 square plus fourteen 1.5-cell strips at ΔY 0.107, all in one field.
const x0=300.4,y0=200.7,regions=[{r:[x0,y0,120,120],b:255}];
for(let x=Math.ceil((x0+120)/cw+3)*cw+.25*cw;x+1.5*cw<=x0+340;x+=4*cw)regions.push({r:[x,y0,1.5*cw,240],b:near});
const trueArea=regions.reduce((s,{r:[,,w,h]})=>s+w*h,0);
assert.ok(trueArea>21824&&regions.length===15,'Fixture exceeds the reference limit inside one field');
const r=run(regions),pc=r.area.peakCompletion;
assert.equal(r.status,'candidates-detected');
assert.ok(pc.cssPixelsLit<21824,'Lit cells alone undercount (the strips are never lit)');
assert.ok(pc.cssPixelsUpperBound>=trueArea,`Upper bound ${pc.cssPixelsUpperBound.toFixed(1)} covers the true ${trueArea.toFixed(1)} CSS px²`);
assert.equal(pc.aboveReferenceLimit,true);assert.ok(pc.lowContrastCells>0,'Low-contrast cells are reported');
assert.ok(!areaSummary(r.area).includes('does not exceed'),'Summary never asserts the limit is not exceeded');
// The low-contrast channel needs frequent pairs: a moving ΔY 0.068 edge (like the safe moving-bar fixture) does not inflate the bound.
const slow=new Analyzer(W,H,{calibration:{cssWidth:CW,cssHeight:CH}});
for(let i=0;i<=120;i++){const px=new Uint8ClampedArray(W*H*4);const edge=Math.floor(i*2);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=(y*W+x)*4,v=x<edge?130:110;px[k]=px[k+1]=px[k+2]=v;px[k+3]=255;}slow.push(px,i/60);}
assert.equal(slow.report().area.peakEnvelope.cssPixelsUpperBound,0,'Infrequent low-contrast changes add no area');
// RT2-01: a flash on a bright background. 4 px stripes (8 px pitch, offset 2 px) alternate
// Y 0.70 <-> 0.95 on white; each 4 px cell is half stripe, half white, so the blended darker
// state is above 0.80. Gamma box downscale 1280 x 720 -> 320 x 180.
{const CW2=1280,CH2=720,W2=320,H2=180,c2=CW2/W2;let lo=0,hi=0;while(lin(lo)<.70)lo++;while(lin(hi)<.947)hi++;
  const region=[320,180,640,360],stripes=[];for(let x=region[0]+2;x+4<=region[0]+region[2];x+=8)stripes.push([x,region[1],4,region[3]]);
  const frame=on=>{const px=new Uint8ClampedArray(W2*H2*4);for(let y=0;y<H2;y++)for(let x=0;x<W2;x++){let cov=0;for(const [sx,sy,sw,sh] of stripes)cov+=ov(x*c2,(x+1)*c2,sx,sx+sw)*ov(y*c2,(y+1)*c2,sy,sy+sh)/(c2*c2);
    const v=Math.round((on?hi:lo)*cov+255*(1-cov)),k=(y*W2+x)*4;px[k]=px[k+1]=px[k+2]=v;px[k+3]=255;}return px;};
  const a=new Analyzer(W2,H2,{calibration:{cssWidth:CW2,cssHeight:CH2}}),off=frame(0),on=frame(1);
  for(let i=0;i<=72;i++)a.push(Math.floor(i/6)%2?on:off,i/60);
  const rep=a.report(),truth=Math.floor(341/8)*4*256+Math.min(4,Math.max(0,341%8-2))*256;   // stripes inside the best 341 x 256 field
  assert.ok(truth>21824,`True area ${truth} exceeds the limit`);
  assert.notEqual(rep.status,'inconclusive-no-candidates','A blended bright-background flash is never reported as "no candidates"');
  assert.ok(rep.observation.reasons.some(r=>r.includes('both states are at or above 0.80')));
  assert.equal(rep.sc232.status,'candidates-detected');
  assert.ok(rep.area.peakEnvelope.cssPixelsUpperBound>=truth,`Upper bound ${rep.area.peakEnvelope.cssPixelsUpperBound} covers ${truth}`);}
// Low-contrast channel edges: ΔY 0.05 (a 0.045 pulse adds nothing, 0.055 does), the
// frequency gate (3 pairs per second never qualify, 4 do) and the rolling envelope.
{const Y=v=>lin(v);const level=d=>{let v=40;while(Y(v)-Y(40)<d)v++;return v;};
  function pulse(dY,hz){const W3=20,H3=20,a=new Analyzer(W3,H3,{calibration:{cssWidth:200,cssHeight:200}}),hi=level(dY);
    for(let i=0;i<=180;i++){const on=Math.floor(i/60*hz*2+1e-9)%2,px=new Uint8ClampedArray(W3*H3*4);
      for(let y=0;y<H3;y++)for(let x=0;x<W3;x++){const k=(y*W3+x)*4,v=on&&x>=5&&x<15&&y>=5&&y<15?hi:40;px[k]=px[k+1]=px[k+2]=v;px[k+3]=255;}a.push(px,i/60);}
    return a.report();}
  const below=pulse(.045,5),above=pulse(.055,5),three=pulse(.055,3),four=pulse(.055,4);
  assert.equal(below.area.peakEnvelope.cssPixelsUpperBound,0,'ΔY 0.045 adds no area');
  assert.ok(above.area.peakCompletion.cssPixelsUpperBound>=100*100,'ΔY 0.055 at 5 Hz bounds the 100 x 100 CSS px region');
  assert.ok(above.area.peakEnvelope.cssPixelsUpperBound>=above.area.peakCompletion.cssPixelsUpperBound,'Envelope includes low-contrast cells');
  assert.equal(three.area.peakEnvelope.cssPixelsUpperBound,0,'3 pairs per second do not qualify');
  assert.ok(four.area.peakEnvelope.cssPixelsUpperBound>=100*100,'4 pairs per second qualify');
  assert.equal(above.status,'inconclusive-no-candidates','Low-contrast cells never create candidates');
  // Below the limit, the summary states a bound for sampled flashes only, never "does not exceed".
  const text=areaSummary(above.area);assert.ok(text.includes('is below the reference limit for the flashes that were sampled')&&!text.includes('does not exceed'),text);}
console.log(`Erased-region area bound passed: true ${trueArea.toFixed(1)}, lit ${pc.cssPixelsLit.toFixed(1)}, upper ${pc.cssPixelsUpperBound.toFixed(1)} CSS px² (generated frames).`);
