// Screening only. Spatially reduced captures cannot establish WCAG conformance.
const linear = Array.from({length:256}, (_,i) => {
  const v=i/255; return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
});
export function color(r,g,b) {
  const R=linear[r],G=linear[g],B=linear[b];
  const X=.4124564*R+.3575761*G+.1804375*B;
  const Y=.2126729*R+.7151522*G+.0721750*B;
  const Z=.0193339*R+.1191920*G+.9503041*B;
  const d=X+15*Y+3*Z;
  // Black has no chromaticity: red/black changes are covered by luminance.
  return {y:.2126*R+.7152*G+.0722*B,u:d?4*X/d:0,v:d?9*Y/d:0,
    valid:d>1e-8,saturation:R+G+B>0?R/(R+G+B):0,red:R+G+B>0&&R/(R+G+B)>=.8};
}
class Pixel {
  constructor(c,t) {
    this.extreme=c.y; this.extremeTime=t; this.direction=0;
    this.pending=null; this.general=[]; this.red=[];
    this.previous=c; this.previousTime=t; this.redPending=null;
  }
  update(c,t) {
    const delta=c.y-this.extreme, direction=Math.sign(delta);
    if (this.direction && direction===this.direction) {
      this.extreme=c.y; this.extremeTime=t;
    } else if (Math.abs(delta)>=.1-1e-10 && Math.min(c.y,this.extreme)<.8) {
      if (this.pending!==null) { this.general.push(this.pending); this.pending=null; }
      else this.pending=this.extremeTime;
      this.direction=direction; this.extreme=c.y; this.extremeTime=t;
    } else if (!this.direction) {
      // Keep the original anchor until a full threshold crossing occurs.
    }
    // Red heuristic uses adjacent captured frames; gradual color transitions
    // and black chromaticity require further review with a validated tool.
    const p=this.previous,du=c.u-p.u,dv=c.v-p.v;
    if(c.valid&&p.valid&&(c.red||p.red)&&Math.hypot(du,dv)>.2) {
      const q=this.redPending;
      if(q&&du*q.du+dv*q.dv<0) {this.red.push(q.t);this.redPending=null;}
      else this.redPending={du,dv,t:this.previousTime??t};
    }
    this.previous=c; this.previousTime=t;
    while(this.general.length&&this.general[0]<t-1-1e-9)this.general.shift();
    while(this.red.length&&this.red[0]<t-1-1e-9)this.red.shift();
    return [this.general.length,this.red.length];
  }
}
export class Analyzer {
  constructor(width,height) {
    this.width=width;this.height=height;this.pixels=[];this.frames=0;
    this.start=null;this.last=null;this.maxGap=0;this.peakGeneral=0;this.peakRed=0;
    this.maxFlaggedFraction=0;this.windows=[];
  }
  push(rgba,t) {
    if(rgba.length!==this.width*this.height*4)throw Error('Frame size changed');
    if(this.last!==null&&t<=this.last) return;
    if(this.start===null)this.start=t;
    if(this.last!==null)this.maxGap=Math.max(this.maxGap,t-this.last);
    this.last=t;this.frames++;
    let general=0,red=0,flagged=0,minX=this.width,minY=this.height,maxX=-1,maxY=-1;
    let luminanceMin=1,luminanceMax=0,luminanceSum=0,witness=null;
    for(let i=0;i<this.width*this.height;i++) {
      const k=i*4,c=color(rgba[k],rgba[k+1],rgba[k+2]);
      luminanceMin=Math.min(luminanceMin,c.y);luminanceMax=Math.max(luminanceMax,c.y);luminanceSum+=c.y;
      if(!this.pixels[i]) {this.pixels[i]=new Pixel(c,t);continue;}
      const [g,r]=this.pixels[i].update(c,t);
      general=Math.max(general,g);red=Math.max(red,r);
      if(g>3||r>3) {
        flagged++;const x=i%this.width,y=Math.floor(i/this.width);
        if(!witness)witness={x,y,rgb:[rgba[k],rgba[k+1],rgba[k+2]],luminance:c.y,general:g,red:r};
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
    }
    this.peakGeneral=Math.max(this.peakGeneral,general);this.peakRed=Math.max(this.peakRed,red);
    const fraction=flagged/(this.width*this.height);
    this.maxFlaggedFraction=Math.max(this.maxFlaggedFraction,fraction);
    if(flagged) {
      const bin=Math.floor((t-this.start)*4);
      const prev=this.windows.at(-1);
      const event={bin,start:Math.max(0,t-this.start-1),end:t-this.start,general,red,
        fraction,box:{x:minX/this.width,y:minY/this.height,width:(maxX-minX+1)/this.width,height:(maxY-minY+1)/this.height}};
      if(prev?.bin===bin) {if(event.fraction>prev.fraction)this.windows[this.windows.length-1]=event;}
      else this.windows.push(event);
    }
    return {general,red,fraction,witness,luminanceMin,luminanceMax,luminanceMean:luminanceSum/(this.width*this.height)};
  }
  report() {
    const duration=this.last===null?0:this.last-this.start;
    const fps=duration?(this.frames-1)/duration:0;
    return {algorithm:'flash-screen-0.2',outcome:this.frames<2?'Insufficient capture':
      this.windows.length?'Potential flashing — review required':'No rapid flashing detected in sampled capture — review required',
      duration,frames:this.frames,observedFps:fps,maxFrameGapSeconds:this.maxGap,
      analysisResolution:{width:this.width,height:this.height},peakGeneral:this.peakGeneral,
      peakRedHeuristic:this.peakRed,maxFlaggedFraction:this.maxFlaggedFraction,windows:this.windows,
      limitations:[
        'Screening evidence only; no WCAG pass/fail or whole-page conformance conclusion.',
        'Reduced-resolution pixels can miss small flashes and average away opposing patterns.',
        'Capture timing, dropped frames, aliasing, browser throttling and protected media can conceal flashes.',
        'General events use luminance excursions >= 0.10 with the darker state < 0.80, paired without overlap.',
        'Red heuristic uses adjacent-frame linear-sRGB saturation >= 0.8 and CIE 1976 u-prime/v-prime distance > 0.2; gradual red transitions and black chromaticity are not fully evaluated.',
        'Rolling windows count complete pairs whose starts and completions fit within one second at the same sampled pixel. Moving or differently phased flashes can be missed.',
        'Flagged pixel fraction is not the WCAG area threshold; concurrent area within a 10-degree visual field, viewing conditions and fine-pattern exception are not evaluated.',
        'Only the shared viewport, exercised states and captured interval were screened. Confirm flagged segments with a validated flash analyzer and inspect all relevant page states.'
      ]};
  }
}
