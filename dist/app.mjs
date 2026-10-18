import {Analyzer,outcomeFor} from './analyzer.mjs?v=0.5.1-20261018';
import {Evidence,evidenceMarkup,csv,witnessCsv,reportHtml} from './evidence.mjs?v=0.5.1-20261018';
import * as reportModule from './report.mjs?v=0.5.1-20261018';
import * as examplesModule from './examples.mjs?v=0.5.1-20261018';
import {areaSummary,unappliedArea} from './area.mjs?v=0.5.1-20261018';
import {startupSummary,sc232Summary} from './export-metadata.mjs?v=0.5.1-20261018';
export const MODULE_BUILD='flash-review-0.5.1-20261018';
(globalThis.flashReviewModules??={})['app']=MODULE_BUILD;
export const PAGE_MODULES=["analyzer","app","area","evidence","examples","export-metadata","report"];
// Namespace imports: a stale report.mjs or examples.mjs must produce a reload message,
// not a module-linking failure that leaves a dead page.
const {stampReport,reviewText}=reportModule,{examples,exampleValues,syntheticExample}=examplesModule;
const moduleVersionProblem=()=>{try{return typeof reportModule.moduleVersionProblem==='function'?reportModule.moduleVersionProblem(PAGE_MODULES):STALE_REPORT;}catch{return STALE_REPORT;}};
const STALE_REPORT='Mixed Flash Review files are loaded (report unversioned). Hard-reload this page (Shift + Reload) before testing.';
const $=id=>document.getElementById(id);
let stream=null,analyzer=null,active=false,pending=false,report=null,callback=null,timer=null;
let frameStart=null,lastMedia=null,startedAt=0,meta=null,settings=null,run=0;
let evidence=null;
let startupTimer=null,rejectedSurface=null,settle=null;
// Sharing UI (e.g. Chrome's sharing infobar) animates the shared viewport for a
// few hundred ms. Geometry is locked only after the size has been stable for
// SETTLE_SECONDS. Frames at that final size are buffered and analyzed once it is
// confirmed, so the stable start of a capture is not lost. Frames at sizes that
// later changed are screened separately for flashing frequency (no area) and are
// reported as discarded coverage, never silently dropped.
const SETTLE_SECONDS=.5,SETTLE_BUFFER_BYTES=64*1024*1024;
const video=$('source'),canvas=$('pixels'),ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
function message(headline,body,state){$('headline').textContent=headline;$('status').textContent=body;$('state').textContent=state;}
function lock(value){for(const id of ['target','notes','duration','resolution','start','probe-x','probe-y','keep-shots','area-enabled','css-width','css-height','presentation'])$(id).disabled=value;document.querySelectorAll('[data-example]').forEach(el=>el.disabled=value);$('stop').hidden=!active;}
function stats(r){$('seconds').textContent=r.duration.toFixed(1);$('fps').textContent=r.observedFps.toFixed(1);$('general').textContent=r.peakGeneral;$('red').textContent=r.peakRedHeuristic;}
function requestNextFrame(){const generation=run;return video.requestVideoFrameCallback((now,info)=>{if(generation===run)frame(now,info);});}
function cleanup(){
  clearTimeout(timer);timer=null;
  clearTimeout(startupTimer);startupTimer=null;
  if(callback!==null)video.cancelVideoFrameCallback?.(callback);callback=null;
  stream?.getTracks().forEach(t=>t.stop());stream=null;video.pause();video.srcObject=null;
}
function analysisSize(w,h){const scale=Math.min(meta.width/w,640/h,1);return [Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))];}
function grab(w,h){if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}ctx.drawImage(video,0,0,w,h);return ctx.getImageData(0,0,w,h).data;}
// Screen one discarded (transitional-size) startup segment for flashing frequency.
function screenSegment(){
  const frames=settle.buffer;if(!frames.length)return;
  const a=new Analyzer(frames[0].w,frames[0].h);for(const f of frames)a.push(f.rgba,f.t-settle.firstTime);
  const r=a.report();
  settle.transitionalCandidates||=r.windows.length>0;settle.transitionalStrict||=r.sc232.windows.length>0;settle.segments++;
  const at=w=>({...w,start:w.start+frames[0].t-settle.firstTime,end:w.end+frames[0].t-settle.firstTime});
  // Windows are kept for every segment (up to 512); per-segment detail is capped at 32.
  for(const w of r.windows)if(settle.windows.length<512)settle.windows.push(at(w));
  for(const w of r.sc232.windows)if(settle.sc232Windows.length<512)settle.sc232Windows.push(at(w));
  if(settle.transitional.length<32)settle.transitional.push({sourceWidth:settle.width,sourceHeight:settle.height,frames:r.frames,
    startMediaSeconds:frames[0].t-settle.firstTime,durationSeconds:r.duration,peakGeneral:r.peakGeneral,peakRed:r.peakRedHeuristic,peakSc232:r.sc232.peakPairs,
    windows:r.windows.length,sc232Windows:r.sc232.windows.length});
}
// RT2-03: a small analyzer sampled at fixed relative positions sees every startup frame,
// across size changes, so a burst that straddles a change is still counted.
const BRIDGE=[16,9],BRIDGE_SECONDS=1.5;
function feedBridge(rgba,w,h,t){
  if(!settle?.bridge||settle.bridgeDone)return;
  const rel=t-settle.firstTime;if(settle.settledAt!==undefined&&rel>settle.settledAt-settle.firstTime+BRIDGE_SECONDS){settle.bridgeDone=true;return;}
  const [bw,bh]=BRIDGE,out=settle.bridgeFrame;
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const sx=Math.min(w-1,Math.floor((x+.5)*w/bw)),sy=Math.min(h-1,Math.floor((y+.5)*h/bh)),k=(sy*w+sx)*4,o=(y*bw+x)*4;
    out[o]=rgba[k];out[o+1]=rgba[k+1];out[o+2]=rgba[k+2];out[o+3]=255;}
  settle.bridge.push(out,rel);
}
function analyzeFrame(rgba,t,buffered){
  const frameResult=analyzer.push(rgba,t-frameStart);
  evidence.push(rgba,t-frameStart,frameResult,historical=>{
    if(!meta.keepShots)return null;
    const shot=document.createElement('canvas');
    const pixels=historical?.rgba??buffered;
    if(pixels){
      shot.width=canvas.width;shot.height=canvas.height;
      shot.getContext('2d').putImageData(new ImageData(pixels,canvas.width,canvas.height),0,0);
      return shot.toDataURL('image/png');
    }
    const scale=Math.min(1280/video.videoWidth,1280/video.videoHeight,1);
    shot.width=Math.max(1,Math.round(video.videoWidth*scale));shot.height=Math.max(1,Math.round(video.videoHeight*scale));
    shot.getContext('2d').drawImage(video,0,0,shot.width,shot.height);
    return shot.toDataURL('image/jpeg',.85);
  });
}
// Lock geometry on the buffered final-size segment, then analyze it. Returns false on
// an aspect rejection. `confirmed` is false when the capture ended before a frame
// arrived SETTLE_SECONDS after the size was first seen.
function startAnalysis(confirmed){
  const {width:w,height:h}=settle;settle.confirmed=confirmed;
  // Written so NaN (zero-size frames) is rejected rather than accepted.
  if(meta.calibration&&!(Math.abs((w/h)/(meta.calibration.cssWidth/meta.calibration.cssHeight)-1)<=.02)){
    rejectedSurface={width:w,height:h};settle.discarded+=settle.buffer.length;settle.buffer=[];settle.bytes=0;
    if(confirmed)finish('Area calibration aspect ratio does not match the shared surface; correct CSS dimensions and start a new capture');
    return false;
  }
  const first=settle.buffer[0];canvas.width=first.w;canvas.height=first.h;
  analyzer=new Analyzer(first.w,first.h,{calibration:meta.calibration});
  evidence=new Evidence(first.w,first.h,meta.probeX,meta.probeY);
  meta.viewport={width:w,height:h};frameStart=first.t;settle.analyzedFromBuffer=settle.buffer.length;
  for(const f of settle.buffer)analyzeFrame(f.rgba,f.t,f.rgba);
  settle.buffer=[];settle.bytes=0;
  return true;
}
function unsettledReason(s){
  return s.changes===0?`Only one frame size was observed (${s.observed} frame(s)), and no frame arrived at least ${SETTLE_SECONDS} s after the size was first seen to confirm it was stable`:
    s.changes===1?`The shared surface size changed once, and the new size was not confirmed by a frame at least ${SETTLE_SECONDS} s later before the capture ended`:
    `Shared surface size kept changing (${s.changes} changes) and did not stay unchanged for ${SETTLE_SECONDS} s before the capture ended`;
}
function finish(reason){
  if(!active)return;active=false;cleanup();lock(false);
  if(meta.hidden?.since!=null){meta.hidden.seconds+=(performance.now()-meta.hidden.since)/1000;meta.hidden.since=null;}
  const s=settle;
  // A static page may deliver one size and few frames: analyze them as unconfirmed geometry.
  if(!analyzer&&s?.buffer.length&&s.changes===0&&!rejectedSurface)startAnalysis(false);
  if(!analyzer&&s?.buffer.length){s.discarded+=s.buffer.length;s.transitionalFrames+=s.buffer.length;screenSegment();s.buffer=[];}
  const result=analyzer?analyzer.report():new Analyzer(0,0).report();
  const unsettled=s&&s.settledAt===undefined?unsettledReason(s):null;
  const startupSettling=s&&{requiredStableSeconds:SETTLE_SECONDS,settled:s.settledAt!==undefined,geometryConfirmed:s.settledAt!==undefined,sizeChanges:s.changes,
    discardedFrames:s.discarded,discardedMediaSeconds:(analyzer?frameStart:lastMedia??s.firstTime)-s.firstTime,
    analyzedStartupFrames:s.analyzedFromBuffer??0,bufferOverflowFrames:s.dropped,invalidSizeFrames:s.invalid,sourceSizes:s.sizes,
    transitionalFrames:s.transitionalFrames,transitionalSegments:s.segments,transitionalScreening:s.transitional,
    bridge:(()=>{const b=s.bridge.report();return {analysisResolution:{width:BRIDGE[0],height:BRIDGE[1]},frames:b.frames,peakGeneral:b.peakGeneral,peakRed:b.peakRedHeuristic,peakSc232:b.sc232.peakPairs,candidates:b.windows.length>0,sc232Candidates:b.sc232.windows.length>0};})(),
    transitionalCandidates:s.transitionalCandidates,transitionalSc232Candidates:s.transitionalStrict,unconfirmedReason:unsettled};
  if(s?.transitionalFrames)result.limitations=[...result.limitations,`${s.transitionalFrames} startup frame(s) at transitional or invalid sizes were discarded for area and analyzed-geometry purposes (${startupSettling.discardedMediaSeconds.toFixed(3)} s); each transitional size was screened separately for flashing frequency only (${s.segments} segment(s)), and a ${BRIDGE.join(' × ')} startup bridge screened frequency across the size changes.`];
  if(s?.dropped)result.limitations=[...result.limitations,`${s.dropped} frame(s) at the final size were dropped by the ${SETTLE_BUFFER_BYTES/1048576} MB settling buffer before geometry was confirmed; the analysis origin is the first retained frame. They were screened for frequency by the startup bridge only.`];
  if(s&&unsettled&&analyzer)result.limitations=[...result.limitations,`Geometry was not confirmed stable: ${unsettled}. ${result.frames} frame(s) at the only observed size were analyzed anyway.`];
  if(meta.hidden?.events||meta.hidden?.seconds)result.observation={...result.observation,meetsScreeningMinimum:false,reasons:[...result.observation.reasons,`The analyzer page was hidden for ${meta.hidden.seconds.toFixed(1)} s during capture (${meta.hidden.events} time(s)). Browsers deliver no frames to a hidden page, so that time was not analyzed. Keep the analyzer in its own visible window`]};
  if(unsettled&&!rejectedSurface)result.observation={...result.observation,meetsScreeningMinimum:false,reasons:[...result.observation.reasons,unsettled]};
  // Candidates in transitional startup frames are candidates, even without area.
  const offset=analyzer?frameStart-s.firstTime:0;
  const shift=w=>({...w,start:w.start-offset,end:w.end-offset,startupTransitional:true,area:null});
  const bridge=s?.bridge.report();
  const bridgeWindows=bridge?bridge.windows.map(w=>({...shift(w),startupBridge:true})):[],bridgeSc232=bridge?bridge.sc232.windows.map(w=>({...shift(w),startupBridge:true})):[];
  const startupWindows=[...(s?.windows??[]).map(shift),...(!s?.transitionalCandidates&&!result.windows.length?bridgeWindows:[])];
  const startupSc232=[...(s?.sc232Windows??[]).map(shift),...(!s?.transitionalStrict&&!result.sc232.windows.length?bridgeSc232:[])];
  if(startupWindows.length){result.windows=[...startupWindows,...result.windows];result.status='candidates-detected';result.outcome=outcomeFor(result.status);}
  if(startupSc232.length){result.sc232={...result.sc232,windows:[...startupSc232,...result.sc232.windows],status:'candidates-detected',outcome:outcomeFor('candidates-detected')};}
  if(!analyzer&&meta.calibration){
    result.area=unappliedArea(meta.calibration,rejectedSurface?(s?.settledAt===undefined?'Area calibration aspect ratio does not match the shared surface (size not confirmed stable); correct CSS dimensions and start a new capture.':reason+'.'):s?`${unsettled}; no frames were analyzed.`:'No frames were analyzed before the capture ended.',rejectedSurface);
    result.evaluation={...result.evaluation,area:result.area.status};
  }
  report=stampReport({...result,createdAt:new Date().toISOString(),criterion:'WCAG 2.2 SC 2.3.1 (Level A); SC 2.3.2 (Level AAA) strict screening',
    reference:meta.reference,interactions:meta.interactions,requestedSeconds:meta.seconds,
    captureSettings:settings,endedBecause:reason,viewport:meta.viewport,startupSettling,analyzerHidden:meta.hidden?{seconds:meta.hidden.seconds,events:meta.hidden.events}:null,evidence:evidence?.report(),
    scope:'Shared surface only; reference URL and interactions are supplied by the reviewer.'});
  evidence?.releaseHistory();
  renderReport(reason);
}
function renderReport(reason){
  stats(report);$('progress').value=100;
  message(report.status==='insufficient-observation'?'Insufficient observation — inconclusive':report.status==='candidates-detected'?'Potential flashing detected':'No candidates — conformance inconclusive',
    'General screening only. '+areaSummary(report.area)+' No result establishes a WCAG pass or failure.', 'Inconclusive / review');
  const quality=[];
  if(report.duration<1)quality.push('Less than one second was sampled.');
  if(report.observedFps<30)quality.push('Observed sampling was below 30 frames/sec.');
  if(report.maxFrameGapSeconds>.1)quality.push(`Capture gap reached ${report.maxFrameGapSeconds.toFixed(3)} seconds.`);
  if(reason!=='Time limit reached')quality.push(`Capture ended: ${reason}.`);
  quality.push(...(report.observation?.reasons??[]));
  if(report.startupSettling)quality.push(startupSummary(report.startupSettling));
  if(report.sc232)quality.push(sc232Summary(report.sc232));
  quality.push('Sampling can miss flashing even at higher frame rates. '+areaSummary(report.area));
  $('quality').textContent=quality.join(' ');
  if(report.synthetic)$('quality').textContent=`Synthetic example: ${report.interactions} Generated frames do not validate actual tab capture, display timing, or physical flash area.`;
  $('provenance').textContent=`Report ${report.reportId} · ${report.buildId} · Source: ${report.sourceType} · Result: ${report.status}`;
  $('luminance-evidence').innerHTML=report.evidence?evidenceMarkup(report.evidence,report.viewport):'<p>No luminance evidence captured.</p>';
  $('intervals').replaceChildren();
  if(!report.windows.length){const p=document.createElement('p');p.className='hint';p.textContent='No intervals were flagged. This does not establish conformance.';$('intervals').append(p);}
  for(const w of report.windows){
    const el=document.createElement('div');el.className='interval';const b=w.box;
    el.textContent=`${w.startupTransitional?'[startup, before geometry lock] ':''}${w.start.toFixed(2)}–${w.end.toFixed(2)} s · General ${w.general} · Red candidates ${w.red} · ${(w.fraction*100).toFixed(2)}% of sampled pixels flagged. Region: x ${(b.x*100).toFixed(1)}%, y ${(b.y*100).toFixed(1)}%, w ${(b.width*100).toFixed(1)}%, h ${(b.height*100).toFixed(1)}%.`;
    $('intervals').append(el);
  }
  $('report').hidden=false;
}
function frame(now,info){
  if(!active)return;
  try{
    if(lastMedia!==null&&info.mediaTime<=lastMedia){callback=requestNextFrame();return;}
    lastMedia=info.mediaTime;
    const w=video.videoWidth,h=video.videoHeight;
    if(!analyzer){
      if(!settle)settle={firstTime:info.mediaTime,discarded:0,changes:0,observed:0,sizes:[],buffer:[],bytes:0,dropped:0,invalid:0,transitional:[],transitionalCandidates:false,transitionalStrict:false,
        segments:0,transitionalFrames:0,windows:[],sc232Windows:[],bridge:new Analyzer(...BRIDGE),bridgeFrame:new Uint8ClampedArray(BRIDGE[0]*BRIDGE[1]*4),bridgeDone:false};
      if(!(w>0&&h>0)){settle.invalid++;settle.discarded++;settle.transitionalFrames++;callback=requestNextFrame();return;}
      if(settle.width!==w||settle.height!==h){
        if(settle.width!==undefined){settle.changes++;settle.discarded+=settle.buffer.length;settle.transitionalFrames+=settle.buffer.length;screenSegment();settle.buffer=[];settle.bytes=0;settle.observed=0;}
        Object.assign(settle,{width:w,height:h,since:info.mediaTime});
        if(settle.sizes.length<32)settle.sizes.push({width:w,height:h,mediaSeconds:info.mediaTime-settle.firstTime});
      }
      const [aw,ah]=analysisSize(w,h),rgba=new Uint8ClampedArray(grab(aw,ah));
      settle.buffer.push({t:info.mediaTime,rgba,w:aw,h:ah});settle.bytes+=rgba.byteLength;settle.observed++;feedBridge(rgba,aw,ah,info.mediaTime);
      while(settle.bytes>SETTLE_BUFFER_BYTES){const old=settle.buffer.shift();settle.bytes-=old.rgba.byteLength;settle.dropped++;settle.discarded++;}
      if(info.mediaTime-settle.since<SETTLE_SECONDS){callback=requestNextFrame();return;}
      settle.settledAt=info.mediaTime;
      if(!startAnalysis(true))return;
    } else {
      if(meta.viewport.width!==w||meta.viewport.height!==h){finish('Shared surface dimensions changed; start a new capture');return;}
      const rgba=grab(canvas.width,canvas.height);analyzeFrame(rgba,info.mediaTime,null);feedBridge(rgba,canvas.width,canvas.height,info.mediaTime);
    }
    // Refresh text at most twice a second; no captured pixels are displayed.
    if(analyzer.frames===1||now-(meta.lastUpdate??0)>500){stats(analyzer.report());meta.lastUpdate=now;}
    $('progress').value=Math.min(100,(performance.now()-startedAt)/(meta.seconds*10));
    if(info.mediaTime-frameStart>=meta.seconds){finish('Time limit reached');return;}
    callback=requestNextFrame();
  }catch(error){finish(`Analysis interrupted (${error.name||'error'})`);}
}
$('setup').addEventListener('submit',async event=>{
  event.preventDefault();if(active||pending)return;
  const versionProblem=moduleVersionProblem();if(versionProblem){message('Reload required',versionProblem,'Unavailable');return;}
  if(!navigator.mediaDevices?.getDisplayMedia||!video.requestVideoFrameCallback){message('Capture unavailable','Open this tool in desktop Chrome or Edge over HTTPS or localhost. This browser does not provide the required tab-capture APIs.','Unavailable');return;}
  const token=++run;
  // A canceled or blocked new capture must not leave a prior report exportable.
  report=null;evidence=null;$('report').hidden=true;$('luminance-evidence').innerHTML='';
  meta={reference:$('target').value.trim(),interactions:$('notes').value.trim(),seconds:Number($('duration').value),width:Number($('resolution').value),probeX:Number($('probe-x').value),probeY:Number($('probe-y').value),keepShots:$('keep-shots').checked};
  meta.calibration=$('area-enabled').checked?{cssWidth:Number($('css-width').value),cssHeight:Number($('css-height').value)}:null;
  if(meta.calibration&&(!Number.isFinite(meta.calibration.cssWidth)||!Number.isFinite(meta.calibration.cssHeight)||meta.calibration.cssWidth<=0||meta.calibration.cssHeight<=0||meta.calibration.cssWidth>100000||meta.calibration.cssHeight>100000)){message('Calibration required','Enter valid displayed CSS dimensions for the entire shared surface.','Ready');return;}
  meta.presentation=$('presentation').value||'unspecified';
  pending=true;lock(true);message('Choose your target tab','Select the webpage tab in the browser’s sharing picker. Keep the page under review in its own window, and keep this analyzer window visible beside it: a hidden analyzer tab receives no frames.','Choosing tab');
  try{
    const selected=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:60}},audio:false,preferCurrentTab:false});
    if(token!==run){selected.getTracks().forEach(t=>t.stop());return;}
    stream=selected;const track=stream.getVideoTracks()[0];const raw=track.getSettings();
    settings={width:raw.width,height:raw.height,frameRate:raw.frameRate,displaySurface:raw.displaySurface,presentation:meta.presentation,calibration:meta.calibration};
    // Do not export device IDs or the browser-provided tab/window title.
    active=true;pending=false;analyzer=null;evidence=null;rejectedSurface=null;settle=null;frameStart=null;lastMedia=null;report=null;
    // Hidden time counts from the moment sharing starts; an already hidden page is one event.
    meta.hidden={seconds:0,events:document.hidden?1:0,since:document.hidden?performance.now():null};
    $('report').hidden=true;$('progress').value=0;lock(true);
    track.addEventListener('ended',()=>finish('Sharing stopped by reviewer'),{once:true});
    startupTimer=setTimeout(()=>finish('Video startup timed out'),10000);
    video.srcObject=stream;await video.play();if(!active||token!==run)return;
    clearTimeout(startupTimer);startupTimer=null;
    startedAt=performance.now();
    message('Capture in progress','Exercise the shared page now, in its own window. Keep this analyzer window visible; do not switch to the shared page as another tab in this window, or nothing is analyzed. This capture ends automatically, or press Stop.','Capturing');
    timer=setTimeout(()=>finish('Time limit reached'),meta.seconds*1000);
    callback=requestNextFrame();
  }catch(error){
    if(token!==run)return;
    if(active)finish(`Capture interrupted (${error.name||'error'})`);
    else {cleanup();message('Capture did not start',error.name==='NotAllowedError'?'Sharing was canceled or blocked. Click Share a tab to try again.':`Tab capture could not start (${error.name||'error'}). Try opening the tool in desktop Chrome or Edge.`,'Ready');}
  }finally{if(token===run){pending=false;lock(active);}}
});
$('stop').addEventListener('click',()=>finish('Stopped early by reviewer'));
window.addEventListener('pagehide',()=>{run++;active=false;cleanup();});
document.addEventListener('visibilitychange',()=>{
  if(!active||!meta?.hidden)return;
  if(document.hidden){meta.hidden.events++;meta.hidden.since=performance.now();}
  else if(meta.hidden.since!=null){meta.hidden.seconds+=(performance.now()-meta.hidden.since)/1000;meta.hidden.since=null;
    message('Capture in progress',`This analyzer was hidden for ${meta.hidden.seconds.toFixed(1)} s, and nothing was analyzed while it was hidden. Keep it in its own visible window.`,'Capturing');}
});
function download(text,type,extension,suffix=''){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=`flash-review-${report.reportId}${suffix}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('json').addEventListener('click',()=>{if(report)download(JSON.stringify(report,null,2),'application/json','json');});
$('html-report').addEventListener('click',()=>{if(report)download(reportHtml(report),'text/html','html');});
// Captures that end before evidence exists still export metadata-only records.
$('csv').addEventListener('click',()=>{if(report)download(csv(report.evidence,report),'text/csv','csv','-selected-probe');});
$('witness-csv').addEventListener('click',()=>{if(report)download(witnessCsv(report.evidence,report),'text/csv','csv','-detection-witness');});
$('text').addEventListener('click',()=>{if(report)download(reviewText(report),'text/plain','txt');});
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
if(moduleVersionProblem())$('support').textContent=moduleVersionProblem();
else if(!navigator.mediaDevices?.getDisplayMedia||!video.requestVideoFrameCallback)$('support').textContent='Capture APIs are unavailable here. Open this tool in desktop Chrome or Edge over HTTPS or localhost.';
// Page watchdog (index.html) reports a load failure if this line is never reached.
globalThis.flashReviewReady=true;
