// Startup settling regressions (NF-04, NF-07, RT-01, RT-03, RT-04, RT-09) and the
// geometry guards, driving production dist/app.mjs. MOCKED browser APIs: this does not
// establish native capture behaviour.
import assert from 'node:assert/strict';
import fs from 'node:fs';
let cb=null,rgb=[0,0,0];const blobs=[];
class El{constructor(){this.listeners={};this.children=[];this.dataset={};this.style={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';}
  addEventListener(t,f){this.listeners[t]=f;}async fire(t){return this.listeners[t]?.({preventDefault(){}});}
  append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(k,v){this[k]=v;}click(){}focus(){}
  getContext(){return {drawImage(){},putImageData(){},fillRect(){},getImageData(x,y,w,h){const d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d.set(rgb,i*4);d[i*4+3]=255;}return {data:d};}};}
  toDataURL(){return 'data:image/png;base64,AAAA';}}
const html=fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
const els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El()]));
globalThis.document={getElementById:id=>els.get(id),createElement:()=>new El(),querySelectorAll:()=>[],addEventListener(){}};
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
async function capture(frames,cal){
  $('duration').value='30';$('resolution').value='320';$('probe-x').value='50';$('probe-y').value='50';$('keep-shots').checked=false;
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
console.log('Startup settling passed: buffered stable-size frames, transitional screening, time origin, wording, unconfirmed static pages, zero-size frames, 2% aspect guard and exports (mock browser APIs).');
