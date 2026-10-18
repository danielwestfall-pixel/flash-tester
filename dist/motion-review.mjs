// SC 2.3.3 manual review records. Pure functions: the page and tests share them.
import {csvCell} from './export-metadata.mjs?v=0.5.1-20261018';
export const MODULE_BUILD='flash-review-0.5.1-20261018';
(globalThis.flashReviewModules??={})['motion-review']=MODULE_BUILD;
export const TRIGGERS=['scroll','hover-or-focus','click-or-tap','drag','page-transition','keyboard','other'];
export const MECHANISMS=['prefers-reduced-motion','site-setting','both','none-found','not-tested'];
export const OUTCOMES=['not-tested','motion-disabled','motion-reduced-not-disabled','not-disabled','essential'];
export const OUTCOME_LABELS={'not-tested':'Not tested yet','motion-disabled':'Motion is disabled by the mechanism','motion-reduced-not-disabled':'Motion is reduced but not disabled','not-disabled':'Motion is not disabled','essential':'Not disabled; claimed essential'};
export function emptyItem(){return {interaction:'',trigger:'scroll',motion:'',mechanism:'not-tested',outcome:'not-tested',rationale:'',evidence:''};}
// Problems that stop a record from supporting any reviewer conclusion. Never a verdict.
export function itemProblems(item){
  const p=[];
  if(!item.interaction.trim())p.push('Describe the interaction.');
  if(!item.motion.trim()&&item.outcome!=='not-tested')p.push('Describe the motion that the interaction starts.');
  if(item.outcome==='essential'&&!item.rationale.trim())p.push('An essential claim needs a written rationale.');
  if(['motion-disabled','motion-reduced-not-disabled','not-disabled'].includes(item.outcome)&&item.mechanism==='not-tested')p.push('Record which mechanism was tested.');
  if(item.outcome==='motion-disabled'&&item.mechanism==='none-found')p.push('"Motion is disabled" contradicts "no mechanism found".');
  return p;
}
export function summarize(items){
  const counts=Object.fromEntries(OUTCOMES.map(o=>[o,0]));for(const i of items)counts[i.outcome]++;
  const open=items.filter(i=>i.outcome==='not-tested').length,attention=items.filter(i=>['not-disabled','motion-reduced-not-disabled'].includes(i.outcome)).length;
  const incomplete=items.map((i,n)=>({n:n+1,problems:itemProblems(i)})).filter(x=>x.problems.length);
  return {counts,total:items.length,open,needsAttention:attention,essentialClaims:counts.essential,incomplete,
    status:!items.length?'no-interactions-recorded':open||incomplete.length?'review-incomplete':attention?'motion-not-disabled-recorded':'review-recorded',
    conformance:'not-determined'};
}
export function reviewRecord(meta,items,{reportId,buildId,createdAt}){
  return {kind:'sc233-motion-review',criterion:'WCAG 2.2 SC 2.3.3 Animation from Interactions (Level AAA)',reportId,buildId,createdAt,
    reference:meta.reference,environment:meta.environment,items:items.map(i=>({...i})),summary:summarize(items),
    limitations:['Manual review record. Flash Review cannot detect whether motion is triggered by interaction or whether it can be disabled.',
      'Only the interactions listed were reviewed. Unlisted states and pages are not covered.',
      'An "essential" claim is the reviewer’s judgement and needs its own justification.',
      'No WCAG conformance verdict.']};
}
export function reviewCsv(record){
  const cols=['report_id','build_id','criterion','reference','environment','item','interaction','trigger','motion','mechanism','outcome','rationale','evidence','record_problems'];
  const rows=record.items.map((i,n)=>[record.reportId,record.buildId,record.criterion,record.reference,record.environment,n+1,i.interaction,i.trigger,i.motion,i.mechanism,i.outcome,i.rationale,i.evidence,itemProblems(i).join(' ')]);
  if(!rows.length)rows.push([record.reportId,record.buildId,record.criterion,record.reference,record.environment,'','','','','','','','','No interactions recorded.']);
  return [cols,...rows].map(r=>r.map(csvCell).join(',')).join('\n');
}
export function reviewText(record){
  const s=record.summary;
  return ['SC 2.3.3 — MOTION REVIEW NOTES','Conformance status: Not determined',`Report ID: ${record.reportId}`,`Build: ${record.buildId}`,`Date: ${record.createdAt}`,
    `Reference: ${record.reference||'Not supplied'}`,`Environment: ${record.environment||'Not supplied'}`,
    `Recorded interactions: ${s.total}; not tested: ${s.open}; motion not disabled: ${s.needsAttention}; essential claims: ${s.essentialClaims}; incomplete records: ${s.incomplete.length}`,'',
    ...record.items.flatMap((i,n)=>[`${n+1}. ${i.interaction||'(no description)'} [${i.trigger}]`,`   Motion: ${i.motion||'—'}`,`   Mechanism tested: ${i.mechanism}; result: ${OUTCOME_LABELS[i.outcome]}`,
      ...(i.rationale?[`   Essential rationale: ${i.rationale}`]:[]),...(i.evidence?[`   Evidence: ${i.evidence}`]:[]),...itemProblems(i).map(p=>`   RECORD INCOMPLETE: ${p}`)]),
    '','Limitations:',...record.limitations.map(l=>`- ${l}`),'','Reference: https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html'].join('\n');
}
