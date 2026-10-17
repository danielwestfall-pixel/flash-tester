import {Analyzer} from './analyzer.mjs';
import {stampReport,BUILD_ID,moduleVersionProblem} from './report.mjs';
import {imageUrls,orderedPairs,schedule,imageAt,rasterKind,containRect} from './image-sequence.mjs';
const $=id=>document.getElementById(id),canvas=$('surface'),context=canvas.getContext('2d',{colorSpace:'srgb'});
let images=[],failures=[],busy=false,sourceDirty=false,output=null,running=false,raf=null,timer=null,started=null,plan=[],liveLog=[],liveConfig=null;
let generation=0,suspended=false,loadController=null;
const controls=['files','urls','load','samples','changes','seed','width','height','pairs','shuffle','ack','play','download'];
function update(){
  for(const id of controls)$(id).disabled=busy||running||suspended;
  $('pairs').disabled=busy||running||suspended||sourceDirty||images.length<2||images.length>12;
  $('shuffle').disabled=busy||running||suspended||sourceDirty||images.length<2;
  $('play').disabled=busy||running||suspended||sourceDirty||images.length<2||!$('ack').checked;
  $('download').disabled=busy||running||suspended||!output;
}
function config(){
  const width=Number($('width').value),height=Number($('height').value),rate=Number($('changes').value),seed=Number($('seed').value);
  if(!Number.isInteger(width)||width<64||width>3840||!Number.isInteger(height)||height<64||height>2160||![4,6,8,20,30].includes(rate)||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('Enter valid display dimensions, rate and integer shuffle seed.');
  const scale=Math.min(64/width,64/height);
  return {width,height,rate,seed,seconds:3,fit:'contain',background:'#000000',analysisWidth:Math.max(1,Math.round(width*scale)),analysisHeight:Math.max(1,Math.round(height*scale))};
}
function invalidate(){output=null;$('rows').replaceChildren();$('result-table').hidden=true;$('ack').checked=false;$('result').textContent='Settings changed; screen again for these conditions.';update();}
for(const id of ['changes','seed','width','height'])$(id).addEventListener('change',invalidate);
function sourcesChanged(){sourceDirty=true;invalidate();$('load-status').textContent='Inputs changed. Load images before screening this set.';}
$('files').addEventListener('change',sourcesChanged);$('urls').addEventListener('input',sourcesChanged);
$('ack').addEventListener('change',update);
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
  const versionProblem=moduleVersionProblem();if(versionProblem){$('load-status').textContent=versionProblem;return;}
  if(busy||running||suspended)return;
  let urls,files=Array.from($('files').files??[]);
  try{urls=imageUrls($('urls').value);if(files.length+urls.length>32)throw Error('Load at most 32 images in total.');if(!files.length&&!urls.length)throw Error('Choose files or paste image URLs first.');}
  catch(e){sourcesChanged();$('load-status').textContent=e.message;return;}
  busy=true;update();output=null;failures=[];images.forEach(i=>i.bitmap.close());images=[];$('rows').replaceChildren();$('result-table').hidden=true;$('ack').checked=false;
  const token=++generation,controller=new AbortController();loadController=controller;
  const sources=[...files.map(file=>({name:file.name,read:async()=>file})),...urls.map((url,i)=>({name:`URL image ${i+1}`,read:async()=>{
    const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    const reader=response.body.getReader();let size=0;const chunks=[];
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20*1024*1024)throw Error('Image exceeds 20 MB.');chunks.push(value);}}
    catch(e){await reader.cancel();throw e;}return new Blob(chunks);
  }}))];
  for(const source of sources){
    $('load-status').textContent=`Loading ${source.name}…`;
    try{
      const blob=await source.read();if(token!==generation||suspended)return;
      const item=await decode(blob,source.name);
      if(token!==generation||suspended){item.bitmap.close();return;}
      images.push(item);
    }
    catch(e){if(token!==generation||suspended)return;failures.push({name:source.name,error:e.message||'Image load failed (network, CORS or decode).'});}
  }
  if(token!==generation||suspended)return;loadController=null;
  $('load-status').textContent=`${images.length}/${sources.length} loaded. ${failures.length?'COVERAGE INCOMPLETE: '+failures.map(f=>`${f.name}: ${f.error}`).join('\n'):'No load failures.'}\n`+images.map((i,n)=>`${n+1}. ${i.name} (${i.bitmap.width} × ${i.bitmap.height})`).join('\n');
  $('result').textContent='Loaded images have not been screened. No image preview was played.';busy=false;sourceDirty=false;update();
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
    const jobs=pairs??[null],results=[],shufflePlan=schedule(images.length,c.seconds,c.rate,c.seed);
    for(let j=0;j<jobs.length;j++){
      if(token!==generation||suspended)return;
      const pair=jobs[j],a=new Analyzer(c.analysisWidth,c.analysisHeight,{calibration:{cssWidth:c.width,cssHeight:c.height}});
      for(let i=0;i<=c.seconds*120;i++){
        const t=i/120,index=pair?pair[Math.floor(t*c.rate+1e-9)%2]:imageAt(shufflePlan,t);a.push(frames[index],t);
      }
      const r=stampReport({...a.report(),synthetic:true,source:'Decoded static images in generated schedules; no tab captured',pair});results.push(r);
      const name=pair?`${pair[0]+1} → ${pair[1]+1} → ${pair[0]+1}`:'Seeded shuffle';tableRow(name,r);
      $('result').textContent=`Screened ${j+1}/${jobs.length} finite sequences…`;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(token!==generation||suspended)return;
    output={...base(c,kind),plan:kind==='shuffle'?shufflePlan:undefined,results};
    const candidates=results.filter(r=>r.windows.length).length;
    $('result').textContent=`${results.length} finite sequence${results.length===1?'':'s'} screened; flash candidates in ${candidates}. ${failures.length?'Coverage incomplete due to failed image loads. ':''}No result establishes conformance or clearance of every combination. Changes per second are transitions; A/B flashes occur at half that rate.`;
  }catch(e){$('result').textContent=`Screening interrupted; coverage incomplete: ${e.message}`;output=null;}
  finally{if(token===generation){busy=false;update();}}
}
$('pairs').addEventListener('click',()=>analyze('pairs'));$('shuffle').addEventListener('click',()=>analyze('shuffle'));
function stop(reason){
  if(!running)return;running=false;cancelAnimationFrame(raf);clearTimeout(timer);raf=null;timer=null;
  $('stage').hidden=true;context.fillStyle='#000000';context.fillRect(0,0,canvas.width,canvas.height);$('setup').hidden=false;
  output={...base(liveConfig,'live-shuffle'),plan,drawCallbacks:liveLog,endedBecause:reason,observedSeconds:Math.min(3,(performance.now()-started)/1000),note:'Draw callbacks are not proof of displayed or captured frames. Elapsed seconds use performance.now() at callback entry, starting at zero for the initial draw. No pixel analysis was performed during this playback.'};
  $('ack').checked=false;$('result').textContent=`Playback stopped: ${reason}. Download the plan and draw-callback log; use tab capture for measured screening.`;update();$('ack').focus();
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
  if(busy||running||suspended||sourceDirty||!$('ack').checked||images.length<2||document.hidden)return;
  try{liveConfig=config();if(window.innerWidth<liveConfig.width+32||window.innerHeight<liveConfig.height+90)throw Error('Enlarge the viewport to show the full selected display surface and controls, or choose smaller display dimensions.');
    canvas.width=liveConfig.width;canvas.height=liveConfig.height;canvas.style.width=`${liveConfig.width}px`;canvas.style.height=`${liveConfig.height}px`;
    plan=schedule(images.length,3,liveConfig.rate,liveConfig.seed);liveLog=[];running=true;update();$('setup').hidden=true;$('stage').hidden=false;window.scrollTo(0,0);$('live-state').textContent='Running · Escape to stop';$('halt').focus();started=null;tick();timer=setTimeout(()=>stop('three-second limit'),3000);
  }catch(e){$('result').textContent=e.message;}
});
$('halt').addEventListener('click',()=>stop('Stop'));document.addEventListener('keydown',e=>{if(e.key==='Escape')stop('Escape');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop('tab hidden');});window.addEventListener('resize',()=>stop('viewport resized'));
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
