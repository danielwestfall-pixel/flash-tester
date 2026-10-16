import {Analyzer,color} from './analyzer.mjs';
import {Evidence} from './evidence.mjs';
export const examples=[
  {id:'static',title:'Pass example · static gray',hz:0,a:[128,128,128],b:[128,128,128],expectation:'Passes SC 2.3.1: no transitions or flashes.',fail:false},
  {id:'two',title:'Pass example · 2 flashes / second',hz:2,a:[0,0,0],b:[255,255,255],expectation:'Passes the frequency branch: two complete flashes per second, below the limit of more than three.',fail:false},
  {id:'low',title:'Pass example · small luminance change',hz:4,a:[100,100,100],b:[110,110,110],expectation:'Passes these flash thresholds: ΔY is below 0.10 and neither state is saturated red, despite four cycles per second.',fail:false},
  {id:'four',title:'Fail example · 4 black/white flashes / second',hz:4,a:[0,0,0],b:[255,255,255],expectation:'Expected failure when the flashing region exceeds the WCAG area threshold: four general flashes per second, ΔY=1.00000. Use the large live field at the reference viewing setup.',fail:true},
  {id:'red',title:'Fail example · 4 red/cyan flashes / second',hz:4,a:[255,0,0],b:[0,255,255],expectation:'Expected failure when the flashing region exceeds the WCAG area threshold: four general and red candidates per second. One state is saturated red.',fail:true}
];
export function exampleValues(example){const a=color(...example.a),b=color(...example.b);return {a,b,delta:Math.abs(a.y-b.y),chromaDistance:Math.hypot(a.u-b.u,a.v-b.v)};}
export function exampleState(example,t){return example.hz&&Math.floor((t+1e-9)*example.hz*2)%2?example.b:example.a;}
export function syntheticExample(example,snapshot){
  const width=64,height=36,analyzer=new Analyzer(width,height),evidence=new Evidence(width,height);
  const rgba=new Uint8ClampedArray(width*height*4);
  for(let i=0;i<=360;i++){
    const t=i/120,rgb=exampleState(example,t);
    for(let k=0;k<rgba.length;k+=4){rgba[k]=rgb[0];rgba[k+1]=rgb[1];rgba[k+2]=rgb[2];rgba[k+3]=255;}
    const result=analyzer.push(rgba,t);evidence.push(rgba,t,result,()=>snapshot(rgb));
  }
  return {...analyzer.report(),createdAt:new Date().toISOString(),criterion:'WCAG 2.2 SC 2.3.1 (Level A)',
    reference:`Synthetic fixture: ${example.title}`,interactions:example.expectation,
    synthetic:true,fixture:{...example,values:exampleValues(example)},viewport:{width,height},
    requestedSeconds:3,endedBecause:'Synthetic 3-second sequence complete',captureSettings:{source:'Generated frames, 120 fps'},
    evidence:evidence.report(),scope:'Synthetic uniform-color frame sequence only. Does not validate browser capture, display timing or physical flash area.'};
}
