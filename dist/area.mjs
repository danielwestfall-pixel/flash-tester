export const MODULE_BUILD='flash-review-0.5.1-20261018';
(globalThis.flashReviewModules??={})['area']=MODULE_BUILD;
// Conservative spatial screening in the WCAG reference viewing geometry.
export const FIELD={width:341,height:256,limit:21824};
export const AREA_ALGORITHM='flash-screen-0.5.1';
// Supplied calibration that was never applied (rejected geometry, or no
// analyzed frames) must not be reported as missing input.
export function unappliedArea(calibration,reason,observedSourcePixels=null){
  return {status:observedSourcePixels?'calibration-rejected':'not-evaluated',calibration:{cssWidth:calibration.cssWidth,cssHeight:calibration.cssHeight},
    reason,observedSourcePixels,referenceField:FIELD,peakCompletion:null,peakEnvelope:null,
    limitations:['Supplied calibration was retained for provenance only; no area was measured.']};
}
export function areaSummary(area){
  if(area?.status==='calibration-rejected')return `Flash area not evaluated: supplied calibration ${area.calibration.cssWidth} × ${area.calibration.cssHeight} CSS pixels was rejected. ${area.reason}`;
  if(area?.status!=='calibrated-screening'&&area?.calibration)return `Flash area not evaluated: supplied calibration ${area.calibration.cssWidth} × ${area.calibration.cssHeight} CSS pixels was not applied. ${area.reason}`;
  if(area?.status!=='calibrated-screening')return 'Flash area not evaluated: displayed CSS dimensions were not supplied.';
  const completion=area.peakCompletion?.cssPixelsUpperBound??0,envelope=area.peakEnvelope?.cssPixelsUpperBound??0;
  const lit=v=>v==null?'':` (lit cells ${v.toFixed(1)})`;
  return `Calibrated sampled area: largest same-sample pair completion ≤ ${completion.toFixed(1)} CSS px²${lit(area.peakCompletion?.cssPixelsLit)}; rolling spatial envelope ≤ ${envelope.toFixed(1)} CSS px²${lit(area.peakEnvelope?.cssPixelsLit)} within the reference field (limit ${FIELD.limit}). ${envelope>FIELD.limit?'The envelope bound exceeds the reference limit; this alone is not a concurrent-area failure.':'The envelope bound is below the reference limit for the flashes that were sampled. Flashes erased by downsampling (for example regions covering less than about half of an analysis cell) are not included, so this does not show that the flashing area is below the limit.'} Calibration ${area.calibration.cssWidth} × ${area.calibration.cssHeight} CSS pixels. Red evaluation, temporal overlap and fine-pattern exceptions remain incomplete.`;
}
export class AreaMeter{
  constructor(width,height,calibration){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1)throw Error('Invalid area grid');
    const {cssWidth,cssHeight}=calibration??{};
    if(!Number.isFinite(cssWidth)||!Number.isFinite(cssHeight)||cssWidth<=0||cssHeight<=0||cssWidth>100000||cssHeight>100000)throw Error('Provide positive displayed CSS dimensions');
    this.width=width;this.height=height;this.calibration={cssWidth,cssHeight};
    this.dx=cssWidth/width;this.dy=cssHeight/height;
    // Include cells touching a field with an arbitrary sub-cell origin. This
    // deliberately overestimates at reduced resolution. Native 1-CSS-pixel
    // grids have exact integer-position windows.
    this.fw=Math.min(width,Math.ceil(FIELD.width/this.dx)+(Number.isInteger(FIELD.width/this.dx)?0:1));
    this.fh=Math.min(height,Math.ceil(FIELD.height/this.dy)+(Number.isInteger(FIELD.height/this.dy)?0:1));
    this.prefix=new Uint32Array((width+1)*(height+1));this.dilated=new Uint8Array(width*height);
    this.lastPair=new Float64Array(width*height);this.lastPair.fill(-Infinity);this.lastAny=new Float64Array(width*height);this.lastAny.fill(-Infinity);
    this.envelope=new Uint8Array(width*height);this.peakCompletion=null;this.peakEnvelope=null;this.lastTime=null;
  }
  // Flagged cells alone are not an upper bound: a partially covered edge cell can
  // blend (or be point-sampled) below the flash threshold, so a region can extend
  // up to one cell beyond its lit cells. Mask value 1 is a general/red completion;
  // value 2 is a frequency-qualified low-contrast (>= 0.05) completion, which catches
  // regions that blend below 0.10 because they half-cover cells. The upper bound
  // counts both, dilated by one cell (8-neighbourhood). Lit values count value 1 only.
  // Regions that blend below 0.05 everywhere can still be missed entirely.
  measure(mask){
    if(mask.length!==this.width*this.height)throw Error('Area mask size changed');
    const w=this.width,h=this.height,d=this.dilated;d.fill(0);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(mask[y*w+x])
      for(let j=Math.max(0,y-1);j<=Math.min(h-1,y+1);j++)for(let i=Math.max(0,x-1);i<=Math.min(w-1,x+1);i++)d[j*w+i]=1;
    const lit=this.window(mask,1),upper=this.window(d);
    const cssPixelsLit=Math.min(FIELD.width*FIELD.height,lit.max*this.dx*this.dy);
    const cssPixelsUpperBound=Math.min(FIELD.width*FIELD.height,upper.max*this.dx*this.dy);
    return {cssPixelsUpperBound,cssPixelsLit,aboveReferenceLimit:cssPixelsUpperBound>FIELD.limit,litAboveReferenceLimit:cssPixelsLit>FIELD.limit,
      fieldFractionUpperBound:cssPixelsUpperBound/(FIELD.width*FIELD.height),
      totalSampledCssPixels:lit.total*this.dx*this.dy,
      fieldOriginCss:{x:upper.bx*this.dx,y:upper.by*this.dy},sampleCells:lit.max,upperBoundCells:upper.max,lowContrastCells:mask.reduce((n,v)=>n+(v===2),0)};
  }
  empty(){return {cssPixelsUpperBound:0,cssPixelsLit:0,aboveReferenceLimit:false,litAboveReferenceLimit:false,fieldFractionUpperBound:0,totalSampledCssPixels:0,fieldOriginCss:{x:0,y:0},sampleCells:0,upperBoundCells:0,lowContrastCells:0};}
  window(mask,only=0){
    const w=this.width,h=this.height,p=this.prefix,stride=w+1;p.fill(0);
    let total=0;
    for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){const n=(only?mask[y*w+x]===only:mask[y*w+x])?1:0;row+=n;total+=n;p[(y+1)*stride+x+1]=p[y*stride+x+1]+row;}}
    let max=0,bx=0,by=0;
    for(let y=0;y<=h-this.fh;y++)for(let x=0;x<=w-this.fw;x++){
      const n=p[(y+this.fh)*stride+x+this.fw]-p[y*stride+x+this.fw]-p[(y+this.fh)*stride+x]+p[y*stride+x];
      if(n>max){max=n;bx=x;by=y;}
    }
    return {max,bx,by,total};
  }
  push(mask,time){
    if(!Number.isFinite(time)||(this.lastTime!==null&&time<=this.lastTime))throw Error('Area timestamps must increase');
    if(mask.length!==this.lastPair.length)throw Error('Area mask size changed');
    this.lastTime=time;
    let any=false,changed=!this.lastEnvelope;
    for(let i=0;i<mask.length;i++){if(mask[i]){any=true;if(mask[i]===1)this.lastPair[i]=time;this.lastAny[i]=time;}
      const e=this.lastPair[i]>time-1?1:this.lastAny[i]>time-1?2:0;if(e!==this.envelope[i]){this.envelope[i]=e;changed=true;}}
    // Measuring is the costly step: skip it for an empty completion mask and for an
    // envelope that did not change since the previous sample (results are identical).
    const completion={...(any?this.measure(mask):this.empty()),time};
    if(changed)this.lastEnvelope=this.measure(this.envelope);
    const envelope={...this.lastEnvelope,time};
    if(!this.peakCompletion||completion.cssPixelsUpperBound>this.peakCompletion.cssPixelsUpperBound)this.peakCompletion=completion;
    if(!this.peakEnvelope||envelope.cssPixelsUpperBound>this.peakEnvelope.cssPixelsUpperBound)this.peakEnvelope=envelope;
    return {completion,envelope};
  }
  report(){return {status:'calibrated-screening',calibration:this.calibration,referenceField:FIELD,
    method:'Sample-aligned general/experimental-red pair completions; conservative union of completed-pair locations in the preceding rolling second. Upper bounds count flagged and frequency-qualified low-contrast (>= 0.05) cells dilated by one cell; lit-cell values count general/red flagged cells only.',
    peakCompletion:this.peakCompletion,peakEnvelope:this.peakEnvelope,
    spatialResolutionCss:{width:this.dx,height:this.dy},
    limitations:['The rolling envelope is a spatial upper bound on observed pair locations, not concurrent flashing and not a failure verdict.',
      'Completion masks combine general and experimental-red events conservatively; no independent red-area clearance.',
      'Gradual, moving or asynchronous pairs, missed pixels/frames and fine-pattern exceptions require further evaluation.',
      'Upper bounds add one analysis cell around flagged cells, and include cells with frequent low-contrast (>= 0.05) pairs, because partially covered cells can blend below the 0.10 threshold; lit-cell values can therefore undercount. Regions that blend below 0.05 in every cell (roughly, covering less than half of each cell they touch) are not bounded.',
      'User-supplied CSS dimensions assume standard reference viewing geometry, not measured steradians. No conformance verdict.']};}
}
