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
console.log(`Erased-region area bound passed: true ${trueArea.toFixed(1)}, lit ${pc.cssPixelsLit.toFixed(1)}, upper ${pc.cssPixelsUpperBound.toFixed(1)} CSS px² (generated frames).`);
