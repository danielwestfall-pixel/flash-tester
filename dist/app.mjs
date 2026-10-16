import {Analyzer} from './analyzer.mjs';
import {Evidence,evidenceMarkup,csv,reportHtml} from './evidence.mjs';
import {examples,exampleValues,syntheticExample} from './examples.mjs';
const $=id=>document.getElementById(id);
let stream=null,analyzer=null,active=false,pending=false,report=null,callback=null,timer=null;
let frameStart=null,lastMedia=null,startedAt=0,meta=null,settings=null,run=0;
let evidence=null;
const video=$('source'),canvas=$('pixels'),ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
function message(headline,body,state){$('headline').textContent=headline;$('status').textContent=body;$('state').textContent=state;}
function lock(value){for(const id of ['target','notes','duration','resolution','start','probe-x','probe-y','keep-shots'])$(id).disabled=value;document.querySelectorAll('[data-example]').forEach(el=>el.disabled=value);$('stop').hidden=!active;}
function stats(r){$('seconds').textContent=r.duration.toFixed(1);$('fps').textContent=r.observedFps.toFixed(1);$('general').textContent=r.peakGeneral;$('red').textContent=r.peakRedHeuristic;}
function cleanup(){
  clearTimeout(timer);timer=null;
  if(callback!==null)video.cancelVideoFrameCallback?.(callback);callback=null;
  stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;
}
function finish(reason){
  if(!active)return;active=false;cleanup();lock(false);
  const result=analyzer?analyzer.report():new Analyzer(0,0).report();
  report={...result,createdAt:new Date().toISOString(),criterion:'WCAG 2.2 SC 2.3.1 (Level A)',
    reference:meta.reference,interactions:meta.interactions,requestedSeconds:meta.seconds,
    captureSettings:settings,endedBecause:reason,viewport:meta.viewport,evidence:evidence?.report(),
    scope:'Shared surface only; reference URL and interactions are supplied by the reviewer.'};
  renderReport(reason);
}
function renderReport(reason){
  stats(report);$('progress').value=100;
  message(report.frames<2?'Insufficient capture':report.windows.length?'Potential flashing detected':'No rapid flashing detected',
    report.frames<2?'No usable frame sequence was captured. Try a desktop browser and a different tab.':
    'Review required. These findings apply only to the sampled capture; they do not establish a WCAG pass or failure.', 'Review required');
  const quality=[];
  if(report.duration<1)quality.push('Less than one second was sampled.');
  if(report.observedFps<30)quality.push('Observed sampling was below 30 frames/sec.');
  if(report.maxFrameGapSeconds>.1)quality.push(`Capture gap reached ${report.maxFrameGapSeconds.toFixed(3)} seconds.`);
  if(reason!=='Time limit reached')quality.push(`Capture ended: ${reason}.`);
  quality.push('Sampling can miss flashing even at higher frame rates. Red checks are heuristic; flash area is not evaluated.');
  $('quality').textContent=quality.join(' ');
  if(report.synthetic)$('quality').textContent=`Synthetic example: ${report.interactions} Generated frames do not validate actual tab capture, display timing, or physical flash area.`;
  $('luminance-evidence').innerHTML=report.evidence?evidenceMarkup(report.evidence,report.viewport):'<p>No luminance evidence captured.</p>';
  $('intervals').replaceChildren();
  if(!report.windows.length){const p=document.createElement('p');p.className='hint';p.textContent='No intervals were flagged. This does not establish conformance.';$('intervals').append(p);}
  for(const w of report.windows){
    const el=document.createElement('div');el.className='interval';const b=w.box;
    el.textContent=`${w.start.toFixed(2)}–${w.end.toFixed(2)} s · General ${w.general} · Red candidates ${w.red} · ${(w.fraction*100).toFixed(2)}% of sampled pixels flagged. Region: x ${(b.x*100).toFixed(1)}%, y ${(b.y*100).toFixed(1)}%, w ${(b.width*100).toFixed(1)}%, h ${(b.height*100).toFixed(1)}%.`;
    $('intervals').append(el);
  }
  $('report').hidden=false;
}
function frame(now,info){
  if(!active)return;
  try{
    if(frameStart===null)frameStart=info.mediaTime;
    if(lastMedia!==null&&info.mediaTime<=lastMedia){callback=video.requestVideoFrameCallback(frame);return;}
    lastMedia=info.mediaTime;
    if(!analyzer){
      const scale=Math.min(meta.width/video.videoWidth,640/video.videoHeight,1);
      canvas.width=Math.max(1,Math.round(video.videoWidth*scale));canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
      analyzer=new Analyzer(canvas.width,canvas.height);
      evidence=new Evidence(canvas.width,canvas.height,meta.probeX,meta.probeY);
      meta.viewport={width:video.videoWidth,height:video.videoHeight};
    }
    if(meta.viewport.width!==video.videoWidth||meta.viewport.height!==video.videoHeight){finish('Shared surface dimensions changed; start a new capture');return;}
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const frameResult=analyzer.push(rgba,info.mediaTime-frameStart);
    evidence.push(rgba,info.mediaTime-frameStart,frameResult,()=>{
      if(!meta.keepShots)return null;
      const shot=document.createElement('canvas');
      const scale=Math.min(1280/video.videoWidth,1280/video.videoHeight,1);
      shot.width=Math.max(1,Math.round(video.videoWidth*scale));shot.height=Math.max(1,Math.round(video.videoHeight*scale));
      shot.getContext('2d').drawImage(video,0,0,shot.width,shot.height);
      return shot.toDataURL('image/jpeg',.85);
    });
    // Refresh text at most twice a second; no captured pixels are displayed.
    if(analyzer.frames===1||now-(meta.lastUpdate??0)>500){stats(analyzer.report());meta.lastUpdate=now;}
    $('progress').value=Math.min(100,(performance.now()-startedAt)/(meta.seconds*10));
    if(info.mediaTime-frameStart>=meta.seconds){finish('Time limit reached');return;}
    callback=video.requestVideoFrameCallback(frame);
  }catch(error){finish(`Analysis interrupted (${error.name||'error'})`);}
}
$('setup').addEventListener('submit',async event=>{
  event.preventDefault();if(active||pending)return;
  if(!navigator.mediaDevices?.getDisplayMedia||!video.requestVideoFrameCallback){message('Capture unavailable','Open this tool in desktop Chrome or Edge over HTTPS or localhost. This browser does not provide the required tab-capture APIs.','Unavailable');return;}
  const token=++run;
  meta={reference:$('target').value.trim(),interactions:$('notes').value.trim(),seconds:Number($('duration').value),width:Number($('resolution').value),probeX:Number($('probe-x').value),probeY:Number($('probe-y').value),keepShots:$('keep-shots').checked};
  pending=true;lock(true);message('Choose your target tab','Select the webpage tab in the browser’s sharing picker. Then exercise its video, animations, and interactions.','Choosing tab');
  try{
    const selected=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:60}},audio:false,preferCurrentTab:false});
    if(token!==run){selected.getTracks().forEach(t=>t.stop());return;}
    stream=selected;const track=stream.getVideoTracks()[0];const raw=track.getSettings();
    settings={width:raw.width,height:raw.height,frameRate:raw.frameRate,displaySurface:raw.displaySurface};
    // Do not export device IDs or the browser-provided tab/window title.
    active=true;pending=false;analyzer=null;evidence=null;frameStart=null;lastMedia=null;report=null;
    $('report').hidden=true;$('progress').value=0;lock(true);
    track.addEventListener('ended',()=>finish('Sharing stopped by reviewer'),{once:true});
    video.srcObject=stream;await video.play();if(!active)return;
    startedAt=performance.now();
    message('Capture in progress','Exercise the shared page now. This capture ends automatically. Return here to stop early.','Capturing');
    timer=setTimeout(()=>finish('Time limit reached'),meta.seconds*1000);
    callback=video.requestVideoFrameCallback(frame);
  }catch(error){
    if(active)finish(`Capture interrupted (${error.name||'error'})`);
    else {cleanup();message('Capture did not start',error.name==='NotAllowedError'?'Sharing was canceled or blocked. Click Share a tab to try again.':`Tab capture could not start (${error.name||'error'}). Try opening the tool in desktop Chrome or Edge.`,'Ready');}
  }finally{pending=false;lock(active);}
});
$('stop').addEventListener('click',()=>finish('Stopped early by reviewer'));
window.addEventListener('pagehide',()=>{run++;active=false;cleanup();});
function download(text,type,extension){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=`flash-review-${new Date().toISOString().slice(0,10)}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('json').addEventListener('click',()=>{if(report)download(JSON.stringify(report,null,2),'application/json','json');});
$('html-report').addEventListener('click',()=>{if(report)download(reportHtml(report),'text/html','html');});
$('csv').addEventListener('click',()=>{if(report?.evidence)download(csv(report.evidence),'text/csv','csv');});
$('text').addEventListener('click',()=>{
  if(!report)return;
  const lines=['SC 2.3.1 — SCREENING REVIEW NOTES','Conformance status: Not determined',`Screening result: ${report.outcome}`,
    `Date: ${report.createdAt}`,`Page/reference (reviewer supplied): ${report.reference||'Not supplied'}`,`Interactions (reviewer supplied): ${report.interactions||'Not supplied'}`,
    `Sampled: ${report.duration.toFixed(2)} seconds; ${report.frames} frames; ${report.observedFps.toFixed(1)} observed fps; largest gap ${report.maxFrameGapSeconds.toFixed(3)}s`,
    `Capture settings: ${JSON.stringify(report.captureSettings)}`,`Captured viewport: ${JSON.stringify(report.viewport)}`,`Analysis resolution: ${JSON.stringify(report.analysisResolution)}`,
    `Capture ended: ${report.endedBecause}`,`Peak general pairs / rolling second at one sampled pixel: ${report.peakGeneral}`,`Peak red candidates / rolling second at one sampled pixel: ${report.peakRedHeuristic}`,
    ...(report.evidence?[`Measurement point (analysis pixels): ${report.evidence.probe.x}, ${report.evidence.probe.y}`,`Probe minimum Y=${report.evidence.minimum}; maximum Y=${report.evidence.maximum}; capture-wide range=${report.evidence.range} (not a flash amplitude).`,'Download the HTML report for static screenshot evidence and the CSV for per-frame RGB/luminance measurements.']:[]),
    '', 'Flagged intervals (relative seconds):',...report.windows.map(w=>`${w.start.toFixed(2)}–${w.end.toFixed(2)}s; general=${w.general}; red=${w.red}; sampled flagged fraction=${w.fraction}; normalized region=${JSON.stringify(w.box)}`),
    '', 'Limitations:',...report.limitations.map(x=>`- ${x}`),'',
    'VPAT/ACR working note (requires reviewer validation):',
    `A browser capture of the referenced page was screened during the described interactions. ${report.outcome}. This screening does not determine support for SC 2.3.1. Review all relevant page states and verify flash frequency, general/red thresholds and concurrent area before assigning a conformance level.`,
    '', 'Reference: https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html'];
  download(lines.join('\n'),'text/plain','txt');
});
for(const example of examples){
  const card=document.createElement('article');card.className='example-card';
  const heading=document.createElement('h3');heading.textContent=example.title;
  const description=document.createElement('p');description.textContent=example.expectation;
  const v=exampleValues(example),values=document.createElement('p');values.className='example-values';
  values.textContent=`A: RGB ${example.a.join('/')} · Y ${v.a.y.toFixed(5)} | B: RGB ${example.b.join('/')} · Y ${v.b.y.toFixed(5)} | ΔY ${v.delta.toFixed(5)} | ${example.hz} cycles/sec`;
  const button=document.createElement('button');button.type='button';button.dataset.example=example.id;button.textContent='Analyze without playback';
  const result=document.createElement('p');result.className='hint';result.setAttribute('role','status');
  button.addEventListener('click',()=>{
    if(active||pending)return;
    const shot=document.createElement('canvas');shot.width=320;shot.height=180;const context=shot.getContext('2d');
    report=syntheticExample(example,rgb=>{context.fillStyle=`rgb(${rgb.join(',')})`;context.fillRect(0,0,320,180);return shot.toDataURL('image/png');});
    renderReport(report.endedBecause);
    result.textContent=`Synthetic result: peak general ${report.peakGeneral}, red candidates ${report.peakRedHeuristic} per rolling second. ${report.windows.length?'Flagged for review.':'No interval flagged.'} Full measurements and downloads are in Capture workspace above.`;
  });
  const link=document.createElement('a');link.href=`example.html?case=${example.id}`;link.target='_blank';link.rel='noopener';link.textContent=example.fail?'Open warning for live fail example ↗':'Open live example (manual start) ↗';
  card.append(heading,description,values,button,link,result);$('examples').append(card);
}
if(!navigator.mediaDevices?.getDisplayMedia||!video.requestVideoFrameCallback)$('support').textContent='Capture APIs are unavailable here. Open this tool in desktop Chrome or Edge over HTTPS or localhost.';
