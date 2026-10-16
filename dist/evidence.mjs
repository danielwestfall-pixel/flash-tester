import {color} from './analyzer.mjs';
export class Evidence {
  constructor(width,height,xPercent=50,yPercent=50){
    this.width=width;this.height=height;
    this.x=Math.min(width-1,Math.max(0,Math.floor(width*xPercent/100)));
    this.y=Math.min(height-1,Math.max(0,Math.floor(height*yPercent/100)));
    this.trace=[];this.shots={};this.minimum=Infinity;this.maximum=-Infinity;this.truncated=false;
  }
  push(rgba,t,frame,snapshot){
    const k=(this.y*this.width+this.x)*4,rgb=Array.from(rgba.slice(k,k+3)),c=color(...rgb);
    const previous=this.trace.at(-1);
    const row={time:t,rgb,luminance:c.y,redSaturation:c.saturation,uPrime:c.valid?c.u:null,vPrime:c.valid?c.v:null,
      deltaYFromPrevious:previous?c.y-previous.luminance:null,
      chromaDistanceFromPrevious:previous?.uPrime!=null&&c.valid?Math.hypot(c.u-previous.uPrime,c.v-previous.vPrime):null,
      frameMin:frame.luminanceMin,frameMean:frame.luminanceMean,
      frameMax:frame.luminanceMax,general:frame.general,red:frame.red,flaggedFraction:frame.fraction};
    if(this.trace.length<30000)this.trace.push(row);else this.truncated=true;
    const roles=[];
    if(!this.shots.initial)roles.push('initial');
    if(c.y<this.minimum-1e-10){this.minimum=c.y;roles.push('darkest');}
    if(c.y>this.maximum+1e-10){this.maximum=c.y;roles.push('brightest');}
    if(frame.witness&&!this.shots.flagged)roles.push('flagged');
    if(roles.length){const image=snapshot();for(const role of roles)this.shots[role]={...row,role,image,witness:frame.witness};}
    return row;
  }
  report(){return {probe:{x:this.x,y:this.y,normalizedX:(this.x+.5)/this.width,normalizedY:(this.y+.5)/this.height},
    minimum:Number.isFinite(this.minimum)?this.minimum:null,maximum:Number.isFinite(this.maximum)?this.maximum:null,
    range:Number.isFinite(this.minimum)?this.maximum-this.minimum:null,trace:this.trace,
    traceTruncated:this.truncated,screenshots:Object.values(this.shots).filter(s=>s.image),
    note:'RGB and relative luminance come from uncompressed analysis pixels. Screenshots may be resized/JPEG compressed. Probe range spans the entire capture; it is not a measured flash amplitude. Frame min/mean/max describe spatial brightness, not flash counts.'};}
}
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=(v,d=5)=>v==null?'—':Number(v).toFixed(d);
export function csv(e){
  return ['time_seconds,probe_R_8bit,probe_G_8bit,probe_B_8bit,probe_relative_luminance,probe_deltaY_from_previous,probe_red_saturation,probe_u_prime,probe_v_prime,probe_chroma_distance_from_previous,frame_min_luminance,frame_mean_luminance,frame_max_luminance,peak_general_pairs_rolling_second,peak_red_candidates_rolling_second,flagged_sample_fraction',
    ...e.trace.map(r=>[r.time,...r.rgb,r.luminance,r.deltaYFromPrevious,r.redSaturation,r.uPrime,r.vPrime,r.chromaDistanceFromPrevious,r.frameMin,r.frameMean,r.frameMax,r.general,r.red,r.flaggedFraction].join(','))].join('\n');
}
export function chart(e){
  const rows=e.trace;if(!rows.length)return '<p>No measurements captured.</p>';
  const duration=rows.at(-1).time||1;
  // Preserve the minimum and maximum of each bucket so narrow spikes remain visible.
  const step=Math.max(1,Math.ceil(rows.length/600)),points=[];
  for(let i=0;i<rows.length;i+=step){const bucket=rows.slice(i,i+step);let lo=bucket[0],hi=bucket[0];for(const r of bucket){if(r.luminance<lo.luminance)lo=r;if(r.luminance>hi.luminance)hi=r;}for(const r of [lo,hi].sort((a,b)=>a.time-b.time))points.push(`${45+620*r.time/duration},${165-140*r.luminance}`);}
  return `<svg viewBox="0 0 700 205" role="img" aria-label="Probe relative luminance from zero to one over capture time"><rect width="700" height="205" fill="#f4f7f2"/><path d="M45 25V165H665" fill="none" stroke="#607667"/><path d="M45 53H665" stroke="#b18b5d" stroke-dasharray="4 4"/><text x="7" y="30" font-size="12">1.0</text><text x="7" y="57" font-size="12">0.8</text><text x="7" y="168" font-size="12">0.0</text><text x="45" y="190" font-size="12">0 s</text><text x="600" y="190" font-size="12">${n(duration,2)} s</text><polyline points="${points.join(' ')}" fill="none" stroke="#235b42" stroke-width="1.5"/></svg>`;
}
export function evidenceMarkup(e,viewport){
  const probe=e.probe;
  const shots=e.screenshots.map(s=>{
    const witness=s.role==='flagged'&&s.witness?` First flagged pixel: (${s.witness.x}, ${s.witness.y}), RGB ${s.witness.rgb.join('/')}, Y=${n(s.witness.luminance)}, general=${s.witness.general}, red candidates=${s.witness.red}.`:'';
    return `<figure><div class="shot"><img src="${s.image}" alt="Static ${s.role} captured frame, ${n(s.time,3)} seconds"/><span class="probe-marker" style="left:${probe.normalizedX*100}%;top:${probe.normalizedY*100}%" aria-hidden="true"></span></div><figcaption><strong>${escapeHtml(s.role)} · ${n(s.time,3)} s</strong><br>Probe RGB ${s.rgb.join(' / ')} · Y=${n(s.luminance)}<br>Frame Y min / mean / max: ${n(s.frameMin)} / ${n(s.frameMean)} / ${n(s.frameMax)}.${witness}</figcaption></figure>`;
  }).join('');
  return `<h3>Relative luminance at your measurement point</h3><p>Probe analysis pixel (${probe.x}, ${probe.y}); approximately (${n(probe.normalizedX*(viewport?.width||e.width||1),1)}, ${n(probe.normalizedY*(viewport?.height||e.height||1),1)}) in the captured source. Yellow ring marks the probe. Other pixels may trigger detections.</p><p><strong>Lowest Y: ${n(e.minimum)} · Highest Y: ${n(e.maximum)} · Capture range ΔY: ${n(e.range)}</strong></p><p>Range across the capture is not a flash amplitude and may span unrelated states. Y is dimensionless relative luminance, not nits. A spatial frame average does not determine whether a flash occurred.</p>${chart(e)}<p class="notice"><strong>Screenshot notice:</strong> The following are separate static images, never an animation. They may contain bright or saturated colors and private page content. Review before sharing an exported report.</p><details><summary>Show static screenshot evidence (${e.screenshots.length} frames)</summary><div class="shot-grid">${shots||'<p>No screenshots captured.</p>'}</div></details><p>${escapeHtml(e.note)} ${e.traceTruncated?'The 30,000-row trace limit was reached.':''}</p>`;
}
export function reportHtml(report){
  const e=report.evidence;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flash Review evidence report</title><style>body{font:15px/1.65 system-ui,sans-serif;max-width:1050px;margin:32px auto;padding:0 24px;color:#213b30}h1,h2{line-height:1.2}.notice{padding:14px;background:#fff3dc;border-left:4px solid #a66a26}.shot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}figure{margin:16px 0}.shot{position:relative}.shot img{display:block;width:100%;border:1px solid #ccc}.probe-marker{position:absolute;width:16px;height:16px;border:3px solid #ffdb00;box-shadow:0 0 0 2px #151515;border-radius:50%;transform:translate(-50%,-50%)}figcaption{font-size:12px}svg{width:100%;height:auto}summary{cursor:pointer}table{border-collapse:collapse;width:100%;font-size:12px}th,td{text-align:left;padding:7px;border-bottom:1px solid #ddd}</style><h1>WCAG 2.3.1 — Flash screening evidence</h1><p class="notice"><strong>Conformance status: Not determined.</strong> ${escapeHtml(report.outcome)}. ${report.synthetic?'Synthetic data: these images are generated test frames, not screenshots of a real webpage.':''}</p><p>Date: ${escapeHtml(report.createdAt)}<br>Page / reference (reviewer supplied): ${escapeHtml(report.reference||'Not supplied')}<br>Interactions: ${escapeHtml(report.interactions||'Not supplied')}</p><h2>Capture measurements</h2><p>${n(report.duration,3)} seconds · ${report.frames} frames · ${n(report.observedFps,1)} observed fps · largest gap ${n(report.maxFrameGapSeconds,4)} s<br>Analysis resolution ${report.analysisResolution.width} × ${report.analysisResolution.height}; captured viewport ${escapeHtml(JSON.stringify(report.viewport))}<br>Peak general pairs / rolling second at one pixel: ${report.peakGeneral}; peak red candidates: ${report.peakRedHeuristic}.<br>Ended: ${escapeHtml(report.endedBecause)}</p><h2>What is measured?</h2><p>For each 8-bit sRGB channel c, normalize s=c/255, then linearize: s/12.92 when s≤0.04045; otherwise ((s+0.055)/1.055)^2. Relative luminance Y=0.2126R+0.7152G+0.0722B. The detector pairs opposing excursions ≥0.10 with a darker state below 0.80. More than three completed pairs within a rolling second at a sampled pixel is flagged. Red checks are a limited adjacent-frame saturation/chromaticity heuristic.</p>${e?evidenceMarkup(e,report.viewport):'<p>No luminance evidence available.</p>'}<h2>Flagged intervals</h2>${report.windows.length?`<table><tr><th>Seconds</th><th>General</th><th>Red candidates</th><th>Flagged sample %</th></tr>${report.windows.map(w=>`<tr><td>${n(w.start,3)}–${n(w.end,3)}</td><td>${w.general}</td><td>${w.red}</td><td>${n(w.fraction*100,2)}</td></tr>`).join('')}</table>`:'<p>No intervals flagged. This does not establish conformance.</p>'}<h2>Limitations</h2><ul>${report.limitations.map(s=>`<li>${escapeHtml(s)}</li>`).join('')}</ul><p>Data rows are available in the separate CSV export; JSON includes measurement rows and embedded screenshots. This report contains only static images. <a href="https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html">W3C SC 2.3.1 guidance</a></p></html>`;
}
