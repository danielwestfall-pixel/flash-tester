// Control/timing contract checks without displaying flashing content.
import assert from 'node:assert/strict';
import fs from 'node:fs';
class Element{
  constructor(){this.listeners={};this.children=[];this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.textContent='';}
  addEventListener(name,fn){this.listeners[name]=fn;}
  fire(name,event={}){return this.listeners[name]?.(event);}
  append(node){this.children.push(node);}
  focus(){}
}
const html=fs.readFileSync(new URL('./dist/fixtures.html',import.meta.url),'utf8');
const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new Element()]));
const $=id=>elements.get(id);let paints=[],raf=null,watchdog=null;
const ctx={fillStyle:'',fillRect(...rect){paints.push({color:this.fillStyle,rect});}};
$('surface').width=1024;$('surface').height=768;$('surface').getContext=()=>ctx;
$('stage').hidden=true;
const docEvents={},winEvents={};
globalThis.document={hidden:false,getElementById:$,createElement:()=>new Element(),addEventListener:(n,fn)=>docEvents[n]=fn};
globalThis.window={innerWidth:1400,innerHeight:1000,scrollTo(){},addEventListener:(n,fn)=>winEvents[n]=fn};
globalThis.location={href:'http://localhost/fixtures.html?case=red-blue'};
globalThis.requestAnimationFrame=fn=>{raf=fn;return 1;};globalThis.cancelAnimationFrame=()=>{raf=null;};
globalThis.setTimeout=(fn,ms)=>{assert.equal(ms,3000);watchdog=fn;return 1;};globalThis.clearTimeout=()=>{watchdog=null;};
await import('./dist/fixtures-page.mjs');
assert.equal($('fixture').children.length,13);
assert.equal($('fixture').value,'red-blue');
assert.equal(paints.length,0,'No drawing before explicit start');
assert.equal($('start').disabled,true);
$('start').fire('click');assert.equal(paints.length,0,'Unacknowledged start rejected');
$('ack').checked=true;$('ack').fire('change');assert.equal($('start').disabled,true,'Checkbox alone does not unlock start');
$('ack').checked=false;$('ack').fire('change');
function start(){ $('confirm-text').value='I understand';$('ack').checked=true;$('ack').fire('change');$('start').fire('click'); }
start();assert.equal($('stage').hidden,false);assert.equal($('setup').hidden,true);assert.ok(raf);
assert.deepEqual(paints.at(-1),{color:'rgb(255,0,0)',rect:[0,0,1024,768]});
function checkStopped(){assert.equal($('stage').hidden,true);assert.equal($('setup').hidden,false);assert.equal($('ack').checked,false);assert.equal($('confirm-text').value,'');assert.equal($('start').disabled,true);assert.equal(raf,null);assert.equal(watchdog,null);}
$('halt').fire('click');checkStopped();
start();docEvents.keydown({key:'Escape'});checkStopped();
start();document.hidden=true;docEvents.visibilitychange();checkStopped();document.hidden=false;
start();winEvents.blur();checkStopped();
start();winEvents.pagehide();checkStopped();
start();winEvents.resize();checkStopped();
start();watchdog();checkStopped();
start();raf(performance.now()+4000);checkStopped();
window.innerWidth=1000;paints=[];start();assert.equal(paints.length,0,'Clipped reference surface rejected');assert.ok($('result').textContent.includes('Enlarge'));
window.innerWidth=1400;$('fixture').value='small-zone';$('fixture').fire('change');assert.equal($('ack').checked,false);
assert.ok($('details').textContent.includes('64 × 64'));start();assert.deepEqual(paints.at(-1).rect,[480,352,64,64]);$('halt').fire('click');checkStopped();
paints=[];$('analyze').fire('click');assert.equal(paints.length,0,'Synthetic analysis displays no animation');
const reports=JSON.parse($('analysis').textContent);assert.equal(reports.length,13);
assert.ok(reports.every(r=>r.actualApp===r.expectedApp));
assert.equal(reports.find(r=>r.id==='small-zone').area,'calibrated-screening');
console.log('Fixture UI contracts passed: warning gates, all stop paths, geometry, viewport guard and analysis without playback.');
