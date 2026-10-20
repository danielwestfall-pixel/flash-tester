// Conservative spatial screening in the WCAG reference viewing geometry.
export const FIELD={width:341,height:256,limit:21824};
export function areaSummary(area){
  if(area?.status==='calibrated-screening'){
    const completion=area.peakCompletion?.cssPixelsUpperBound??0,envelope=area.peakEnvelope?.cssPixelsUpperBound??0;
    return `Calibrated sampled area: largest same-sample pair completion ≤ ${completion.toFixed(1)} CSS px²; rolling spatial envelope ≤ ${envelope.toFixed(1)} CSS px² within the reference field (limit ${FIELD.limit}). ${envelope>FIELD.limit?'The envelope exceeds the reference limit; this alone is not a concurrent-area failure.':'The observed envelope does not exceed the reference limit; missed events and untested states remain inconclusive.'} Calibration ${area.calibration.cssWidth} × ${area.calibration.cssHeight} CSS pixels. Red evaluation, temporal overlap and fine-pattern exceptions remain incomplete.`;
  }
  if(area?.status==='rejected'){
    return `Flash area not evaluated: ${area.reason||'area calibration was rejected.'}`;
  }
  return `Flash area not evaluated: ${area?.reason||'displayed CSS dimensions were not supplied.'}`;
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
    this.prefix=new Uint32Array((width+1)*(height+1));
    this.lastPair=new Float64Array(width*height);this.lastPair.fill(-Infinity);
    this.envelope=new Uint8Array(width*height);this.peakCompletion=null;this.peakEnvelope=null;this.lastTime=null;
  }
  measure(mask){
    if(mask.length!==this.width*this.height)throw Error('Area mask size changed');
    const w=this.width,h=this.height,p=this.prefix,stride=w+1;p.fill(0);
    let total=0;
    for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){const n=mask[y*w+x]?1:0;row+=n;total+=n;p[(y+1)*stride+x+1]=p[y*stride+x+1]+row;}}
    let max=0,bx=0,by=0;
    for(let y=0;y<=h-this.fh;y++)for(let x=0;x<=w-this.fw;x++){
      const n=p[(y+this.fh)*stride+x+this.fw]-p[y*stride+x+this.fw]-p[(y+this.fh)*stride+x]+p[y*stride+x];
      if(n>max){max=n;bx=x;by=y;}
    }
    const cssPixelsUpperBound=Math.min(FIELD.width*FIELD.height,max*this.dx*this.dy);
    return {cssPixelsUpperBound,aboveReferenceLimit:cssPixelsUpperBound>FIELD.limit,
      fieldFractionUpperBound:cssPixelsUpperBound/(FIELD.width*FIELD.height),
      totalSampledCssPixels:total*this.dx*this.dy,
      fieldOriginCss:{x:bx*this.dx,y:by*this.dy},sampleCells:max};
  }
  push(mask,time){
    if(!Number.isFinite(time)||(this.lastTime!==null&&time<=this.lastTime))throw Error('Area timestamps must increase');
    if(mask.length!==this.lastPair.length)throw Error('Area mask size changed');
    this.lastTime=time;
    for(let i=0;i<mask.length;i++){if(mask[i])this.lastPair[i]=time;this.envelope[i]=this.lastPair[i]>time-1?1:0;}
    const completion={...this.measure(mask),time},envelope={...this.measure(this.envelope),time};
    if(!this.peakCompletion||completion.cssPixelsUpperBound>this.peakCompletion.cssPixelsUpperBound)this.peakCompletion=completion;
    if(!this.peakEnvelope||envelope.cssPixelsUpperBound>this.peakEnvelope.cssPixelsUpperBound)this.peakEnvelope=envelope;
    return {completion,envelope};
  }
  report(){return {status:'calibrated-screening',calibration:this.calibration,referenceField:FIELD,
    method:'Sample-aligned general/experimental-red pair completions; conservative union of completed-pair locations in the preceding rolling second.',
    peakCompletion:this.peakCompletion,peakEnvelope:this.peakEnvelope,
    spatialResolutionCss:{width:this.dx,height:this.dy},
    limitations:['The rolling envelope is a spatial upper bound on observed pair locations, not concurrent flashing and not a failure verdict.',
      'Completion masks combine general and experimental-red events conservatively; no independent red-area clearance.',
      'Gradual, moving or asynchronous pairs, missed pixels/frames and fine-pattern exceptions require further evaluation.',
      'Spatial counter-phase checkerboards, alternating dither, and distributed stipples can average away opposing transitions during downsampling, creating false-negative static readings (ΔY ≈ 0) for human-visible full-field flicker (RED-04).',
      'Distributed stipples and diffuse non-contiguous flashing across the 10° reference field can evade contiguous envelope detection despite exceeding cumulative spatial threshold limits (RED-05).',
      'Reduced-resolution cells and field edges overestimate observed area; downsampling can also erase flashes.',
      'User-supplied CSS dimensions assume standard reference viewing geometry, not measured steradians. No conformance verdict.']};}
}
