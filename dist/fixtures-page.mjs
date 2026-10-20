import {fixtures,fixtureSpec,fixtureInfo,fixtureRect,fixtureState,fixtureFrame} from './fixtures.mjs';
import {Analyzer} from './analyzer.mjs';
const $=id=>document.getElementById(id),canvas=$('surface'),ctx=canvas.getContext('2d');
let running=false,raf=null,timer=null,startTime=0,active=null,draws=0,skipped=0,lastFrame=null;
for(const f of fixtures){const o=document.createElement('option');o.value=f.id;o.textContent=`${f.expected.toUpperCase()} input · ${f.title}`;$('fixture').append(o);}
const requested=new URL(location.href).searchParams.get('case');
if(fixtures.some(f=>f.id===requested))$('fixture').value=requested;
function selected(){return fixtures.find(f=>f.id===$('fixture').value)||fixtures[0];}
function describe(){
  const f=selected(),v=fixtureInfo(f),hex=c=>'#'+c.map(n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
  $('details').textContent=[`Reference input: ${f.expected.toUpperCase()} · App: ${v.appExpected}`,
    `${hex(f.a)} ↔ ${hex(f.b)} · ${f.hz} complete flashes / second · ${2*f.hz} transitions / second`,
    `Y: ${v.luminanceA.toFixed(5)} ↔ ${v.luminanceB.toFixed(5)} · ΔY: ${v.deltaY.toFixed(5)}`,
    `Flashing zone: ${v.rect.width} × ${v.rect.height} pixels · ${(100*v.screenFraction).toFixed(2)}% of reference surface`,
    `Maximum flashing area in reference visual field: ${v.maxConcurrentPixelsInReferenceField.toLocaleString()} pixels (limit: 21,824)`].join('\n');
  $('note').textContent=f.note;$('ack').checked=false;$('start').disabled=true;
  if(confirmInput)confirmInput.value='';
  if(badge){badge.textContent='🔒 Locked';badge.className='failsafe-badge';}
}
const confirmInput=$('confirm-text'),badge=$('failsafe-badge');
export function normalizeFailsafeText(text){
  return (text||'')
    .replace(/[\u200B-\u200D\uFEFF]/g,'')
    .replace(/[\u00A0\s]+/g,' ')
    .replace(/["'“”]/g,'')
    .trim()
    .toLowerCase();
}
export function checkFailsafe(text){
  const val=normalizeFailsafeText(text);
  return val==='i agree'||val==='i understand';
}
function updateStartState(){
  const ok=confirmInput?checkFailsafe(confirmInput.value):true;
  $('start').disabled=!(ok&&$('ack').checked);
}
if(confirmInput){
  confirmInput.addEventListener('input',()=>{
    const ok=checkFailsafe(confirmInput.value);
    if(badge){
      badge.textContent=ok?'🔓 Confirmed: Fail-safe unlocked':'🔒 Locked';
      badge.className=ok?'failsafe-badge unlocked':'failsafe-badge';
    }
    updateStartState();
  });
}
describe();$('fixture').addEventListener('change',describe);
$('ack').addEventListener('change',updateStartState);
function stop(reason){
  if(!running)return;running=false;cancelAnimationFrame(raf);clearTimeout(timer);
  $('stage').hidden=true;ctx.fillStyle='#000000';ctx.fillRect(0,0,canvas.width,canvas.height);
  $('setup').hidden=false;$('ack').checked=false;
  if(confirmInput)confirmInput.value='';
  if(badge){badge.textContent='🔒 Locked';badge.className='failsafe-badge';}
  $('start').disabled=true;
  $('result').textContent=`Stopped: ${reason}. ${draws} draw callbacks; ${skipped} nominal 120 fps sample slots skipped. This is browser scheduling telemetry, not a measurement of presented or captured frames. Verify timing in capture.`;
  $('ack').focus();
}
function draw(now){
  if(!running)return;const elapsed=(now-startTime)/1000;
  if(elapsed>=fixtureSpec.seconds){stop('three-second limit');return;}
  const frame=Math.floor(elapsed*fixtureSpec.fps),rgb=fixtureState(active,frame),r=fixtureRect(active);
  if(lastFrame!==null)skipped+=Math.max(0,frame-lastFrame-1);lastFrame=frame;draws++;
  ctx.fillStyle='#000000';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle=`rgb(${rgb.join(',')})`;ctx.fillRect(r.x,r.y,r.width,r.height);
  raf=requestAnimationFrame(draw);
}
$('start').addEventListener('click',()=>{
  const ok=confirmInput?checkFailsafe(confirmInput.value):true;
  if(!ok||running||!$('ack').checked||document.hidden)return;
  // Avoid clipping the fixed reference surface in the captured viewport.
  if(window.innerWidth<1056||window.innerHeight<850){$('result').textContent='Enlarge this viewport to at least 1056 × 850 CSS pixels at 100% zoom so the full reference surface and controls fit.';return;}
  active=selected();running=true;draws=0;skipped=0;lastFrame=null;
  $('setup').hidden=true;$('stage').hidden=false;window.scrollTo(0,0);
  $('run-state').textContent=active.title;$('halt').focus();startTime=performance.now();
  draw(startTime);timer=setTimeout(()=>stop('three-second limit'),3000);
});
$('halt').addEventListener('click',()=>stop('Stop'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')stop('Escape');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('tab hidden');});
window.addEventListener('blur',()=>stop('window lost focus'));
window.addEventListener('pagehide',()=>stop('navigation'));
window.addEventListener('resize',()=>stop('viewport resized'));
$('analyze').addEventListener('click',()=>{
  const results=fixtures.map(f=>{
    const a=new Analyzer(16,12,{calibration:{cssWidth:fixtureSpec.width,cssHeight:fixtureSpec.height}});
    for(let i=0;i<=fixtureSpec.fps*fixtureSpec.seconds;i++)a.push(fixtureFrame(f,i,16,12),i/fixtureSpec.fps);
    const r=a.report();return {id:f.id,inputExpectation:f.expected,expectedApp:fixtureInfo(f).appExpected,actualApp:r.status,peakGeneral:r.peakGeneral,peakRed:r.peakRedHeuristic,area:r.evaluation.area,areaEnvelopeCss:r.area.peakEnvelope?.cssPixelsUpperBound};
  });
  $('analysis').textContent=JSON.stringify(results,null,2);
  $('result').textContent='Generated frames analyzed; no playback. Calibrated area screening remains separate from candidate detection and conformance. The 16 × 12 grid is a coarse nearest-center sample, not browser capture validation.';
});
