import * as reportModule from './report.mjs?v=0.5.0';
import * as motion from './motion-review.mjs?v=0.5.0';
export const MODULE_BUILD='flash-review-0.5.0-20261017';
const moduleVersionProblem=()=>typeof reportModule.moduleVersionProblem==='function'?reportModule.moduleVersionProblem({'motion-review-page':MODULE_BUILD,'motion-review':motion.MODULE_BUILD}):
  'Mixed Flash Review files are loaded (report unversioned). Hard-reload this page (Shift + Reload) before testing.';
const $=id=>document.getElementById(id);
const items=[];let reportId=globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const options=(values,labels={})=>values.map(v=>{const o=document.createElement('option');o.value=v;o.textContent=labels[v]??v.replaceAll('-',' ');return o;});
function field(row,label,input){const id=`${input.dataset.key}-${row}`;input.id=id;const l=document.createElement('label');l.htmlFor=id;l.textContent=label;return [l,input];}
function render(){
  const container=$('rows');container.replaceChildren();
  items.forEach((item,n)=>{
    const set=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent=`Interaction ${n+1}`;set.append(legend);
    const make=(tag,key,extra={})=>{const el=document.createElement(tag);el.dataset.key=key;Object.assign(el,extra);el.value=item[key];
      el.addEventListener(tag==='select'?'change':'input',()=>{item[key]=el.value;summary();});return el;};
    const trigger=make('select','trigger');trigger.append(...options(motion.TRIGGERS));trigger.value=item.trigger;
    const mechanism=make('select','mechanism');mechanism.append(...options(motion.MECHANISMS));mechanism.value=item.mechanism;
    const outcome=make('select','outcome');outcome.append(...options(motion.OUTCOMES,motion.OUTCOME_LABELS));outcome.value=item.outcome;
    set.append(...field(n,'Interaction (what the user does, and where)',make('input','interaction',{maxLength:500})),...field(n,'Trigger',trigger),
      ...field(n,'Motion it starts',make('input','motion',{maxLength:500})),...field(n,'Mechanism tested',mechanism),...field(n,'Result',outcome),
      ...field(n,'Essential rationale (if claimed)',make('textarea','rationale',{rows:2,maxLength:2000})),...field(n,'Evidence (notes, file names of recordings or screenshots)',make('textarea','evidence',{rows:2,maxLength:2000})));
    const remove=document.createElement('button');remove.type='button';remove.textContent='Remove this interaction';
    remove.addEventListener('click',()=>{items.splice(n,1);render();});set.append(remove);container.append(set);
  });
  summary();
}
function record(){return motion.reviewRecord({reference:$('reference').value.trim(),environment:$('environment').value.trim()},items,{reportId,buildId:reportModule.BUILD_ID,createdAt:new Date().toISOString()});}
function summary(){
  const s=motion.summarize(items);
  $('summary').textContent=!s.total?'No interactions recorded yet.':`${s.total} interaction(s): ${s.open} not tested, ${s.needsAttention} with motion not disabled, ${s.essentialClaims} essential claim(s). `+
    (s.incomplete.length?`Incomplete records: ${s.incomplete.map(x=>`#${x.n} (${x.problems.join(' ')})`).join('; ')}. `:'')+'Conformance not determined.';
}
function download(text,type,extension){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=`flash-review-motion-${reportId}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const guarded=fn=>()=>{const p=moduleVersionProblem();if(p){$('summary').textContent=p;return;}fn();};
$('add').addEventListener('click',guarded(()=>{items.push(motion.emptyItem());render();}));
$('json').addEventListener('click',guarded(()=>download(JSON.stringify(record(),null,2),'application/json','json')));
$('csv').addEventListener('click',guarded(()=>download(motion.reviewCsv(record()),'text/csv','csv')));
$('text').addEventListener('click',guarded(()=>download(motion.reviewText(record()),'text/plain','txt')));
if(moduleVersionProblem())$('summary').textContent=moduleVersionProblem();
globalThis.flashReviewReady=true;
