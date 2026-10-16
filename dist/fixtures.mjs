// One Hz means one complete A -> B -> A cycle (two opposing transitions).
// Expectations describe these generated inputs, not a conformance certification.
import {color} from './analyzer.mjs';
export const fixtureSpec = {width:1024,height:768,fps:120,seconds:3,
  source:'https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html',
  fieldWidth:341,fieldHeight:256,areaLimit:21824};
const black=[0,0,0],white=[255,255,255];
const full=(id,title,hz,a=black,b=white,expected='fail')=>({id,title,hz,a,b,zone:'full',expected,candidates:hz>3,
  note:'Area expectation assumes the 1024 × 768 reference surface at its intended viewing size.'});
export const fixtures=[
  ...[5,10,15].map(hz=>full(`full-${hz}`,`Full-frame black/white · ${hz} Hz`,hz)),
  full('red-black','Saturated red / black · 10 Hz',10,[255,0,0],black),
  full('red-blue','Saturated red / blue · 10 Hz',10,[255,0,0],[0,0,255]),
  {...full('large-zone','Large 36% flashing zone · 4 Hz',4),zone:'large'},
  full('two-hz','Sub-threshold black/white · 2 Hz',2,black,white,'pass'),
  full('three-hz','Frequency boundary · 3 Hz',3,black,white,'pass'),
  {...full('requested-grays','Requested #E0E0E0 / #B0B0B0 · 10 Hz',10,[224,224,224],[176,176,176]),
    note:'Correction: linear-sRGB ΔY is about 0.253, above 0.10; darker Y is below 0.80. This is a failing full-field input.'},
  {...full('soft-gray','Corrected soft gray #B0B0B0 / #B8B8B8 · 10 Hz',10,[176,176,176],[184,184,184],'pass'),candidates:false,
    note:'Corrected pass: linear-sRGB ΔY is below 0.10; neither state is saturated red.'},
  {...full('small-zone','Small 64 × 64 white flash · 10 Hz',10,black,white,'pass'),zone:'small',
    note:'Area-based pass only at reference geometry: 4,096 pixels, below 21,824 in any 341 × 256 field. Calibrated area screening reports this separately; the app still flags frequency candidates and does not certify a pass. Do not enlarge this surface.'},
  {...full('area-trap','24% of screen is still too large · 10 Hz',10),zone:'trap',
    note:'A 492 × 384 contiguous zone covers only 24.02% of the screen but can fill a whole 341 × 256 visual field. Expected failure at reference geometry.'},
  {...full('static-control','Static black control',0,black,black,'pass'),candidates:false}
];
export function fixtureRect(f,width=fixtureSpec.width,height=fixtureSpec.height){
  const [w,h]=f.zone==='small'?[64,64]:f.zone==='large'?[Math.round(width*.6),Math.round(height*.6)]:
    f.zone==='trap'?[Math.round(width*.48),Math.round(height*.5)]:[width,height];
  return {x:Math.floor((width-w)/2),y:Math.floor((height-h)/2),width:w,height:h};
}
export function fixtureState(f,frame,fps=fixtureSpec.fps){
  return Math.floor(frame*f.hz*2/fps)%2?f.b:f.a;
}
export function fixtureInfo(f){
  const rect=fixtureRect(f),a=color(...f.a),b=color(...f.b);
  return {...f,rect,fps:fixtureSpec.fps,seconds:fixtureSpec.seconds,transitionsPerSecond:2*f.hz,
    luminanceA:a.y,luminanceB:b.y,deltaY:Math.abs(a.y-b.y),
    chromaDistance:a.valid&&b.valid?Math.hypot(a.u-b.u,a.v-b.v):null,
    screenFraction:rect.width*rect.height/(fixtureSpec.width*fixtureSpec.height),
    maxConcurrentPixelsInReferenceField:Math.min(rect.width,341)*Math.min(rect.height,256),
    appExpected:f.candidates?'candidates-detected':'inconclusive-no-candidates',
    redExpected:f.id==='red-blue'?10:0};
}
// Sample the source pixel nearest each output pixel center, without antialiasing.
// Pure source colors are preserved; this is not browser downsampling validation.
export function fixtureFrame(f,frame,width=64,height=48){
  const rgba=new Uint8ClampedArray(width*height*4),rect=fixtureRect(f),rgb=fixtureState(f,frame);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const sx=(x+.5)*fixtureSpec.width/width,sy=(y+.5)*fixtureSpec.height/height;
    const inside=sx>=rect.x&&sx<rect.x+rect.width&&sy>=rect.y&&sy<rect.y+rect.height;
    const k=(y*width+x)*4,c=inside?rgb:black;
    rgba[k]=c[0];rgba[k+1]=c[1];rgba[k+2]=c[2];rgba[k+3]=255;
  }
  return rgba;
}
