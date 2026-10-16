import {color} from './analyzer.mjs';
export class Evidence {
  constructor(width,height,xPercent=50,yPercent=50,options={}){
    this.width=width;this.height=height;
    this.x=Math.min(width-1,Math.max(0,Math.floor(width*xPercent/100)));
    this.y=Math.min(height-1,Math.max(0,Math.floor(height*yPercent/100)));
    this.trace=[];this.shots={};this.minimum=Infinity;this.maximum=-Infinity;this.truncated=false;
    this.previousInput=null;this.droppedFrames=0;this.maxRows=options.maxRows??30000;
    this.history=[];this.historyBytes=0;this.maxHistoryBytes=options.maxHistoryBytes??48*1024*1024;
    this.historyCapped=false;this.witness=null;
  }
  push(rgba,t,frame,snapshot){
    const k=(this.y*this.width+this.x)*4,rgb=Array.from(rgba.slice(k,k+3)),c=color(...rgb);
    const previous=this.previousInput;
    const row={time:t,rgb,luminance:c.y,redSaturation:c.saturation,uPrime:c.valid?c.u:null,vPrime:c.valid?c.v:null,
      deltaYFromPrevious:previous?c.y-previous.luminance:null,
      chromaDistanceFromPrevious:previous?.uPrime!=null&&c.valid?Math.hypot(c.u-previous.uPrime,c.v-previous.vPrime):null,
      frameMin:frame.luminanceMin,frameMean:frame.luminanceMean,
      frameMax:frame.luminanceMax,general:frame.general,red:frame.red,flaggedFraction:frame.fraction};
    this.previousInput=row;
    // Freeze the ENTIRE retained evidence span at its declared limit. The
    // detector may continue, but later extrema cannot contradict this trace.
    if(this.trace.length>=this.maxRows){this.truncated=true;this.droppedFrames++;return row;}
    this.trace.push(row);
    if(!this.witness){
      const copy=new Uint8ClampedArray(rgba);this.history.push({time:t,rgba:copy});this.historyBytes+=copy.byteLength;
      while(this.history.length&&(this.history[0].time<t-1.25||this.historyBytes>this.maxHistoryBytes)){
        const removed=this.history.shift();this.historyBytes-=removed.rgba.byteLength;
        if(removed.time>=t-1.25)this.historyCapped=true;
      }
      if(frame.witness)this.retainWitness(frame.witness,t,snapshot);
    }
    const roles=[];
    if(!this.shots.initial)roles.push('initial');
    if(c.y<this.minimum-1e-10){this.minimum=c.y;roles.push('darkest');}
    if(c.y>this.maximum+1e-10){this.maximum=c.y;roles.push('brightest');}
    if(frame.witness&&!this.shots.flagged)roles.push('flagged');
    if(roles.length){const image=snapshot();for(const role of roles)this.shots[role]={...row,role,image,witness:frame.witness};}
    return row;
  }
  retainWitness(w,t,snapshot){
    const x=w.x,y=w.y,k=(y*this.width+x)*4;
    const trace=this.history.map(h=>{const rgb=Array.from(h.rgba.slice(k,k+3)),c=color(...rgb);return {time:h.time,rgb,luminance:c.y,
      redSaturation:c.saturation,uPrime:c.valid?c.u:null,vPrime:c.valid?c.v:null};});
    const start=w.pairStarts?.[0]??w.latestPair?.states?.[0]?.time??t;
    const complete=trace.length>0&&trace[0].time<=start+1e-9;
    const screenshots=[];
    for(const [index,state] of (w.latestPair?.states??[]).entries()){
      const closest=this.history.reduce((best,h)=>!best||Math.abs(h.time-state.time)<Math.abs(best.time-state.time)?h:best,null);
      if(!closest)continue;
      const rgb=Array.from(closest.rgba.slice(k,k+3)),image=snapshot(closest);
      if(image)screenshots.push({role:`witness state ${index+1}`,time:closest.time,rgb,luminance:color(...rgb).y,image});
    }
    this.witness={x,y,normalizedX:(x+.5)/this.width,normalizedY:(y+.5)/this.height,detectedAt:t,
      general:w.general,red:w.red,kind:w.latestPair?.kind??'unknown',pairStarts:w.pairStarts??[],latestPair:w.latestPair,
      trace,screenshots,completeWindowRetained:complete,
      note:complete?'The first detected pixel has its own retained history. This is sampled evidence, not a conformance verdict.':
        'Witness history is incomplete because of startup or the memory cap. Do not reconstruct the complete rolling count from this partial trace.'};
    this.history=[];this.historyBytes=0;
  }
  releaseHistory(){this.history=[];this.historyBytes=0;}
  report(){return {probe:{x:this.x,y:this.y,normalizedX:(this.x+.5)/this.width,normalizedY:(this.y+.5)/this.height},
    minimum:Number.isFinite(this.minimum)?this.minimum:null,maximum:Number.isFinite(this.maximum)?this.maximum:null,
    range:Number.isFinite(this.minimum)?this.maximum-this.minimum:null,trace:this.trace,
    traceTruncated:this.truncated,screenshots:Object.values(this.shots).filter(s=>s.image),witness:this.witness,
    coverage:{start:this.trace[0]?.time??null,end:this.trace.at(-1)?.time??null,rows:this.trace.length,droppedFrames:this.droppedFrames,
      historyMemoryCapReached:this.historyCapped,note:this.truncated?'Evidence collection stopped at the row limit; detector coverage may extend later.':'Retained evidence spans all accepted measurement rows.'},
    note:'RGB and relative luminance come from uncompressed analysis pixels. Screenshots may be resized/JPEG compressed. Probe range spans the entire capture; it is not a measured flash amplitude. Frame min/mean/max describe spatial brightness, not flash counts.'};}
}
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=5)=>v==null?'—':Number(v).toFixed(d);
export function csv(e,report={}){
  return ['report_id,source_type,algorithm,time_seconds,selected_probe_R_8bit,selected_probe_G_8bit,selected_probe_B_8bit,selected_probe_Y,selected_probe_deltaY_from_previous,selected_probe_red_saturation,selected_probe_u_prime,selected_probe_v_prime,selected_probe_chroma_distance_from_previous,frame_min_Y,frame_mean_Y,frame_max_Y,frame_wide_max_general_pairs_rolling_second,frame_wide_max_red_candidates_rolling_second,flagged_sample_fraction',
    ...e.trace.map(r=>[report.reportId,report.sourceType,report.algorithm,r.time,...r.rgb,r.luminance,r.deltaYFromPrevious,r.redSaturation,r.uPrime,r.vPrime,r.chromaDistanceFromPrevious,r.frameMin,r.frameMean,r.frameMax,r.general,r.red,r.flaggedFraction].join(','))].join('\n');
}
export function witnessCsv(e,report={}){
  const w=e.witness;
  return ['report_id,source_type,algorithm,witness_x_analysis_pixel,witness_y_analysis_pixel,time_seconds,witness_R_8bit,witness_G_8bit,witness_B_8bit,witness_Y,witness_red_saturation,witness_u_prime,witness_v_prime',
    ...(w?.trace??[]).map(r=>[report.reportId,report.sourceType,report.algorithm,w.x,w.y,r.time,...r.rgb,r.luminance,r.redSaturation,r.uPrime,r.vPrime].join(','))].join('\n');
}
export function chart(e,label='Selected-probe relative luminance from zero to one over capture time'){
  const rows=e.trace;if(!rows.length)return '<p>No measurements captured.</p>';
  const duration=rows.at(-1).time||1;
  // Preserve the minimum and maximum of each bucket so narrow spikes remain visible.
  const step=Math.max(1,Math.ceil(rows.length/600)),points=[];
  for(let i=0;i<rows.length;i+=step){const bucket=rows.slice(i,i+step);let lo=bucket[0],hi=bucket[0];for(const r of bucket){if(r.luminance<lo.luminance)lo=r;if(r.luminance>hi.luminance)hi=r;}for(const r of [lo,hi].sort((a,b)=>a.time-b.time))points.push(`${45+620*r.time/duration},${165-140*r.luminance}`);}
  return `<svg viewBox="0 0 700 205" role="img" aria-label="${escapeHtml(label)}"><rect width="700" height="205" fill="#f4f7f2"/><path d="M45 25V165H665" fill="none" stroke="#607667"/><path d="M45 53H665" stroke="#b18b5d" stroke-dasharray="4 4"/><text x="7" y="30" font-size="12">1.0</text><text x="7" y="57" font-size="12">0.8</text><text x="7" y="168" font-size="12">0.0</text><text x="45" y="190" font-size="12">0 s</text><text x="600" y="190" font-size="12">${n(duration,2)} s</text><polyline points="${points.join(' ')}" fill="none" stroke="#235b42" stroke-width="1.5"/></svg>`;
}
export function evidenceMarkup(e,viewport){
  const probe=e.probe;
  const shots=e.screenshots.map(s=>{
    const witness=s.role==='flagged'&&s.witness?` First flagged pixel: (${s.witness.x}, ${s.witness.y}), RGB ${s.witness.rgb.join('/')}, Y=${n(s.witness.luminance)}, general=${s.witness.general}, red candidates=${s.witness.red}.`:'';
    return `<figure><div class="shot"><img src="${s.image}" alt="Static ${s.role} captured frame, ${n(s.time,3)} seconds"/><span class="probe-marker" style="left:${probe.normalizedX*100}%;top:${probe.normalizedY*100}%" aria-hidden="true"></span></div><figcaption><strong>${escapeHtml(s.role)} · ${n(s.time,3)} s</strong><br>Probe RGB ${s.rgb.join(' / ')} · Y=${n(s.luminance)}<br>Frame Y min / mean / max: ${n(s.frameMin)} / ${n(s.frameMean)} / ${n(s.frameMax)}.${witness}</figcaption></figure>`;
  }).join('');
  return `<h3>Selected probe — separate from detection counts</h3>
  <p>Probe analysis pixel (${probe.x}, ${probe.y}); approximately (${n(probe.normalizedX*(viewport?.width||1),1)}, ${n(probe.normalizedY*(viewport?.height||1),1)}) in the captured source. Yellow ring marks this selected probe. It may be static even when a different pixel triggers detection.</p>
  <p><strong>Lowest Y: ${n(e.minimum)} · Highest Y: ${n(e.maximum)} · Capture range ΔY: ${n(e.range)}</strong></p>
  <p>Range across the retained capture is not a flash amplitude. Y is dimensionless relative luminance, not nits. Spatial frame averages do not establish flashing.</p>
  <p>Evidence covers ${n(e.coverage?.start,3)}–${n(e.coverage?.end,3)} s. ${escapeHtml(e.coverage?.note||'')}</p>
  ${e.traceTruncated?'<p class="notice"><strong>Evidence truncated.</strong> The trace, extrema and probe screenshots stop at the same row limit. Detector results may cover a later interval. Rerun shorter captures to obtain missing evidence.</p>':''}
  ${chart(e)}<p class="notice"><strong>Screenshot notice:</strong> These are separate static images, never an animation. They may contain bright colors and private page content. Review before sharing.</p>
  <details><summary>Show static screenshot evidence (${e.screenshots.length} probe frames)</summary><div class="shot-grid">${shots||'<p>No screenshots retained.</p>'}</div></details>
  <p>${escapeHtml(e.note)}</p>${witnessMarkup(e.witness)}`;
}
export function witnessMarkup(w){
  if(!w)return '<h3>Detection witness</h3><p>No detection witness retained within the evidence interval. This is not a negative conformance finding.</p>';
  const states=w.latestPair?.states??[];
  const images=w.screenshots.map(s=>`<figure><div class="shot"><img src="${s.image}" alt="Static detection witness state at ${n(s.time,3)} seconds"><span class="probe-marker" style="left:${w.normalizedX*100}%;top:${w.normalizedY*100}%"></span></div><figcaption>${escapeHtml(s.role)} · ${n(s.time,3)} s · Witness RGB ${s.rgb.join('/')} · Y=${n(s.luminance)}</figcaption></figure>`).join('');
  return `<h3>Detection witness — pixel (${w.x}, ${w.y})</h3><p>First flag at ${n(w.detectedAt,3)} s; general ${w.general}, experimental red ${w.red}. This trace belongs to the detected pixel, independently of your selected probe. Kind: ${escapeHtml(w.kind)}.</p>
  <p class="${w.completeWindowRetained?'hint':'notice'}">${escapeHtml(w.note)}</p>${chart({trace:w.trace},'Detection-witness relative luminance from zero to one over capture time')}
  <p>Retained rolling pair starts (seconds): ${w.pairStarts.map(t=>n(t,4)).join(', ')}. These are sampled transition timings, not a physical display measurement.</p>
  <table><thead><tr><th scope="col">Latest complete pair state</th><th scope="col">Time (s)</th><th scope="col">Y</th><th scope="col">Change in Y</th></tr></thead><tbody>${states.map((s,i)=>`<tr><td>${i+1}</td><td>${n(s.time,4)}</td><td>${n(s.luminance)}</td><td>${i?n(s.luminance-states[i-1].luminance):'—'}</td></tr>`).join('')}</tbody></table>
  <details><summary>Show static detection-witness frames (${w.screenshots.length})</summary><div class="shot-grid">${images||'<p>Screenshots disabled or unavailable. Numeric witness trace is still retained.</p>'}</div></details>`;
}
export function reportHtml(report){
  const e=report.evidence;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flash Review evidence report</title><style>body{font:15px/1.65 system-ui,sans-serif;max-width:1050px;margin:32px auto;padding:0 24px;color:#213b30}h1,h2{line-height:1.2}.notice{padding:14px;background:#fff3dc;border-left:4px solid #a66a26}.shot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}figure{margin:16px 0}.shot{position:relative}.shot img{display:block;width:100%;border:1px solid #ccc}.probe-marker{position:absolute;width:16px;height:16px;border:3px solid #ffdb00;box-shadow:0 0 0 2px #151515;border-radius:50%;transform:translate(-50%,-50%)}figcaption{font-size:12px}svg{width:100%;height:auto}summary{cursor:pointer}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:7px;border-bottom:1px solid #ddd}</style><h1>WCAG 2.3.1 — Flash screening evidence</h1><p class="notice"><strong>Conformance status: Not determined.</strong> ${escapeHtml(report.outcome)}. ${report.synthetic?'Synthetic data: these images are generated test frames, not screenshots of a real webpage.':''}</p><p>Report ID: ${escapeHtml(report.reportId)}<br>Build: ${escapeHtml(report.buildId)}<br>Source: ${escapeHtml(report.sourceType)}<br>Structured status: ${escapeHtml(report.status)}<br>Red evaluation: experimental and incomplete; area: not evaluated.<br>Date: ${escapeHtml(report.createdAt)}<br>Page / reference (reviewer supplied): ${escapeHtml(report.reference||'Not supplied')}<br>Interactions: ${escapeHtml(report.interactions||'Not supplied')}</p><h2>Observation quality</h2><p>${escapeHtml(JSON.stringify(report.observation))}</p><h2>Capture measurements</h2><p>${n(report.duration,3)} seconds · ${report.frames} frames · ${n(report.observedFps,1)} observed fps · largest gap ${n(report.maxFrameGapSeconds,4)} s<br>Analysis resolution ${report.analysisResolution.width} × ${report.analysisResolution.height}; captured viewport ${escapeHtml(JSON.stringify(report.viewport))}<br>Peak general pairs / rolling second at one pixel: ${report.peakGeneral}; peak red candidates: ${report.peakRedHeuristic}.<br>Ended: ${escapeHtml(report.endedBecause)}</p><h2>What is measured?</h2><p>For each 8-bit sRGB channel c, normalize s=c/255, then linearize: s/12.92 when s≤0.04045; otherwise ((s+0.055)/1.055)^2. Relative luminance Y=0.2126R+0.7152G+0.0722B. The detector pairs opposing excursions ≥0.10 with a darker state below 0.80. More than three completed pairs within a rolling second at a sampled pixel is flagged. Red candidates accumulate chromaticity excursions across frames. The trajectory detector is experimental and incomplete; no result establishes red-flash clearance.</p>${e?evidenceMarkup(e,report.viewport):'<p>No luminance evidence available.</p>'}<h2>Flagged intervals</h2>${report.windows.length?`<table><tr><th>Seconds</th><th>General</th><th>Red candidates</th><th>Flagged sample %</th></tr>${report.windows.map(w=>`<tr><td>${n(w.start,3)}–${n(w.end,3)}</td><td>${w.general}</td><td>${w.red}</td><td>${n(w.fraction*100,2)}</td></tr>`).join('')}</table>`:'<p>No intervals flagged. This does not establish conformance.</p>'}<h2>Limitations</h2><ul>${report.limitations.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul><p>Data rows are available in the separate CSV export; JSON includes measurement rows and embedded screenshots. This report contains only static images. <a href="https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html">W3C SC 2.3.1 guidance</a></p></html>`;
}
