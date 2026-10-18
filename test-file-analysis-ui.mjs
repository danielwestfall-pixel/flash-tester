// Behaviour of dist/file-analysis-page.mjs with MOCKED media APIs (video element, canvas,
// ImageDecoder, File). Native decoding is verified separately by
// tools/verify-file-analysis.mjs. Nothing is displayed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('./dist/file-analysis.html',import.meta.url),'utf8');
const marker=html.match(/<meta name="flash-review-build" content="([^"]*)">/)[1];
const appended=[],downloads=[],revoked=[],styleAtSeek=[],fills=[];
class El{constructor(tag='div'){this.tag=tag;this.listeners={};this.children=[];this.dataset={};this.style={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';this.files=[];this.attrs={};}
  addEventListener(t,f,o){(this.listeners[t]??=[]).push({f,once:o?.once});}removeEventListener(t,f){this.listeners[t]=(this.listeners[t]??[]).filter(x=>x.f!==f);}
  dispatch(t,e={}){for(const l of [...(this.listeners[t]??[])]){if(l.once)this.removeEventListener(t,l.f);l.f(e);}}
  async fire(t){for(const l of [...(this.listeners[t]??[])])await l.f({preventDefault(){}});}
  append(...n){this.children.push(...n);}replaceChildren(...n){this.children=n;}setAttribute(k,v){this.attrs[k]=v;}removeAttribute(k){delete this.attrs[k];}focus(){}
  click(){if(this.tag==='a')downloads.push(this.download);}remove(){const i=appended.indexOf(this);if(i>=0)appended.splice(i,1);}
  getContext(){const el=this;return {fillStyle:'#000000',fillRect(){fills.push(this.fillStyle);el.current=null;el.bg=this.fillStyle;},
    drawImage(src){el.current=src.frameRGB?.()??null;},putImageData(){},
    getImageData(x,y,w,h){const d=new Uint8ClampedArray(w*h*4),bg=el.bg?[parseInt(el.bg.slice(1,3),16),parseInt(el.bg.slice(3,5),16),parseInt(el.bg.slice(5,7),16)]:[0,0,0],c=el.current??bg;for(let i=0;i<w*h;i++){d.set(c,i*4);d[i*4+3]=255;}return {data:d};}};}
  toDataURL(){return 'data:image/png;base64,AAAA';}}
// Mock video: 4 Hz black/white, frames at 60 fps; seeking fires 'seeked' asynchronously.
let videoSpec=null;
class MockVideo extends El{
  constructor(){super('video');this._t=0;}
  set src(v){this._src=v;setTimeout(()=>{if(videoSpec.fail){this.dispatch('error');return;}this.videoWidth=videoSpec.w;this.videoHeight=videoSpec.h;this.duration=videoSpec.duration;this.dispatch('loadeddata');},0);}
  get src(){return this._src;}load(){}
  set currentTime(t){this._t=t;styleAtSeek.push({...this.style,cssText:this.style.cssText,aria:this.attrs['aria-hidden'],attached:appended.includes(this)});
    if(videoSpec.findDuration&&t>=1e6)this.duration=videoSpec.findDuration;if(videoSpec.resizeAt!=null&&t>=videoSpec.resizeAt)this.videoWidth=videoSpec.w+2;
    setTimeout(()=>this.dispatch('seeked'),0);}
  get currentTime(){return this._t;}
  frameRGB(){const n=Math.floor(Math.min(this._t,videoSpec.trueDuration??this._t)*60);return Math.floor(n*8/60)%2?[255,255,255]:[0,0,0];}
}
const els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El()]));
globalThis.document={getElementById:id=>els.get(id),createElement:t=>t==='video'?new MockVideo():new El(t),querySelectorAll:()=>[],addEventListener(){},
  querySelector:s=>s==='meta[name="flash-review-build"]'?{getAttribute:()=>marker}:null,body:{append:(...n)=>appended.push(...n)}};
globalThis.window={addEventListener(){}};globalThis.ImageData=class{constructor(d,w,h){Object.assign(this,{data:d,width:w,height:h});}};
URL.createObjectURL=()=>'blob:mock';URL.revokeObjectURL=u=>revoked.push(u);
const blobs=[];const RealBlob=globalThis.Blob;globalThis.Blob=class extends RealBlob{constructor(p,o){super(p,o);blobs.push(this);}};
// Mock ImageDecoder: frames given as {rgb|null (transparent), durationUs}.
let imageSpec=null;
globalThis.ImageDecoder=class{static async isTypeSupported(){return true;}
  constructor({type}){this.type=type;const s=imageSpec;this.tracks={ready:Promise.resolve(),selectedTrack:{frameCount:s.frames.length,repetitionCount:s.repetitionCount,animated:s.frames.length>1}};this.completed=Promise.resolve();}
  async decode({frameIndex}){const f=imageSpec.frames[frameIndex];return {image:{displayWidth:imageSpec.w,displayHeight:imageSpec.h,duration:f.durationUs,timestamp:0,close(){},frameRGB:()=>f.rgb}};}
  close(){}};
const $=id=>els.get(id);
const page=await import('./dist/file-analysis-page.mjs');
assert.equal(globalThis.flashReviewReady,true);
const bytes=crypto.randomBytes(4096),fileOf=(name,type)=>({name,type,size:bytes.length,lastModified:0,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length)});
async function analyze(file,opts={}){
  Object.assign($('rate'),{value:opts.rate??'60'});$('max-seconds').value=opts.max??'30';$('resolution').value='320';$('timing').value=opts.timing??'display';$('background').value=opts.background??'#ffffff';
  $('area-enabled').checked=!!opts.cal;if(opts.cal){$('css-width').value=String(opts.cal[0]);$('css-height').value=String(opts.cal[1]);}$('keep-shots').checked=false;
  $('file').files=[file];$('status').textContent='';downloads.length=0;blobs.length=0;
  const done=$('setup').fire('submit');
  if(opts.cancelAfterMs!=null){await new Promise(r=>setTimeout(r,opts.cancelAfterMs));await $('cancel').fire('click');}
  await done;
  if(!$('status').textContent.startsWith('Done'))return {status:$('status').textContent};
  await $('json').fire('click');return {status:$('status').textContent,report:JSON.parse(await blobs.at(-1).text())};
}
// 1. Video: frame-accurate result, provenance and SHA-256; never visible; cleaned up.
videoSpec={w:640,h:360,duration:4};
{const {report:r}=await analyze(fileOf('clip.mp4','video/mp4'));
  assert.equal(r.peakGeneral,4);assert.equal(r.status,'candidates-detected');assert.equal(r.sc232.status,'candidates-detected');assert.equal(r.frames,240);
  assert.equal(r.sourceType,'local-file-decoded');assert.equal(r.sourceFile.sha256,crypto.createHash('sha256').update(bytes).digest('hex'),'SHA-256 of the file bytes');
  assert.equal(r.sourceFile.name,'clip.mp4');assert.equal(r.sourceFile.sampleOffset,.3);
  assert.ok(styleAtSeek.length>0&&styleAtSeek.every(s=>s.attached&&/opacity:0/.test(s.cssText)&&/width:1px/.test(s.cssText)&&/height:1px/.test(s.cssText)&&s.aria==='true'),'Video is attached, 1 px and transparent at every seek');
  assert.equal(appended.filter(e=>e.tag==='video').length,0,'Video element removed afterwards');assert.ok(revoked.includes('blob:mock'),'Object URL revoked');}
// 2. Aspect guard: a 20% mismatch is refused before analysis.
{const {status}=await analyze(fileOf('clip.mp4','video/mp4'),{cal:[640,432]});assert.match(status,/^Analysis failed: Area calibration 640 × 432/);}
{const {report:r}=await analyze(fileOf('clip.mp4','video/mp4'),{cal:[1280,720]});assert.equal(r.area.status,'calibrated-screening');}
// 3. A dimension change stops the analysis at the change.
videoSpec={w:640,h:360,duration:4,resizeAt:2};
{const {report:r}=await analyze(fileOf('clip.mp4','video/mp4'));assert.equal(r.endedBecause,'Video dimensions changed; analysis stopped at the change');assert.ok(r.frames<130);}
// 4. Infinity duration (recorded WebM): the real duration is found by seeking to the end.
videoSpec={w:640,h:360,duration:Infinity,findDuration:3,trueDuration:3};
{const {report:r}=await analyze(fileOf('rec.webm','video/webm'));assert.equal(r.frames,180);assert.equal(r.endedBecause,'Whole file analyzed');
  assert.equal(r.sourceFile.durationSeconds,3);assert.match(r.sourceFile.durationNote,/found by seeking to the end/);}
videoSpec={w:640,h:360,duration:Infinity,trueDuration:3};
{const {report:r}=await analyze(fileOf('rec.webm','video/webm'),{max:'10'});assert.match(r.endedBecause,/duration unknown/);assert.ok(r.limitations.some(l=>l.includes('duration is unknown')));}
// 5. Unsupported video fails visibly.
videoSpec={w:640,h:360,duration:4,fail:true};
{const {status}=await analyze(fileOf('bad.mkv','video/x-matroska'));assert.match(status,/^Analysis failed: This browser cannot decode this video/);}
// 6. Animated image: display timing (10 ms shown for 100 ms), alternate encoded timing, plays.
imageSpec={w:64,h:36,repetitionCount:Infinity,frames:[{rgb:[0,0,0],durationUs:10000},{rgb:[255,255,255],durationUs:10000}]};
{const {report:r}=await analyze(fileOf('fast.gif','image/gif'));
  assert.equal(r.peakGeneral,5);assert.equal(r.sourceFile.alternateTiming.timingModel,'encoded');assert.equal(r.sourceFile.alternateTiming.peakGeneral,50);
  assert.equal(r.sourceFile.repetitionCount,'infinite');assert.ok(r.sourceFile.playsAnalyzed>=2);assert.equal(r.sourceFile.framesAtOrBelow10ms,2);}
imageSpec={w:64,h:36,repetitionCount:2,frames:[{rgb:[0,0,0],durationUs:120000},{rgb:[255,255,255],durationUs:120000}]};
{const {report:r}=await analyze(fileOf('loop3.png','image/png'));assert.equal(r.sourceFile.playsAnalyzed,3,'repetitionCount 2 plays 3 times');assert.equal(r.peakGeneral,2,'5 transitions over 3 plays: 2 flashes');}
// 7. Transparency is composited over the chosen background before each frame.
imageSpec={w:64,h:36,repetitionCount:Infinity,frames:[{rgb:null,durationUs:120000},{rgb:[0,0,0],durationUs:120000}]};
{fills.length=0;const white=(await analyze(fileOf('t.png','image/png'),{background:'#ffffff'})).report,black=(await analyze(fileOf('t.png','image/png'),{background:'#000000'})).report;
  assert.equal(white.peakGeneral,4,'Transparent frames over white flash');assert.equal(black.peakGeneral,0,'Over black they do not');assert.ok(fills.includes('#ffffff')&&fills.includes('#000000'));}
// 8. The frame cap (3000) is applied and reported.
imageSpec={w:4,h:4,repetitionCount:0,frames:Array.from({length:3005},(_,i)=>({rgb:[i%2?255:0,0,0],durationUs:20000}))};
{const {report:r}=await analyze(fileOf('long.gif','image/gif'),{max:'10'});assert.equal(r.sourceFile.framesAnalyzed,3000);assert.equal(r.sourceFile.truncatedFrames,true);
  assert.ok(r.limitations.some(l=>l.includes('Only the first 3000 of 3005 frames')));}
// 9. Cancel produces no report; the next analysis is correct.
videoSpec={w:640,h:360,duration:30};
{const {status}=await analyze(fileOf('long.mp4','video/mp4'),{cancelAfterMs:20});assert.match(status,/canceled/);
  videoSpec={w:640,h:360,duration:4};const {report:r}=await analyze(fileOf('clip.mp4','video/mp4'));assert.equal(r.peakGeneral,4);}
// 10. Mixed builds: a stale module refuses analysis.
{const saved=globalThis.flashReviewModules['file-source'];globalThis.flashReviewModules['file-source']='flash-review-0.4.5-20261017';
  const {status}=await analyze(fileOf('clip.mp4','video/mp4'));assert.match(status,/Mixed Flash Review files are loaded \(file-source flash-review-0\.4\.5/);
  globalThis.flashReviewModules['file-source']=saved;}
assert.deepEqual(page.PAGE_MODULES.includes('file-source'),true);
console.log('File analysis page passed: video sampling, provenance and SHA-256, never-visible element, aspect guard, dimension change, unknown durations, timing models, loop counts, transparency, frame cap, cancel and module guard (mock media APIs).');
