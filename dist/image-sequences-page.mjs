import {Analyzer} from './analyzer.mjs';
import {stampReport,BUILD_ID} from './report.mjs';
import {imageUrls,orderedPairs,schedule,imageAt,rasterKind,containRect} from './image-sequence.mjs';
const $=id=>document.getElementById(id),canvas=$('surface'),context=canvas.getContext('2d',{colorSpace:'srgb'});
let images=[],failures=[],busy=false,sourceDirty=false,output=null,running=false,raf=null,timer=null,started=null,plan=[],liveLog=[],liveConfig=null;
let generation=0,suspended=false,loadController=null;
const controls=['files','urls','load','samples','changes','seed','width','height','pairs','shuffle','adversarial','ack','play','download'];
function update(){
  for(const id of controls){const el=$(id);if(el)el.disabled=busy||running||suspended;}
  $('pairs').disabled=busy||running||suspended||sourceDirty||images.length<2||images.length>12;
  $('shuffle').disabled=busy||running||suspended||sourceDirty||images.length<2;
  if($('adversarial'))$('adversarial').disabled=busy||running||suspended||sourceDirty||images.length<2;
  if($('cancel-load')){
    $('cancel-load').hidden=!loadController;
    $('cancel-load').disabled=!loadController;
  }
  const failsafeOk=confirmInput?checkFailsafe(confirmInput.value):true;
  $('play').disabled=busy||running||suspended||sourceDirty||images.length<2||!(failsafeOk&&$('ack').checked);
  $('download').disabled=busy||running||suspended||!output;
}
function config(){
  const width=Number($('width').value),height=Number($('height').value),rate=Number($('changes').value),seed=Number($('seed').value);
  if(!Number.isInteger(width)||width<64||width>3840||!Number.isInteger(height)||height<64||height>2160||![4,6,8,20,30].includes(rate)||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('Enter valid display dimensions, rate and integer shuffle seed.');
  const scale=Math.min(64/width,64/height);
  return {width,height,rate,seed,seconds:3,fit:'contain',background:'#000000',analysisWidth:Math.max(1,Math.round(width*scale)),analysisHeight:Math.max(1,Math.round(height*scale))};
}
const confirmInput=$('confirm-text'),badge=$('failsafe-badge');
function checkFailsafe(text){
  const val=(text||'').trim().toLowerCase();
  return val==='i agree'||val==='i understand';
}
if(confirmInput){
  confirmInput.addEventListener('input',()=>{
    const ok=checkFailsafe(confirmInput.value);
    if(badge){
      badge.textContent=ok?'🔓 Confirmed: Fail-safe unlocked':'🔒 Locked';
      badge.className=ok?'failsafe-badge unlocked':'failsafe-badge';
    }
    update();
  });
}
function invalidate(){
  output=null;$('rows').replaceChildren();$('result-table').hidden=true;$('ack').checked=false;
  if(confirmInput)confirmInput.value='';
  if(badge){badge.textContent='🔒 Locked';badge.className='failsafe-badge';}
  $('result').textContent='Settings changed; screen again for these conditions.';update();
}
for(const id of ['changes','seed','width','height'])$(id).addEventListener('change',invalidate);
function sourcesChanged(){sourceDirty=true;invalidate();$('load-status').textContent='Inputs changed. Load images before screening this set.';}
$('files').addEventListener('change',sourcesChanged);$('urls').addEventListener('input',sourcesChanged);
$('ack').addEventListener('change',()=>update());
$('samples').addEventListener('click',()=>{
  $('files').value='';
  $('urls').value=['black','white','red','blue','gray-b0','gray-b8','gray-e0','small-white'].map(name=>new URL(`fixture-images/${name}.png`,location.href).href).join('\n');
  sourcesChanged();
  $('load-status').textContent='Sample URLs filled in. Click Load images without playback to replace the loaded set.';
});
function draw(ctx,item,width,height){
  ctx.fillStyle='#000000';ctx.fillRect(0,0,width,height);
  const r=containRect(item.bitmap.width,item.bitmap.height,width,height);ctx.drawImage(item.bitmap,r.x,r.y,r.width,r.height);
}
async function decode(blob,name){
  if(blob.size>20*1024*1024)throw Error('Image exceeds 20 MB.');
  rasterKind(new Uint8Array(await blob.arrayBuffer()));
  const bitmap=await createImageBitmap(blob);
  if(bitmap.width*bitmap.height>16000000){bitmap.close();throw Error('Image exceeds 16 megapixels.');}
  return {name,bitmap};
}
$('load').addEventListener('click',async()=>{
  if(busy||running||suspended)return;
  let urls,files=Array.from($('files').files??[]);
  try{urls=imageUrls($('urls').value);if(files.length+urls.length>32)throw Error('Load at most 32 images in total.');if(!files.length&&!urls.length)throw Error('Choose files or paste image URLs first.');}
  catch(e){sourcesChanged();$('load-status').textContent=e.message;return;}
  busy=true;update();output=null;failures=[];images.forEach(i=>i.bitmap.close());images=[];$('rows').replaceChildren();$('result-table').hidden=true;$('ack').checked=false;
  const token=++generation,controller=new AbortController();loadController=controller;
  const aggregateTimer=setTimeout(()=>{controller.abort(new Error('Aggregate load timeout exceeded (30 seconds).'));},30000);
  update();
  const urlFetches=urls.map(async(url,i)=>{
    const name=`URL image ${i+1}`;
    try{
      const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const reader=response.body.getReader();let size=0;const chunks=[];
      try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20*1024*1024)throw Error('Image exceeds 20 MB.');chunks.push(value);}}
      catch(e){await reader.cancel();throw e;}return {name,blob:new Blob(chunks)};
    }catch(e){return {name,error:e.message||'Image load failed (network, CORS or decode).'};}
  });
  const fileItems=files.map(file=>Promise.resolve({name:file.name,blob:file}));
  const allSources=[...fileItems,...urlFetches];
  for(let i=0;i<allSources.length;i++){
    if(token!==generation||suspended)break;
    if(controller.signal.aborted)break;
    $('load-status').textContent=`Loading ${i+1}/${allSources.length} images…`;
    const res=await allSources[i];
    if(token!==generation||suspended)break;
    if(controller.signal.aborted)break;
    if(res.error){failures.push({name:res.name,error:res.error});continue;}
    try{
      const item=await decode(res.blob,res.name);
      if(token!==generation||suspended||controller.signal.aborted){item.bitmap.close();break;}
      images.push(item);
    }catch(e){
      if(token!==generation||suspended)break;
      failures.push({name:res.name,error:e.message||'Image decode failed.'});
    }
  }
  clearTimeout(aggregateTimer);
  loadController=null;
  if(token!==generation||suspended)return;
  if(controller.signal.aborted){
    images.forEach(i=>i.bitmap.close());images=[];
    $('load-status').textContent=controller.signal.reason?.message||'Image loading was cancelled.';
    $('result').textContent='Load cancelled. No images loaded.';
    busy=false;sourceDirty=true;update();return;
  }
  $('load-status').textContent=`${images.length}/${allSources.length} loaded. ${failures.length?'COVERAGE INCOMPLETE: '+failures.map(f=>`${f.name}: ${f.error}`).join('\n'):'No load failures.'}\n`+images.map((i,n)=>`${n+1}. ${i.name} (${i.bitmap.width} × ${i.bitmap.height})`).join('\n');
  $('result').textContent='Loaded images have not been screened. No image preview was played.';busy=false;sourceDirty=false;update();
});
$('cancel-load')?.addEventListener('click',()=>{
  if(loadController){
    loadController.abort(new Error('Image loading was cancelled by the user.'));
  }
});
function base(c,kind){return {buildId:BUILD_ID,kind,createdAt:new Date().toISOString(),settings:c,images:images.map(i=>({name:i.name,width:i.bitmap.width,height:i.bitmap.height})),loadFailures:[...failures],
  coverage:failures.length?'incomplete-load-failures':'finite-selected-sequences-only',
  limitations:['No claim that all arbitrary image combinations pass SC 2.3.1.','Ordered pairs test alternating A/B at one rate and one size. Multi-image trajectories and other sizes/rates require separate tests.','Browser image decoding and reduced-resolution sRGB analysis can miss detail; HDR and full color management are not validated.','Live presentation/capture timing, full red evaluation, precise temporal area overlap and fine-pattern exceptions remain incomplete.']};}
function tableRow(name,r){
  const tr=document.createElement('tr');for(const text of [name,`${r.peakGeneral} / ${r.peakRedHeuristic}`,(r.area.peakEnvelope?.cssPixelsUpperBound??0).toFixed(1),r.status]){const td=document.createElement('td');td.textContent=text;tr.append(td);}$('rows').append(tr);
}
async function analyze(kind){
  if(busy||running||suspended||sourceDirty||images.length<2)return;
  let c,pairs;try{c=config();pairs=kind==='pairs'?orderedPairs(images.length):null;}catch(e){$('result').textContent=e.message;return;}
  busy=true;output=null;update();$('rows').replaceChildren();$('result-table').hidden=false;
  const token=++generation;
  const scratch=document.createElement('canvas');scratch.width=c.analysisWidth;scratch.height=c.analysisHeight;
  const ctx=scratch.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
  try{
    const frames=images.map(item=>{draw(ctx,item,c.analysisWidth,c.analysisHeight);return ctx.getImageData(0,0,c.analysisWidth,c.analysisHeight).data;});
    const linear=Array.from({length:256},(_,i)=>{const v=i/255;return v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4;});
    const meanY=frames.map(data=>{let sum=0,count=data.length/4;for(let i=0;i<data.length;i+=4)sum+=0.2126*linear[data[i]]+0.7152*linear[data[i+1]]+0.0722*linear[data[i+2]];return sum/count;});
    const meanRed=frames.map(data=>{let sum=0,count=data.length/4;for(let i=0;i<data.length;i+=4){const r=linear[data[i]],g=linear[data[i+1]],b=linear[data[i+2]];sum+=Math.max(0,(r-g-b)*320);}return sum/count;});
    let jobs,adversarialPairs=null;
    if(kind==='pairs'){
      jobs=pairs;
    }else if(kind==='shuffle'){
      jobs=[null];
    }else if(kind==='adversarial'){
      let maxDeltaY=-1,bestYPair=[0,1];
      let maxDeltaRed=-1,bestRedPair=[0,1];
      for(let i=0;i<images.length;i++){
        for(let j=i+1;j<images.length;j++){
          const dy=Math.abs(meanY[i]-meanY[j]);
          if(dy>maxDeltaY){maxDeltaY=dy;bestYPair=[i,j];}
          const dr=Math.abs(meanRed[i]-meanRed[j]);
          if(dr>maxDeltaRed){maxDeltaRed=dr;bestRedPair=[i,j];}
        }
      }
      adversarialPairs=[bestYPair];
      if(maxDeltaRed>20&&(bestRedPair[0]!==bestYPair[0]||bestRedPair[1]!==bestYPair[1])){
        adversarialPairs.push(bestRedPair);
      }
      jobs=adversarialPairs;
    }
    const results=[],shufflePlan=schedule(images.length,c.seconds,c.rate,c.seed);
    for(let j=0;j<jobs.length;j++){
      if(token!==generation||suspended)return;
      const pair=jobs[j],a=new Analyzer(c.analysisWidth,c.analysisHeight,{calibration:{cssWidth:c.width,cssHeight:c.height}});
      for(let i=0;i<=c.seconds*120;i++){
        const t=i/120,index=pair?pair[Math.floor(t*c.rate+1e-9)%2]:imageAt(shufflePlan,t);a.push(frames[index],t);
      }
      const r=stampReport({...a.report(),synthetic:true,source:'Decoded static images in generated schedules; no tab captured',pair});results.push(r);
      const delta=pair?Math.abs(meanY[pair[0]]-meanY[pair[1]]):null;
      const rDelta=pair?Math.abs(meanRed[pair[0]]-meanRed[pair[1]]):0;
      let name;
      if(kind==='adversarial'){
        name=`Worst-case pair: ${pair[0]+1} ↔ ${pair[1]+1} (ΔY: ${delta.toFixed(3)}${rDelta>20?`, ΔSR: ${rDelta.toFixed(1)}`:''})`;
      }else if(pair){
        name=`${pair[0]+1} → ${pair[1]+1} → ${pair[0]+1} (ΔY: ${delta.toFixed(3)})`;
      }else{
        name='Seeded shuffle';
      }
      tableRow(name,r);
      $('result').textContent=`Screened ${j+1}/${jobs.length} finite sequences…`;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(token!==generation||suspended)return;
    output={
      ...base(c,kind),
      plan:kind==='shuffle'?shufflePlan:undefined,
      worstCasePairs:kind==='adversarial'?adversarialPairs:undefined,
      results,
      imageLuminance:images.map((i,idx)=>({name:i.name,meanRelativeLuminance:Number(meanY[idx].toFixed(4)),meanSaturatedRed:Number(meanRed[idx].toFixed(4))}))
    };
    const candidates=results.filter(r=>r.windows.length).length;
    const lumSummary=images.map((i,idx)=>`#${idx+1}: Y≈${meanY[idx].toFixed(3)}`).join(', ');
    if(kind==='adversarial'){
      $('result').textContent=`Adversarial worst-case screening complete (${results.length} sequence${results.length===1?'':'s'}); flash candidates in ${candidates}. Screened pair(s) maximizing transition hazard. Loaded image luminance: [${lumSummary}]. ${failures.length?'Coverage incomplete due to failed image loads. ':''}No result establishes conformance or clearance of every combination. Changes per second are transitions; A/B flashes occur at half that rate.`;
    }else{
      $('result').textContent=`${results.length} finite sequence${results.length===1?'':'s'} screened; flash candidates in ${candidates}. Loaded image luminance: [${lumSummary}]. ${failures.length?'Coverage incomplete due to failed image loads. ':''}No result establishes conformance or clearance of every combination. Changes per second are transitions; A/B flashes occur at half that rate.`;
    }
  }catch(e){$('result').textContent=`Screening interrupted; coverage incomplete: ${e.message}`;output=null;}
  finally{if(token===generation){busy=false;update();}}
}
$('pairs').addEventListener('click',()=>analyze('pairs'));$('shuffle').addEventListener('click',()=>analyze('shuffle'));
$('adversarial')?.addEventListener('click',()=>analyze('adversarial'));
function stop(reason){
  if(!running)return;running=false;cancelAnimationFrame(raf);clearTimeout(timer);raf=null;timer=null;
  $('stage').hidden=true;context.fillStyle='#000000';context.fillRect(0,0,canvas.width,canvas.height);$('setup').hidden=false;
  output={...base(liveConfig,'live-shuffle'),plan,drawCallbacks:liveLog,endedBecause:reason,observedSeconds:Math.min(3,(performance.now()-started)/1000),note:'Draw callbacks are not proof of displayed or captured frames. Elapsed seconds use performance.now() at callback entry, starting at zero for the initial draw. No pixel analysis was performed during this playback.'};
  $('ack').checked=false;
  if(confirmInput)confirmInput.value='';
  if(badge){badge.textContent='🔒 Locked';badge.className='failsafe-badge';}
  $('result').textContent=`Playback stopped: ${reason}. Download the plan and draw-callback log; use tab capture for measured screening.`;update();$('ack').focus();
}
function tick(){
  if(!running)return;
  // Animation timestamps may precede startup within the current frame. Use the
  // same monotonic entry clock for the immediate draw and every later callback.
  const now=performance.now();if(started===null)started=now;
  const t=(now-started)/1000;if(t>=3){stop('three-second limit');return;}
  const index=imageAt(plan,t);draw(context,images[index],canvas.width,canvas.height);liveLog.push({time:t,image:index});raf=requestAnimationFrame(tick);
}
$('play').addEventListener('click',()=>{
  const failsafeOk=confirmInput?checkFailsafe(confirmInput.value):true;
  if(busy||running||suspended||sourceDirty||!failsafeOk||!$('ack').checked||images.length<2||document.hidden)return;
  try{liveConfig=config();if(window.innerWidth<liveConfig.width+32||window.innerHeight<liveConfig.height+90)throw Error('Enlarge the viewport to show the full selected display surface and controls, or choose smaller display dimensions.');
    canvas.width=liveConfig.width;canvas.height=liveConfig.height;canvas.style.width=`${liveConfig.width}px`;canvas.style.height=`${liveConfig.height}px`;
    plan=schedule(images.length,3,liveConfig.rate,liveConfig.seed);liveLog=[];running=true;update();$('setup').hidden=true;$('stage').hidden=false;window.scrollTo(0,0);$('live-state').textContent='Running · Escape to stop';$('halt').focus();started=null;tick();timer=setTimeout(()=>stop('three-second limit'),3000);
  }catch(e){$('result').textContent=e.message;}
});
$('halt').addEventListener('click',()=>stop('Stop'));document.addEventListener('keydown',e=>{if(e.key==='Escape')stop('Escape');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('tab hidden');});window.addEventListener('blur',()=>stop('window lost focus'));window.addEventListener('resize',()=>stop('viewport resized'));
window.addEventListener('pagehide',()=>{
  stop('navigation');suspended=true;generation++;loadController?.abort();loadController=null;
  images.forEach(i=>i.bitmap.close());images=[];failures=[];busy=false;sourceDirty=true;output=null;
  $('rows').replaceChildren();$('result-table').hidden=true;$('ack').checked=false;
  $('load-status').textContent='Images released during navigation. Load images again before screening.';
  $('result').textContent='Previous results cleared; image inputs must be reloaded.';update();
});
window.addEventListener('pageshow',()=>{suspended=false;update();});
$('download').addEventListener('click',()=>{if(!output)return;const url=URL.createObjectURL(new Blob([JSON.stringify(output,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='flash-image-sequence-results.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
update();
