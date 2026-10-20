// Image-file/URL controls and errors without presenting images or flashes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
class Element{
  constructor(){this.listeners={};this.children=[];this.value='';this.files=[];this.checked=false;this.disabled=false;this.hidden=false;this.style={};this.textContent='';this.width=64;this.height=48;}
  addEventListener(n,fn){this.listeners[n]=fn;}fire(n,e={}){return this.listeners[n]?.(e);}append(n){this.children.push(n);}replaceChildren(){this.children=[];}focus(){}click(){}
  getContext(){let color=0;return {fillRect(){color=0;},set fillStyle(v){},drawImage(bitmap){assert.ok(!bitmap.closed,'Detached bitmaps must never be used');color=bitmap.color;},getImageData:(x,y,w,h)=>{const data=new Uint8ClampedArray(w*h*4);for(let i=0;i<data.length;i+=4){data[i]=data[i+1]=data[i+2]=color;data[i+3]=255;}return {data};}};}
}
const html=fs.readFileSync(new URL('./dist/image-sequences.html',import.meta.url),'utf8');
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));const $=id=>elements.get(id);
const docEvents={},winEvents={};
globalThis.document={hidden:false,getElementById:$,createElement:()=>new Element(),addEventListener:(n,fn)=>docEvents[n]=fn};
globalThis.window={innerWidth:1400,innerHeight:1000,scrollTo(){},addEventListener:(n,fn)=>winEvents[n]=fn};
globalThis.location={href:'http://localhost/image-sequences.html'};
let closed=0;globalThis.createImageBitmap=async blob=>({width:1024,height:768,color:new Uint8Array(await blob.arrayBuffer())[3],close(){this.closed=true;closed++;}});
let raf=null,timer=null,download=null;
globalThis.requestAnimationFrame=fn=>{raf=fn;return 1;};globalThis.cancelAnimationFrame=()=>raf=null;
const realTimeout=setTimeout,realClear=clearTimeout;
globalThis.setTimeout=(fn,ms)=>{if(ms===3000){timer=fn;return -1;}return realTimeout(fn,ms);};globalThis.clearTimeout=id=>{if(id===-1)timer=null;else realClear(id);};
URL.createObjectURL=blob=>{download=blob;return 'blob:test';};URL.revokeObjectURL=()=>{};
$('width').value='1024';$('height').value='768';$('seed').value='12345';$('changes').value='20';$('stage').hidden=true;
await import('./dist/image-sequences-page.mjs');
assert.equal($('play').disabled,true);assert.equal($('pairs').disabled,true);assert.equal(raf,null);
function file(name,value){const blob=new Blob([new Uint8Array([255,216,255,value])]);blob.name=name;return blob;}
$('files').files=[file('black.jpg',0),file('white.jpg',255)];await $('load').fire('click');
assert.ok($('load-status').textContent.includes('2/2 loaded'));assert.equal($('pairs').disabled,false);assert.equal($('play').disabled,true);
await $('pairs').fire('click');assert.equal($('rows').children.length,2);$('download').fire('click');
let report=JSON.parse(await download.text());assert.equal(report.results.length,2);assert.ok(report.results.every(r=>r.peakGeneral===10&&r.evaluation.area==='calibrated-screening'));
assert.equal(report.coverage,'finite-selected-sequences-only');
$('urls').value='invalid-url';$('urls').fire('input');assert.equal($('pairs').disabled,true);assert.equal($('download').disabled,true);
await $('load').fire('click');assert.equal($('pairs').disabled,true,'Invalid new sources cannot reuse old results');
$('urls').value='';await $('load').fire('click');
$('changes').value='4';$('changes').fire('change');assert.equal($('download').disabled,true);await $('pairs').fire('click');$('download').fire('click');
report=JSON.parse(await download.text());assert.ok(report.results.every(r=>r.peakGeneral===2&&!r.windows.length));
$('changes').value='20';$('changes').fire('change');await $('shuffle').fire('click');$('download').fire('click');report=JSON.parse(await download.text());assert.equal(report.plan.length,61);
$('ack').checked=true;$('ack').fire('change');assert.equal($('play').disabled,true,'Checkbox alone does not unlock image playback');
$('confirm-text').value='I agree';$('ack').fire('change');$('play').fire('click');assert.equal($('stage').hidden,false);assert.ok(raf);docEvents.keydown({key:'Escape'});assert.equal($('stage').hidden,true);assert.equal(raf,null);assert.equal(timer,null);assert.equal($('ack').checked,false);
for(const mode of ['timeout','hidden','blur','resize']){
  $('confirm-text').value='I agree';$('ack').checked=true;$('ack').fire('change');$('play').fire('click');
  if(mode==='timeout')timer();if(mode==='hidden'){document.hidden=true;docEvents.visibilitychange();document.hidden=false;}if(mode==='blur')winEvents.blur();if(mode==='resize')winEvents.resize();
  assert.equal($('stage').hidden,true);assert.equal($('ack').checked,false);assert.equal($('confirm-text').value,'');
}
window.innerWidth=500;$('confirm-text').value='I agree';$('ack').checked=true;$('ack').fire('change');$('play').fire('click');assert.ok($('result').textContent.includes('Enlarge'));assert.equal(raf,null);window.innerWidth=1400;
globalThis.fetch=async url=>{if(url.includes('denied'))throw Error('CORS denied');return new Response(new Uint8Array([255,216,255,128]));};
$('urls').value='https://example.com/gray.jpg\nhttps://example.com/denied.jpg';await $('load').fire('click');assert.ok(closed>=2);assert.ok($('load-status').textContent.includes('COVERAGE INCOMPLETE'));
await $('pairs').fire('click');$('download').fire('click');report=JSON.parse(await download.text());assert.equal(report.coverage,'incomplete-load-failures');assert.equal(report.loadFailures.length,1);assert.equal(report.images.length,3);assert.ok(!JSON.stringify(report).includes('https://example.com/gray.jpg'),'Export excludes source URLs');
$('files').files=[new Blob(['GIF89a'])];$('urls').value='';await $('load').fire('click');assert.equal($('pairs').disabled,true);assert.ok($('load-status').textContent.includes('not supported'));
// AI-02: persisted documents must not advertise released image resources.
$('files').files=[file('a.jpg',0),file('b.jpg',255)];await $('load').fire('click');await $('shuffle').fire('click');
winEvents.pagehide({persisted:true});assert.equal($('load').disabled,true);assert.equal($('download').disabled,true);
winEvents.pageshow({persisted:true});assert.equal($('load').disabled,false);assert.equal($('pairs').disabled,true);assert.equal($('play').disabled,true);
assert.ok($('load-status').textContent.includes('Load images again'));
await $('load').fire('click');await $('shuffle').fire('click');assert.equal($('download').disabled,false);
// A bitmap decoded after release must be closed, never adopted by the restored page.
const normalDecode=createImageBitmap;let releaseDecode,decoding;
const decodeStarted=new Promise(resolve=>decoding=resolve),decodeGate=new Promise(resolve=>releaseDecode=resolve);
globalThis.createImageBitmap=async blob=>{decoding();await decodeGate;return normalDecode(blob);};
const loading=$('load').fire('click');await decodeStarted;winEvents.pagehide({persisted:true});winEvents.pageshow({persisted:true});
const closedBefore=closed;releaseDecode();await loading;assert.equal(closed,closedBefore+1);assert.equal($('pairs').disabled,true);
assert.ok($('load-status').textContent.includes('Load images again'));globalThis.createImageBitmap=normalDecode;
// Likewise, canceled network loads and yielding analyses cannot revive old results.
let respond,seenSignal;globalThis.fetch=(url,options)=>{seenSignal=options.signal;return new Promise(resolve=>respond=resolve);};
$('files').files=[];$('urls').value='https://example.com/late.jpg';const networkLoad=$('load').fire('click');
winEvents.pagehide({persisted:true});winEvents.pageshow({persisted:true});assert.equal(seenSignal.aborted,true);
respond(new Response(new Uint8Array([255,216,255,0])));await networkLoad;assert.equal($('pairs').disabled,true);
$('urls').value='';$('files').files=[file('a.jpg',0),file('b.jpg',255)];await $('load').fire('click');
const oldAnalysis=$('pairs').fire('click');winEvents.pagehide({persisted:true});winEvents.pageshow({persisted:true});
await $('load').fire('click');await oldAnalysis;assert.equal($('download').disabled,true);assert.equal($('rows').children.length,0);
assert.equal($('pairs').disabled,false);await $('shuffle').fire('click');assert.equal($('download').disabled,false);
// NF-01: the first native animation timestamp can precede the immediate draw.
// Supply separate callback timestamps and monotonic entry-clock readings; the
// exported elapsed times must follow the entry clock on every repeated run.
const originalPerformance=Object.getOwnPropertyDescriptor(globalThis,'performance');
let entryClock=0;
Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>entryClock}});
try{
  for(const [runIndex,firstOffset] of [-3.3999999985,-1.7799999956,0,16.6667].entries()){
    const origin=1000+runIndex*10000;entryClock=origin;
    $('confirm-text').value='I agree';$('ack').checked=true;$('ack').fire('change');$('play').fire('click');
    assert.equal($('stage').hidden,false);
    const firstCallback=raf;
    $('play').fire('click');assert.equal(raf,firstCallback,'Repeated Start must not create a second callback chain');
    const offsets=[0,1,50,50,150,2999];
    for(const [index,offset] of offsets.entries()){
      entryClock=origin+offset;const callback=raf;raf=null;
      callback(origin+firstOffset+index*16.6667);
    }
    entryClock=origin+3000;const callback=raf;callback(origin+100);
    assert.equal($('stage').hidden,true);assert.equal(raf,null);assert.equal(timer,null);
    $('download').fire('click');const live=JSON.parse(await download.text());
    const expected=[0,0,.001,.05,.05,.15,2.999];
    assert.equal(live.drawCallbacks.length,expected.length);
    live.drawCallbacks.forEach((entry,index)=>{
      assert.ok(Math.abs(entry.time-expected[index])<1e-12,`NF-01: callback ${index} must use elapsed entry time, not the supplied animation timestamp`);
      assert.ok(entry.time>=0&&entry.time<3);
      if(index)assert.ok(entry.time>=live.drawCallbacks[index-1].time);
      const expectedImage=live.plan.filter(step=>step.time<=expected[index]).at(-1).image;
      assert.equal(entry.image,expectedImage,'Drawn image follows the same elapsed clock at schedule boundaries');
    });
    assert.equal(live.observedSeconds,3);assert.equal(live.endedBecause,'three-second limit');
    assert.ok(live.note.includes('not proof of displayed or captured frames'));
  }
}finally{Object.defineProperty(globalThis,'performance',originalPerformance);}
console.log('Image input/playback contracts and AI-02 history restoration, late decoding, aborted network loading and interrupted analysis regressions passed.');
console.log('NF-01 startup-clock regressions passed: earlier/same/later animation timestamps, repeated Start/replay, duplicate entry times, schedule boundaries and duration cap (mock browser APIs).');
