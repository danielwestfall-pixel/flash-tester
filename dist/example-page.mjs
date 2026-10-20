import {examples,exampleValues,exampleState} from './examples.mjs';
const $=id=>document.getElementById(id);
const example=examples.find(x=>x.id===new URL(location.href).searchParams.get('case'))||examples[0];
const values=exampleValues(example);
$('title').textContent=example.title;$('live-label').textContent=example.title;
$('description').textContent=`${example.expectation} State A RGB ${example.a.join('/')} → Y=${values.a.y.toFixed(5)}. State B RGB ${example.b.join('/')} → Y=${values.b.y.toFixed(5)}. ΔY=${values.delta.toFixed(5)}; nominal complete cycles=${example.hz}/second.`;
if(example.fail)$('warning-title').textContent=`⚠️ CRITICAL WARNING: Intentional Threshold-Exceeding Flash Test (${example.hz} flashes/s)`;
let running=false,animation=null,timeout=null,started=0;
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
function updatePlayState(){
  const ok=confirmInput?checkFailsafe(confirmInput.value):true;
  $('play').disabled=!(ok&&$('ack').checked);
}
if(confirmInput){
  confirmInput.addEventListener('input',()=>{
    const ok=checkFailsafe(confirmInput.value);
    if(badge){
      badge.textContent=ok?'🔓 Confirmed: Fail-safe unlocked':'🔒 Locked';
      badge.className=ok?'failsafe-badge unlocked':'failsafe-badge';
    }
    updatePlayState();
  });
}
$('ack').addEventListener('change',updatePlayState);
function stop(reason){
  if(!running)return;
  running=false;cancelAnimationFrame(animation);clearTimeout(timeout);
  $('test-field').hidden=true;$('live-controls').hidden=true;
  $('ack').checked=false;
  if(confirmInput)confirmInput.value='';
  if(badge){badge.textContent='🔒 Locked';badge.className='failsafe-badge';}
  $('play').disabled=true;
  $('done').textContent=`Example stopped: ${reason}. Live rendering depends on display timing; use captured measurements to review it.`;
  $('ack').focus();
}
function draw(now){
  if(!running)return;
  const t=(now-started)/1000;
  if(t>=5){stop('five-second limit');return;}
  $('test-field').style.backgroundColor=`rgb(${exampleState(example,t).join(',')})`;
  animation=requestAnimationFrame(draw);
}
$('play').addEventListener('click',()=>{
  const ok=confirmInput?checkFailsafe(confirmInput.value):true;
  if(!ok||!$('ack').checked||running)return;
  running=true;started=performance.now();
  $('test-field').style.backgroundColor=`rgb(${example.a.join(',')})`;
  $('test-field').hidden=false;$('live-controls').hidden=false;$('done').textContent='';
  $('halt').focus();
  timeout=setTimeout(()=>stop('five-second limit'),5000);
  animation=requestAnimationFrame(draw);
});
$('halt').addEventListener('click',()=>stop('reviewer pressed Stop'));
document.addEventListener('keydown',event=>{if(event.key==='Escape')stop('Escape');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('tab became hidden');});
window.addEventListener('blur',()=>stop('window lost focus'));
window.addEventListener('pagehide',()=>stop('page closed'));
