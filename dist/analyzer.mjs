// Screening only. Spatially reduced captures cannot establish WCAG conformance.
import {AreaMeter} from './area.mjs';
const linear = Array.from({length:256}, (_,i) => {
  const v=i/255; return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;
});
export function color(r,g,b) {
  const R=linear[r],G=linear[g],B=linear[b];
  const X=.4124564*R+.3575761*G+.1804375*B;
  const Y=.2126729*R+.7151522*G+.0721750*B;
  const Z=.0193339*R+.1191920*G+.9503041*B;
  const d=X+15*Y+3*Z;
  const redDiff=Math.max(0,(R-G-B)*320);
  return {y:.2126*R+.7152*G+.0722*B,u:d?4*X/d:0,v:d?9*Y/d:0,
    valid:d>1e-8,saturation:R+G+B>0?R/(R+G+B):0,red:R+G+B>0&&R/(R+G+B)>=.8,redDiff};
}
class Pixel {
  constructor(c,t) {
    this.extreme=c.y; this.extremeTime=t; this.direction=0;
    this.pending=null; this.general=[]; this.red=[];
    this.generalPhases=[[],[]];this.generalLatest=[null,null];this.generalPairIndex=0;
    this.redPhases=[[],[]];this.redLatest=[null,null];this.redPairIndex=0;
    this.previous=c; this.previousTime=t;
    this.redOrigin=c;this.redOriginTime=t;this.redExtreme=c;this.redExtremeTime=t;
    this.redDirection=null;this.redPending=null;this.generalPair=null;this.redPair=null;
  }
  update(c,t) {
    this.completedGeneral=false;this.completedRed=false;
    const delta=c.y-this.extreme, direction=Math.sign(delta);
    if (Math.abs(delta)<1e-10) {
      // A flat state ends at the last observed plateau sample, not at the
      // beginning of a potentially long hold before flashing starts.
      this.extremeTime=t;
    } else if (this.direction && direction===this.direction) {
      this.extreme=c.y; this.extremeTime=t;
    } else if (Math.abs(delta)>=.1-1e-10 && Math.min(c.y,this.extreme)<.8) {
      if (this.pending!==null) {
        const phase=this.generalPairIndex++%2;
        if(t-this.pending<=1.0+1e-9)this.generalPhases[phase].push(t);
        this.generalLatest[phase]={kind:'general',states:[{time:this.pending,luminance:this.pendingY},
          {time:this.extremeTime,luminance:this.extreme},{time:t,luminance:c.y}]};
        this.completedGeneral=true;
        // Keep the current transition as the start of the opposite pairing
        // phase. Count each phase separately, never sum overlapping pairs.
        this.pending=this.extremeTime;this.pendingY=this.extreme;
      } else {this.pending=this.extremeTime;this.pendingY=this.extreme;}
      this.direction=direction; this.extreme=c.y; this.extremeTime=t;
    } else if (!this.direction) {
      // Keep the original anchor until a full threshold crossing occurs.
    }
    this.updateRed(c,t);
    this.previous=c; this.previousTime=t;
    for(const phases of [this.generalPhases,this.redPhases])for(const pairs of phases)
      while(pairs.length&&pairs[0]<=t-1+1e-9)pairs.shift();
    const gp=this.generalPhases[1].length>this.generalPhases[0].length?1:0;
    const rp=this.redPhases[1].length>this.redPhases[0].length?1:0;
    this.general=this.generalPhases[gp];this.generalPair=this.generalLatest[gp];
    this.red=this.redPhases[rp];this.redPair=this.redLatest[rp];
    return [this.general.length,this.red.length];
  }
  updateRed(c,t){
    // Trajectory detector with normative WCAG (R-G-B)*320 red transition support.
    if(!c.valid||!this.previous.valid){
      this.redOrigin=c;this.redOriginTime=t;this.redExtreme=c;this.redExtremeTime=t;
      this.redDirection=null;this.redPending=null;return;
    }
    const origin=this.redDirection?this.redExtreme:this.redOrigin;
    const du=c.u-origin.u,dv=c.v-origin.v,distance=Math.hypot(du,dv);
    const dRed=Math.abs(c.redDiff-origin.redDiff);
    if(distance<1e-9&&dRed<1e-9){
      if(this.redDirection)this.redExtremeTime=t;else this.redOriginTime=t;
      return;
    }
    const forward=this.redDirection&&(du*this.redDirection.du+dv*this.redDirection.dv)>0;
    if(forward){this.redExtreme=c;this.redExtremeTime=t;return;}
    if((distance<=.2&&dRed<=20)||!(c.red||origin.red))return;
    const originTime=this.redDirection?this.redExtremeTime:this.redOriginTime;
    if(this.redPending){
      const phase=this.redPairIndex++%2;
      if(t-this.redPending.time<=1.0+1e-9)this.redPhases[phase].push(t);
      this.redLatest[phase]={kind:'red-experimental',states:[this.redPending,
        {time:originTime,luminance:origin.y,uPrime:origin.u,vPrime:origin.v,redSaturation:origin.saturation},
        {time:t,luminance:c.y,uPrime:c.u,vPrime:c.v,redSaturation:c.saturation}]};
      this.completedRed=true;
      this.redPending={time:originTime,luminance:origin.y,uPrime:origin.u,vPrime:origin.v,redSaturation:origin.saturation};
    } else this.redPending={time:originTime,luminance:origin.y,uPrime:origin.u,vPrime:origin.v,redSaturation:origin.saturation};
    this.redDirection={du:du/(distance||1),dv:dv/(distance||1)};this.redExtreme=c;this.redExtremeTime=t;
  }
}
export class Analyzer {
  constructor(width,height,options={}) {
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<0||height<0||width*height>640*640)throw Error('Invalid analysis dimensions');
    this.width=width;this.height=height;this.pixels=[];this.frames=0;
    this.start=null;this.last=null;this.maxGap=0;this.peakGeneral=0;this.peakRed=0;
    this.maxFlaggedFraction=0;this.windows=[];
    this.area=options.calibration&&width>0&&height>0?new AreaMeter(width,height,options.calibration):null;
    this.areaFallback=options.area??(options.calibration?{status:'rejected',reason:'Area calibration was rejected or could not be evaluated.',calibration:options.calibration}:null);
    this.pairMask=this.area?new Uint8Array(width*height):null;
  }
  push(rgba,t) {
    if(!Number.isFinite(t))throw Error('Invalid frame timestamp');
    if(rgba.length!==this.width*this.height*4)throw Error('Frame size changed');
    if(this.last!==null&&t<=this.last) return;
    if(this.start===null)this.start=t;
    if(this.last!==null)this.maxGap=Math.max(this.maxGap,t-this.last);
    this.last=t;this.frames++;
    let general=0,red=0,flagged=0,minX=this.width,minY=this.height,maxX=-1,maxY=-1;
    let luminanceMin=1,luminanceMax=0,luminanceSum=0,witness=null;
    this.pairMask?.fill(0);
    for(let i=0;i<this.width*this.height;i++) {
      const k=i*4,c=color(rgba[k],rgba[k+1],rgba[k+2]);
      luminanceMin=Math.min(luminanceMin,c.y);luminanceMax=Math.max(luminanceMax,c.y);luminanceSum+=c.y;
      if(!this.pixels[i]) {this.pixels[i]=new Pixel(c,t);continue;}
      const pixel=this.pixels[i];
      const [g,r]=pixel.update(c,t);
      if(this.pairMask&&(pixel.completedGeneral||pixel.completedRed))this.pairMask[i]=1;
      general=Math.max(general,g);red=Math.max(red,r);
      if(g>3||r>3) {
        flagged++;const x=i%this.width,y=Math.floor(i/this.width);
        if(!witness){const p=this.pixels[i];witness={x,y,rgb:[rgba[k],rgba[k+1],rgba[k+2]],luminance:c.y,general:g,red:r,
          latestPair:g>3?p.generalPair:p.redPair,pairStarts:g>3?[...p.general]:[...p.red]};}
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
    }
    this.peakGeneral=Math.max(this.peakGeneral,general);this.peakRed=Math.max(this.peakRed,red);
    const fraction=flagged/(this.width*this.height);
    this.maxFlaggedFraction=Math.max(this.maxFlaggedFraction,fraction);
    const area=this.area?.push(this.pairMask,t)??null;
    if(flagged) {
      const bin=Math.floor((t-this.start)*4);
      const prev=this.windows.at(-1);
      const event={bin,start:Math.max(0,t-this.start-1),end:t-this.start,general,red,
        fraction,area,box:{x:minX/this.width,y:minY/this.height,width:(maxX-minX+1)/this.width,height:(maxY-minY+1)/this.height}};
      if(prev?.bin===bin) {if(event.fraction>prev.fraction)this.windows[this.windows.length-1]=event;}
      else this.windows.push(event);
    }
    return {general,red,fraction,area,witness,luminanceMin,luminanceMax,luminanceMean:luminanceSum/(this.width*this.height)};
  }
  report() {
    const duration=this.last===null?0:this.last-this.start;
    const fps=duration?(this.frames-1)/duration:0;
    const reasons=[];
    if(this.frames<2)reasons.push('Fewer than two usable frames');
    if(duration<1)reasons.push('Less than one second observed');
    if(fps<30)reasons.push('Observed frame rate below 30 fps');
    if(this.maxGap>.1)reasons.push('A frame gap exceeded 0.1 seconds');
    const status=this.windows.length?'candidates-detected':reasons.length?'insufficient-observation':'inconclusive-no-candidates';
    return {algorithm:'flash-screen-0.4.2',status,outcome:status==='candidates-detected'?'Potential flashing — review required':
      status==='insufficient-observation'?'Insufficient observation — inconclusive':'No candidates in sampled data — conformance inconclusive',
      observation:{meetsScreeningMinimum:!reasons.length,reasons,warning:'Minimum sampling checks do not rule out aliasing or establish page coverage.'},
      evaluation:{general:'screening-only',red:'experimental-incomplete',area:this.area?'calibrated-screening':'not-evaluated',conformance:'not-determined'},
      area:this.area?.report()??this.areaFallback??{status:'not-evaluated',reason:'Displayed CSS dimensions were not supplied.'},
      duration,frames:this.frames,observedFps:fps,maxFrameGapSeconds:this.maxGap,
      analysisResolution:{width:this.width,height:this.height},peakGeneral:this.peakGeneral,
      peakRedHeuristic:this.peakRed,maxFlaggedFraction:this.maxFlaggedFraction,windows:this.windows,
      limitations:[
        'Screening evidence only; no WCAG pass/fail or whole-page conformance conclusion.',
        'Reduced-resolution pixels can miss small flashes and average away opposing patterns.',
        'Capture timing, dropped frames, aliasing, browser throttling and protected media can conceal flashes.',
        'General events use luminance excursions >= 0.10 with the darker state < 0.80. Both nonoverlapping pairing phases are evaluated separately; their counts are never added.',
        'Red candidates use accumulated CIE 1976 u-prime/v-prime excursions > 0.2 involving linear-sRGB saturation >= 0.8. The trajectory model remains experimental and incomplete, including curved color paths and black chromaticity.',
        'Rolling windows count complete pairs whose starts and completions fit within one second at the same sampled pixel. Moving or differently phased flashes can be missed.',
        'Flagged pixel fraction is not the WCAG area threshold. Optional calibrated area reports sample-aligned completions and a conservative rolling spatial envelope; full temporal overlap, physical viewing conditions and fine-pattern exceptions remain unevaluated.',
        'Only the shared viewport, exercised states and captured interval were screened. Confirm flagged segments with a validated flash analyzer and inspect all relevant page states.'
      ]};
  }
}
