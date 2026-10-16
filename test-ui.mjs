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
  getContext(){return {drawImage(){drawCalls++;},putImageData(){},fillRect(){},getImageData(){return {data:new Uint8ClampedArray([gray,gray,gray,255])};}};}
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
