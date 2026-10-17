// Browser API contract tests with fake surfaces. These do not replace real browser QA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
let frameCallback=null,gray=0,stopped=0,playCount=0,drawCalls=0;
class Element {
  constructor(tag='div'){this.tag=tag;this.listeners={};this.children=[];this.dataset={};this.style={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';}
  addEventListener(type,fn){this.listeners[type]=fn;}
  async fire(type){return this.listeners[type]?.({preventDefault(){},key:'Escape'});}
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(name,value){this[name]=value;}
  focus(){}
  click(){}
  getContext(){return {drawImage(){drawCalls++;},putImageData(){},fillRect(){},getImageData(x,y,w=1,h=1){return {data:new Uint8ClampedArray(w*h*4).map((_,i)=>i%4===3?255:gray)};}};}
  toDataURL(){return 'data:image/png;base64,TEST';}
}
const html=fs.readFileSync(new URL('./dist/index.html',import.meta.url),'utf8');
let elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
globalThis.document={getElementById(id){assert.ok(elements.has(id),`HTML contains ${id}`);return elements.get(id);},createElement:tag=>new Element(tag),querySelectorAll(){return elements.get('examples').children.flatMap(x=>x.children).filter(x=>x.dataset.example);},addEventListener(){},hidden:false};
globalThis.window={addEventListener(){}};
globalThis.ImageData=class {constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
const track={stop(){stopped++;},getSettings(){return {width:1,height:1,frameRate:120,displaySurface:'browser'};},addEventListener(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{async getDisplayMedia(){return {getVideoTracks:()=>[track],getTracks:()=>[track]};}}}});
const $=id=>document.getElementById(id),video=$('source');
video.requestVideoFrameCallback=fn=>{frameCallback=fn;return 1;};video.cancelVideoFrameCallback=()=>{};
video.videoWidth=1;video.videoHeight=1;video.pause=()=>{};video.play=async()=>{playCount++;};
$('duration').value='10';$('resolution').value='320';$('probe-x').value='50';$('probe-y').value='50';$('keep-shots').checked=true;
await import('./dist/app.mjs');
assert.equal($('examples').children.length,7,'Seven example cards');
assert.equal(playCount,0,'No capture or example autoplay');
await $('setup').fire('submit');assert.equal($('start').disabled,true);assert.equal($('stop').hidden,false);
for(let i=0;i<=120;i++){gray=Math.floor(i/15)%2?255:0;frameCallback(i*1000/120,{mediaTime:i/120});}
await $('stop').fire('click');assert.equal(stopped,1,'Capture sharing stopped');assert.equal($('report').hidden,false);
assert.ok($('luminance-evidence').innerHTML.includes('Highest Y: 1.00000'),'Measured Y reaches output');
assert.ok($('luminance-evidence').innerHTML.includes('data:image/png;base64,TEST'),'Captured screenshot reaches output');
assert.equal($('start').disabled,false);
$('area-enabled').checked=true;$('css-width').value='1';$('css-height').value='1';$('presentation').value='content-fullscreen';
await $('setup').fire('submit');
for(let i=0;i<=120;i++){gray=Math.floor(i/6)%2?255:0;frameCallback(i*1000/120,{mediaTime:i/120});}
await $('stop').fire('click');
assert.ok($('quality').textContent.includes('Calibration 1 × 1'),'Calibrated area reaches capture UI');
$('css-width').value='2';await $('setup').fire('submit');for(let i=0;i<=60&&!$('stop').hidden;i++)frameCallback(i*1000/120,{mediaTime:i/120});
assert.equal($('stop').hidden,true);assert.ok($('quality').textContent.includes('aspect ratio'),'Wrong calibration is rejected before measurement');
// NF-02/NF-03: zero-frame exits keep supplied calibration distinct from absent
// calibration, and every export control produces a file. Independent reader below.
function parseCsv(text){const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(c===','&&!quoted){row.push(cell);cell='';}else if(c==='\n'&&!quoted){row.push(cell);rows.push(row);row=[];cell='';}else cell+=c;}
  row.push(cell);rows.push(row);assert.equal(quoted,false);return rows;}
const realObjectURL=URL.createObjectURL,realRevoke=URL.revokeObjectURL;let downloads=[];
URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:test';};URL.revokeObjectURL=()=>{};
async function exportAll(){downloads=[];for(const id of ['json','csv','witness-csv','html-report','text'])await $(id).fire('click');
  assert.equal(downloads.length,5,'All five export controls create a file');return Promise.all(downloads.map(b=>b.text()));}
function checkZeroFrame(files,status,reasonPart,observed){
  const [jsonText,probe,witness,htmlOut,text]=files,r=JSON.parse(jsonText);
  assert.equal(r.frames,0);assert.equal(r.status,'insufficient-observation');assert.equal(r.evidence,undefined);
  assert.equal(r.area.status,status);assert.equal(r.evaluation.area,status);assert.equal(r.evaluation.conformance,'not-determined');
  assert.deepEqual(r.area.calibration,{cssWidth:2,cssHeight:1});assert.deepEqual(r.captureSettings.calibration,{cssWidth:2,cssHeight:1});
  assert.ok(r.area.reason.includes(reasonPart),r.area.reason);assert.deepEqual(r.area.observedSourcePixels,observed);
  for(const [label,out] of [['UI',$('quality').textContent],['HTML',htmlOut],['text',text]]){
    assert.ok(!out.includes('dimensions were not supplied'),`${label} must not call supplied calibration missing`);
    assert.ok(out.includes('supplied calibration 2 × 1 CSS pixels was '+(status==='calibration-rejected'?'rejected':'not applied')),label);}
  for(const content of [probe,witness]){
    const [header,...rows]=parseCsv(content),row=Object.fromEntries(header.map((k,i)=>[k,rows[0][i]]));
    assert.equal(rows.length,1,'One metadata-only record');assert.equal(row.record_type,'metadata');assert.equal(row.time_seconds,'','No invented measurements');
    assert.equal(row.report_id,r.reportId);assert.equal(row.build_id,r.buildId);assert.equal(row.calibration_status,status);
    assert.equal(row.calibration_css_width,'2');assert.equal(row.calibration_css_height,'1');assert.ok(row.area_reason.includes(reasonPart));
    assert.deepEqual(JSON.parse(row.area_observed_source_pixels_json),observed);
    assert.equal(JSON.parse(row.evidence_coverage_json).status,'not-collected');}
}
checkZeroFrame(await exportAll(),'calibration-rejected','aspect ratio',{width:1,height:1});
// Calibrated capture stopped before its first frame: input retained, not applied, no rejected geometry.
await $('setup').fire('submit');await $('stop').fire('click');
checkZeroFrame(await exportAll(),'not-evaluated','No frames were analyzed',null);
$('area-enabled').checked=false;
await $('setup').fire('submit');await $('stop').fire('click');
assert.ok($('quality').textContent.includes('displayed CSS dimensions were not supplied'),'Absent calibration wording unchanged');
const [plainJson]=await exportAll();assert.equal(JSON.parse(plainJson).area.status,'not-evaluated');assert.equal(JSON.parse(plainJson).area.calibration,undefined);
// NF-04: sharing UI animates the shared surface at startup. Transitional sizes
// are discarded and reported; geometry locks only after 0.5 s of stability, and
// a later change still stops the capture. Times are exact binary fractions.
$('area-enabled').checked=true;$('css-width').value='2';$('css-height').value='1';
await $('setup').fire('submit');
for(let i=0;i<=260&&!$('stop').hidden;i++){const t=i/128;
  [video.videoWidth,video.videoHeight]=t<.0625?[1,1]:t<.125?[3,2]:i<200?[2,1]:[4,2];
  gray=Math.floor(i/8)%2?255:0;frameCallback(t*1000,{mediaTime:t});}
assert.equal($('stop').hidden,true,'Post-settle size change still stops');
const settledReport=JSON.parse((await exportAll())[0]);
assert.equal(settledReport.area.status,'calibrated-screening','Transitional startup frames do not reject valid calibration');
assert.deepEqual(settledReport.viewport,{width:2,height:1});
assert.equal(settledReport.startupSettling.discardedFrames,80,'Frames before 0.125+0.5 s discarded');
assert.equal(settledReport.startupSettling.discardedMediaSeconds,.625);assert.equal(settledReport.startupSettling.settled,true);
assert.deepEqual(settledReport.startupSettling.sourceSizes.map(x=>[x.width,x.height]),[[1,1],[3,2],[2,1]]);
assert.equal(settledReport.frames,120,'Frames 80..199 analyzed');assert.ok(settledReport.endedBecause.includes('dimensions changed'));
assert.ok(settledReport.limitations.some(x=>x.includes('80 startup frame(s) were discarded')));
// Size never settles: reported as unsettled, calibration not applied, not "not supplied".
await $('setup').fire('submit');
for(let i=0;i<40;i++){[video.videoWidth,video.videoHeight]=i%2?[2,1]:[4,1];frameCallback(i*1000/128,{mediaTime:i/128});}
await $('stop').fire('click');
const unsettled=JSON.parse((await exportAll())[0]);
assert.equal(unsettled.frames,0);assert.equal(unsettled.startupSettling.settled,false);assert.equal(unsettled.area.status,'not-evaluated');
assert.ok(unsettled.area.reason.includes('did not stay unchanged'));assert.ok(unsettled.observation.reasons.some(x=>x.includes('did not stay unchanged')));
assert.ok(unsettled.area.reason.includes('kept changing'));
// NF-07: one frame at a constant size, then nothing (static content). Unconfirmed, not unstable.
await $('setup').fire('submit');
[video.videoWidth,video.videoHeight]=[2,1];frameCallback(0,{mediaTime:0});
await $('stop').fire('click');
const single=JSON.parse((await exportAll())[0]);
assert.equal(single.frames,0);assert.equal(single.startupSettling.discardedFrames,1);
assert.ok(single.area.reason.includes('Only one frame size was observed')&&!single.area.reason.includes('kept changing'),single.area.reason);
assert.ok(single.observation.reasons.some(x=>x.includes('no later frame arrived')));
video.videoWidth=1;video.videoHeight=1;$('area-enabled').checked=false;
URL.createObjectURL=realObjectURL;URL.revokeObjectURL=realRevoke;
const failButton=$('examples').children[3].children.find(x=>x.dataset.example);
await failButton.fire('click');assert.ok($('quality').textContent.startsWith('Synthetic example:'));
assert.equal($('general').textContent,4,'Failing fixture measured through UI');
const originalCapture=navigator.mediaDevices.getDisplayMedia;
navigator.mediaDevices.getDisplayMedia=async()=>{throw Object.assign(new Error('Canceled'),{name:'NotAllowedError'});};
await $('setup').fire('submit');assert.equal($('report').hidden,true,'Canceled new capture clears stale report');
assert.equal($('headline').textContent,'Capture did not start');
navigator.mediaDevices.getDisplayMedia=originalCapture;
const realSetTimeout=globalThis.setTimeout,realClearTimeout=globalThis.clearTimeout;
let startupWatchdog=null,resolvePlayback;
globalThis.setTimeout=(fn,ms)=>{if(ms===10000)startupWatchdog=fn;return 1;};
globalThis.clearTimeout=()=>{};
video.play=()=>new Promise(resolve=>{resolvePlayback=resolve;});
const starting=$('setup').fire('submit');await Promise.resolve();await Promise.resolve();
assert.equal(typeof startupWatchdog,'function','Startup timeout armed before video.play completes');
startupWatchdog();assert.equal($('headline').textContent,'Insufficient observation — inconclusive');
assert.equal($('stop').hidden,true,'Startup watchdog stops sharing');
resolvePlayback();await starting;
globalThis.setTimeout=realSetTimeout;globalThis.clearTimeout=realClearTimeout;
// Verify the live fail page never draws before explicit acknowledgment and start.
const exampleHtml=fs.readFileSync(new URL('./dist/example.html',import.meta.url),'utf8');
elements=new Map([...exampleHtml.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
globalThis.location={href:'https://example.test/example.html?case=four'};
let rafCalls=0,liveCallback=null;
globalThis.requestAnimationFrame=fn=>{rafCalls++;liveCallback=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
await import('./dist/example-page.mjs');
assert.equal(rafCalls,0,'No animation starts on page load');
await $('play').fire('click');assert.equal(rafCalls,0,'Unacknowledged click cannot start animation');
$('ack').checked=true;await $('ack').fire('change');assert.equal($('play').disabled,false);
await $('play').fire('click');assert.equal(rafCalls,1,'Animation requires acknowledgment plus Start');
await $('halt').fire('click');assert.equal($('test-field').hidden,true);assert.equal($('ack').checked,false);assert.equal($('play').disabled,true);
console.log('Capture-to-evidence flow, synthetic example UI, and live-warning gates passed (mock browser APIs)');
