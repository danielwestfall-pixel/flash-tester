// Startup settling regressions (NF-04, NF-07, RT-01, RT-03, RT-04, RT-09) and the
// geometry guards, driving production dist/app.mjs. MOCKED browser APIs: this does not
// establish native capture behaviour.
import assert from 'node:assert/strict';
import fs from 'node:fs';
let cb=null,rgb=[0,0,0];const blobs=[],paints=[];
class El{constructor(){this.listeners={};this.children=[];this.dataset={};this.style={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';}
  addEventListener(t,f){this.listeners[t]=f;}async fire(t){return this.listeners[t]?.({preventDefault(){}});}
  append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(k,v){this[k]=v;}click(){}focus(){}
  getContext(){const el=this;return {drawImage(src){paints.push({el,kind:'draw',fromVideo:src===els.get('source')});},putImageData(){paints.push({el,kind:'put'});},fillRect(){},getImageData(x,y,w,h){const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d.set(rgb,i*4);d[i*4+3]=255;}return {data:d};}};}
  toDataURL(){return 'data:image/png;base64,AAAA';}}
const html=fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
const els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El()]));
const docListeners={};globalThis.document={getElementById:id=>els.get(id),createElement:()=>new El(),querySelectorAll:()=>[],addEventListener(t,f){docListeners[t]=f;},hidden:false};
globalThis.window={addEventListener(){}};globalThis.ImageData=class{constructor(d,w,h){Object.assign(this,{data:d,width:w,height:h});}};
// Track settings deliberately differ from the video element: observed pixels must come from the element.
const track={stop(){},getSettings:()=>({width:1111,height:999,frameRate:60,displaySurface:'browser'}),addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getDisplayMedia:async()=>({getVideoTracks:()=>[track],getTracks:()=>[track]})}}});
URL.createObjectURL=b=>{blobs.push(b);return 'blob:x';};URL.revokeObjectURL=()=>{};
const $=id=>els.get(id),video=$('source');
video.requestVideoFrameCallback=f=>{cb=f;return 1;};video.cancelVideoFrameCallback=()=>{};video.pause=()=>{};video.play=async()=>{};
await import('./dist/app.mjs');
assert.equal(globalThis.flashReviewReady,true,'App signals the load watchdog');
async function exportAll(){blobs.length=0;for(const id of ['json','csv','witness-csv','html-report','text'])await $(id).fire('click');return Promise.all(blobs.map(b=>b.text()));}
async function capture(frames,cal,resolution='320',shots=false){
  $('duration').value='30';$('resolution').value=resolution;$('probe-x').value='50';$('probe-y').value='50';$('keep-shots').checked=shots;paints.length=0;
  $('area-enabled').checked=!!cal;if(cal){$('css-width').value=String(cal[0]);$('css-height').value=String(cal[1]);}
  await $('setup').fire('submit');
  for(const f of frames){if($('stop').hidden)break;video.videoWidth=f.w;video.videoHeight=f.h;rgb=f.rgb??[0,0,0];cb(f.t*1000,{mediaTime:f.t});}
  if(!$('stop').hidden)await $('stop').fire('click');
  const files=await exportAll();return {r:JSON.parse(files[0]),files,ui:$('quality').textContent};
}
const seq=(n,dt,t0,fn)=>Array.from({length:n},(_,i)=>({t:t0+i*dt,...fn(i,t0+i*dt)}));
const W=2940,H=1582,flash=(t,hz)=>Math.floor(t*hz*2+1e-9)%2?[255,255,255]:[0,0,0];
// RT-01: a complete 8 flash/s burst inside the first 0.55 s at a constant size is analyzed.
{const {r,ui}=await capture([...seq(60,1/60,0,(i,t)=>({w:W,h:H,rgb:t<.55?flash(t,8):[0,0,0]})),...seq(120,1/60,1,()=>({w:W,h:H}))],[1200,646]);
  assert.equal(r.status,'candidates-detected','Burst during settling is not hidden');assert.equal(r.startupSettling.discardedFrames,0);
  assert.equal(r.startupSettling.analyzedStartupFrames,31,'Frames 0..30 (until 0.5 s) buffered and analyzed');
  assert.ok(ui.includes('Startup settling:'),'Startup interval is shown in the UI');}
// RT-01: a burst at a transitional size (later changed) is screened separately and flagged.
// 28 frames (0.45 s, under the 0.5 s settle time) hold four complete 10 Hz pairs.
{const {r,ui}=await capture([...seq(28,1/60,0,(i,t)=>({w:W,h:H+120,rgb:flash(t,10)})),...seq(90,1/60,28/60,()=>({w:W,h:H}))],[1200,646]);
  assert.equal(r.startupSettling.discardedFrames,28);assert.equal(r.startupSettling.transitionalCandidates,true);
  assert.equal(r.status,'candidates-detected','Transitional-size candidates are reported');
  assert.ok(r.windows.some(w=>w.startupTransitional&&w.start<0),'Transitional window precedes the analysis origin');
  assert.ok(ui.includes('CANDIDATES FOUND'));}
// Time origin: the first analyzed frame is the first frame at the final size (t=0.25 here).
{const {r}=await capture([...seq(15,1/60,0,()=>({w:W,h:H+2})),...seq(90,1/60,.25,()=>({w:W,h:H}))],[1200,646]);
  assert.equal(r.startupSettling.discardedMediaSeconds,.25);assert.equal(r.evidence.trace[0].time,0,'Relative time origin is the first analyzed frame');
  assert.ok(Math.abs(r.duration-89/60)<1e-9,'Duration counts from the first final-size frame');}
// RT-03: one change then silence is not "kept changing"; two or more changes are.
{const once=(await capture([{t:0,w:W,h:H+2},{t:.2,w:W,h:H}],[1200,646])).r;
  assert.ok(once.area.reason.includes('changed once')&&!once.area.reason.includes('kept changing'),once.area.reason);
  const many=(await capture(seq(30,1/60,0,i=>({w:W,h:i%2?H:H+2})),[1200,646])).r;
  assert.ok(many.area.reason.includes('kept changing (29 changes)'),many.area.reason);assert.equal(many.frames,0);}
// RT-04 / NF-07: a static page with one size but no confirming frame is analyzed as unconfirmed.
{const {r}=await capture(seq(3,.1,0,()=>({w:W,h:H})),[1200,646]);
  assert.equal(r.frames,3);assert.equal(r.startupSettling.geometryConfirmed,false);assert.equal(r.area.status,'calibrated-screening');
  assert.ok(r.observation.reasons.some(x=>x.startsWith('Only one frame size was observed (3 frame(s))')));assert.equal(r.status,'insufficient-observation');}
// NF-02 is reachable for static pages: an unconfirmed single size with a wrong aspect is rejected.
{const {r}=await capture([{t:0,w:W,h:H}],[1200,702]);
  assert.equal(r.area.status,'calibration-rejected');assert.deepEqual(r.area.observedSourcePixels,{width:W,height:H},'Observed pixels come from the video element, not track settings');
  assert.ok(r.area.reason.includes('not confirmed stable'));}
// RT-09: zero-size frames never lock geometry; a 3% aspect mismatch is rejected (2% guard).
{const {r}=await capture([...seq(40,1/60,0,()=>({w:0,h:0})),...seq(60,1/60,40/60,()=>({w:W,h:H}))],[1200,646]);
  assert.equal(r.startupSettling.invalidSizeFrames,40);assert.equal(r.area.status,'calibrated-screening');assert.deepEqual(r.viewport,{width:W,height:H});
  const off=(await capture(seq(60,1/60,0,()=>({w:W,h:H})),[1200,646*1.03])).r;assert.equal(off.area.status,'calibration-rejected','3% aspect mismatch rejected');
  const ok=(await capture(seq(60,1/60,0,()=>({w:W,h:H})),[1200,646*1.015])).r;assert.equal(ok.area.status,'calibrated-screening','1.5% aspect mismatch accepted');}
// Exports carry the settling record and the SC 2.3.2 result.
{const {r,files}=await capture(seq(90,1/60,0,(i,t)=>({w:W,h:H,rgb:flash(t,4)})),[1200,646]);
  for(const csvText of [files[1],files[2]]){assert.ok(csvText.split('\n')[0].includes('startup_settling_json'));assert.ok(csvText.split('\n')[0].includes('sc232_status'));}
  assert.ok(files[3].includes('SC 2.3.2 (Level AAA) strict screening')&&files[4].includes('SC 2.3.2 (Level AAA) strict screening'));
  assert.ok(files[3].includes('Startup settling:')&&files[4].includes('Startup settling:'));assert.equal(r.sc232.status,'candidates-detected');}
// RT2-03: a burst that straddles a startup size change (10 transitions in 0.2-1.0 s, size
// change at 0.45 s) is caught by the startup bridge.
{const {r}=await capture([...seq(27,1/60,0,(i,t)=>({w:W,h:H+120,rgb:t>=.2?flash(t-.2,5):[0,0,0]})),...seq(150,1/60,27/60,(i,t)=>({w:W,h:H,rgb:t<1?flash(t-.2,5):[0,0,0]}))],[1200,646]);
  assert.equal(r.status,'candidates-detected','Straddling burst is detected');assert.ok(r.windows.some(w=>w.startupBridge));assert.equal(r.startupSettling.bridge.candidates,true);}
// RT2-04: more than 32 transitional segments keep their windows; headline follows the status.
// Segments 0-38 last 0.2 s; segment 39 lasts 0.45 s (still under 0.5 s) and holds four 10 Hz pairs.
{const frames=[];for(let k=0;k<40;k++){const n=k===39?27:12;for(let i=0;i<n;i++){const t=k*.2+i/60;frames.push({t,w:W,h:H+2+(k%2)*2,rgb:k===39?flash(t-7.8,10):[0,0,0]});}}
  frames.push(...seq(60,1/60,7.8+27/60,()=>({w:W,h:H})));
  const {r}=await capture(frames,[1200,646]);
  assert.equal(r.status,'candidates-detected');assert.ok(r.windows.length>0,'Windows survive beyond 32 segments');
  assert.equal($('headline').textContent,'Potential flashing detected');assert.equal(r.startupSettling.transitionalSegments,40);assert.equal(r.startupSettling.transitionalScreening.length,32);}
// RT2-05: settling-buffer overflow is labelled as dropped final-size frames, not transitional ones.
{const {r}=await capture(seq(70,1/120,0,()=>({w:640,h:640})),[640,640],'640');
  const st=r.startupSettling;assert.ok(st.bufferOverflowFrames>0,'Overflow reached at 640 x 640, 120 fps');assert.equal(st.transitionalFrames,0);
  assert.ok(r.limitations.some(l=>l.includes('dropped by the 64 MB settling buffer')));assert.ok(!r.limitations.some(l=>l.includes('transitional or invalid sizes were discarded')));}
// RT2-09: a hidden analyzer is reported and the capture cannot meet the minimum.
{$('area-enabled').checked=false;$('resolution').value='320';await $('setup').fire('submit');
  for(const f of seq(30,1/60,0,()=>({w:W,h:H}))){video.videoWidth=f.w;video.videoHeight=f.h;cb(f.t*1000,{mediaTime:f.t});}
  document.hidden=true;docListeners.visibilitychange();document.hidden=false;docListeners.visibilitychange();
  for(const f of seq(90,1/60,.5,()=>({w:W,h:H}))){video.videoWidth=f.w;video.videoHeight=f.h;cb(f.t*1000,{mediaTime:f.t});}
  await $('stop').fire('click');const r=JSON.parse((await exportAll())[0]);
  assert.equal(r.analyzerHidden.events,1);assert.equal(r.observation.meetsScreeningMinimum,false);
  assert.ok(r.observation.reasons.some(x=>x.startsWith('The analyzer page was hidden')));}
// Transitional SC 2.3.2 windows survive: bright-only flicker at a transitional size.
{const {r}=await capture([...seq(28,1/60,0,(i,t)=>({w:W,h:H+120,rgb:Math.floor(t*20+1e-9)%2?[255,255,255]:[230,230,230]})),...seq(90,1/60,28/60,()=>({w:W,h:H,rgb:[230,230,230]}))],[1200,646]);
  assert.equal(r.sc232.status,'candidates-detected');assert.ok(r.sc232.windows.some(w=>w.startupTransitional),'Transitional SC 2.3.2 window kept');
  // Window times are relative to the analysis origin (28/60 s): inside the transitional interval, before 0.
  for(const w of r.windows.concat(r.sc232.windows).filter(w=>w.startupTransitional))assert.ok(w.end<0&&w.end>=-28/60-1e-9&&w.start<=w.end,JSON.stringify(w));}
// Screenshots of buffered startup frames come from the buffered pixels, not from the live video.
{const shotPaints=()=>paints.filter(p=>p.el!==els.get('pixels'));
  await capture(seq(20,1/60,0,()=>({w:W,h:H})),[1200,646],'320',true);
  assert.ok(shotPaints().length>0&&shotPaints().every(p=>p.kind==='put'),'Buffered frames are shot from their own pixels');}
// Aspect guard edges: 2.2% is rejected, 1.9% accepted.
{const r22=(await capture(seq(60,1/60,0,()=>({w:W,h:H})),[1200,646*1.022])).r,r19=(await capture(seq(60,1/60,0,()=>({w:W,h:H})),[1200,646*1.019])).r;
  assert.equal(r22.area.status,'calibration-rejected');assert.equal(r19.area.status,'calibrated-screening');}
// Buffer overflow drops the OLDEST frames: the analysis origin is the first retained frame.
{const {r}=await capture(seq(70,1/120,0,(i)=>({w:640,h:640,rgb:[i,i,i]})),[640,640],'640');
  const dropped=r.startupSettling.bufferOverflowFrames;assert.ok(dropped>0);assert.equal(r.evidence.trace[0].rgb[0],dropped,'First analyzed frame is frame number "dropped" (oldest dropped)');}
console.log('Startup settling passed: buffered stable-size frames, transitional screening, the startup bridge, >32 segments, buffer overflow labels, hidden analyzer, time origin, wording, unconfirmed static pages, zero-size frames, 2% aspect guard and exports (mock browser APIs).');
