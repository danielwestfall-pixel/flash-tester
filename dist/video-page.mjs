import {videoUrls, videoFileKind, createVideoElement, loadVideoMetadata, scanVideo} from './video-scanner.mjs';
import {reportHtml, csv, witnessCsv} from './evidence.mjs';

const $=id=>document.getElementById(id);

let currentVideo=null;
let currentSource=null;
let currentMetadata=null;
let scanController=null;
let loadController=null;
let outputReport=null;
let outputEvidence=null;
let isScreening=false;
let isPlaying=false;

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

function updateButtons(){
  const failsafeOk=$('confirm-text')?checkFailsafe($('confirm-text').value):true;
  const ackOk=$('ack')?.checked??false;
  const hasVideo=Boolean(currentVideo&&currentMetadata);

  if($('screen-btn'))$('screen-btn').disabled=!hasVideo||isScreening||isPlaying;
  if($('play-btn'))$('play-btn').disabled=!hasVideo||isScreening||isPlaying||!(failsafeOk&&ackOk);
  if($('load-btn'))$('load-btn').disabled=isScreening||isPlaying;
  if($('file'))$('file').disabled=isScreening||isPlaying;
  if($('url'))$('url').disabled=isScreening||isPlaying;
}

if($('confirm-text')){
  $('confirm-text').addEventListener('input',()=>{
    const ok=checkFailsafe($('confirm-text').value);
    const badge=$('failsafe-badge');
    if(badge){
      badge.textContent=ok?'🔓 Confirmed: Fail-safe unlocked':'🔒 Locked';
      badge.className=ok?'failsafe-badge unlocked':'failsafe-badge';
    }
    updateButtons();
  });
}

if($('ack')){
  $('ack').addEventListener('change',updateButtons);
}

// 1. Loading video file or URL
$('load-btn')?.addEventListener('click',async()=>{
  if(isScreening||isPlaying)return;

  const fileInput=$('file');
  const urlInput=$('url');
  const file=fileInput.files?.[0];
  const urlVal=urlInput.value.trim();

  if(!file&&!urlVal){
    $('load-status').textContent='Please select a local video file or enter a video URL first.';
    return;
  }

  $('load-status').textContent='Inspecting video format and loading metadata…';
  $('load-btn').disabled=true;
  if($('cancel-load-btn')){$('cancel-load-btn').hidden=false;$('cancel-load-btn').disabled=false;}

  const controller=new AbortController();
  loadController=controller;

  try{
    let srcUrl;
    let formatLabel='video';
    let isObjUrl=false;

    if(file){
      if(file.size>500*1024*1024)throw Error('Video file exceeds 500 MB limit.');
      // Check header bytes
      const headerBuf=new Uint8Array(await file.slice(0,64).arrayBuffer());
      formatLabel=videoFileKind(headerBuf);
      srcUrl=URL.createObjectURL(file);
      isObjUrl=true;
    }else{
      const validated=videoUrls(urlVal);
      srcUrl=validated[0];
      formatLabel='network stream';
    }

    if(currentSource&&currentSource.startsWith('blob:')){
      URL.revokeObjectURL(currentSource);
    }
    currentSource=srcUrl;

    const video=createVideoElement(srcUrl,isObjUrl);
    const meta=await loadVideoMetadata(video);

    currentVideo=video;
    currentMetadata=meta;

    $('load-status').textContent=`Loaded ${file?file.name:'URL video'} (${formatLabel}).\nDuration: ${meta.duration.toFixed(2)} seconds | Dimensions: ${meta.width} × ${meta.height} px. Ready for safe screening.`;
    if($('screen-btn'))$('screen-btn').disabled=false;
    updateButtons();
  }catch(e){
    currentVideo=null;
    currentMetadata=null;
    $('load-status').textContent=`Failed to inspect video: ${e.message}`;
    updateButtons();
  }finally{
    loadController=null;
    if($('cancel-load-btn')){$('cancel-load-btn').hidden=true;$('cancel-load-btn').disabled=true;}
    $('load-btn').disabled=false;
  }
});

$('cancel-load-btn')?.addEventListener('click',()=>{
  if(loadController){
    loadController.abort();
    $('load-status').textContent='Video loading cancelled.';
  }
});

// 2. Safe background screening
$('screen-btn')?.addEventListener('click',async()=>{
  if(!currentVideo||!currentMetadata||isScreening||isPlaying)return;

  isScreening=true;
  updateButtons();
  $('progress-container').hidden=false;
  $('stats-grid').hidden=false;
  $('results-section').hidden=true;
  $('intervals').replaceChildren();

  const maxDuration=Number($('max-duration').value)||30;
  const fps=Number($('fps').value)||30;
  const cssWidth=Number($('css-width').value)||1024;
  const cssHeight=Number($('css-height').value)||768;

  const controller=new AbortController();
  scanController=controller;
  if($('cancel-screen-btn')){$('cancel-screen-btn').hidden=false;$('cancel-screen-btn').disabled=false;}

  try{
    const scale=Math.min(640/currentMetadata.width,360/currentMetadata.height,1);
    const analysisWidth=Math.max(1,Math.round(currentMetadata.width*scale));
    const analysisHeight=Math.max(1,Math.round(currentMetadata.height*scale));

    const {report,evidence}=await scanVideo(currentVideo,{
      analysisWidth,
      analysisHeight,
      maxDuration,
      stepFps:fps,
      calibration:{cssWidth,cssHeight},
      signal:controller.signal,
      onProgress:p=>{
        $('progress-bar').value=p.percent;
        $('progress-text').textContent=`Screening: ${p.percent.toFixed(1)}% (${p.time.toFixed(1)}s / ${p.duration.toFixed(1)}s) · ${p.frames} frames`;
        $('stat-status').textContent=p.peakGeneral>3?'⚠️ Candidates':'Scanning';
        $('stat-frames').textContent=p.frames;
        $('stat-general').textContent=p.peakGeneral;
        $('stat-red').textContent=p.peakRed;
      }
    });

    outputReport=report;
    outputEvidence=evidence;

    $('progress-bar').value=100;
    $('progress-text').textContent='Screening complete.';
    $('stat-status').textContent=report.status==='candidates-detected'?'⚠️ Candidates':'✓ No candidates';
    $('stat-general').textContent=report.peakGeneral;
    $('stat-red').textContent=report.peakRedHeuristic;

    $('result-summary').textContent=`Result: ${report.outcome} (Status: ${report.status}). Analyzed ${report.frames} frames across ${report.duration.toFixed(2)}s at ${report.observedFps.toFixed(1)} fps.`;

    if(report.windows.length){
      for(const w of report.windows){
        const el=document.createElement('div');
        el.className='interval-item';
        el.textContent=`Interval ${w.start.toFixed(2)}s – ${w.end.toFixed(2)}s: General=${w.general}, Red=${w.red}, Flagged Area=${(w.fraction*100).toFixed(1)}%`;
        $('intervals').append(el);
      }
    }else{
      const el=document.createElement('p');
      el.textContent='No intervals exceeded the frequency threshold (<= 3 flashes in any rolling second).';
      $('intervals').append(el);
    }

    $('results-section').hidden=false;
  }catch(e){
    $('progress-text').textContent=`Screening interrupted: ${e.message}`;
    $('stat-status').textContent='Stopped';
  }finally{
    isScreening=false;
    scanController=null;
    if($('cancel-screen-btn')){$('cancel-screen-btn').hidden=true;$('cancel-screen-btn').disabled=true;}
    updateButtons();
  }
});

$('cancel-screen-btn')?.addEventListener('click',()=>{
  if(scanController){
    scanController.abort();
  }
});

// 3. Download report handlers
function downloadFile(content,filename,mimeType){
  const blob=new Blob([content],{type:mimeType});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;
  a.click();
  URL.revokeObjectURL(url);
}

$('download-json')?.addEventListener('click',()=>{
  if(!outputReport)return;
  downloadFile(JSON.stringify(outputReport,null,2),`flash-review-video-${Date.now()}.json`,'application/json');
});

$('download-html')?.addEventListener('click',()=>{
  if(!outputReport)return;
  const htmlContent=reportHtml(outputReport);
  downloadFile(htmlContent,`flash-review-video-${Date.now()}.html`,'text/html');
});

$('download-csv')?.addEventListener('click',()=>{
  if(!outputReport||!outputEvidence)return;
  const csvContent=csv(outputEvidence,outputReport);
  downloadFile(csvContent,`flash-review-video-evidence-${Date.now()}.csv`,'text/csv');
});

// 4. Live playback preview with emergency stops
function stopLivePlayback(reason='stopped by user'){
  if(!isPlaying)return;
  isPlaying=false;
  const player=$('preview-player');
  if(player){player.pause();player.removeAttribute('src');}
  $('stage').hidden=true;
  $('setup').hidden=false;
  if($('ack'))$('ack').checked=false;
  if($('confirm-text'))$('confirm-text').value='';
  const badge=$('failsafe-badge');
  if(badge){badge.textContent='🔒 Locked';badge.className='failsafe-badge';}
  $('load-status').textContent=`Live preview ${reason}.`;
  updateButtons();
}

$('play-btn')?.addEventListener('click',()=>{
  if(!currentSource||isPlaying||isScreening)return;
  const failsafeOk=$('confirm-text')?checkFailsafe($('confirm-text').value):true;
  const ackOk=$('ack')?.checked??false;
  if(!failsafeOk||!ackOk)return;

  isPlaying=true;
  updateButtons();

  $('setup').hidden=true;
  $('stage').hidden=false;
  $('live-state').textContent='Playing live video preview. Press Escape to abort immediately.';

  const player=$('preview-player');
  player.src=currentSource;
  player.currentTime=0;
  player.play().catch(()=>{});

  player.addEventListener('ended',()=>stopLivePlayback('ended naturally'),{once:true});
});

$('halt')?.addEventListener('click',()=>stopLivePlayback('stopped by user'));
window.addEventListener('keydown',e=>{if(e.key==='Escape')stopLivePlayback('aborted by Escape key');});
window.addEventListener('blur',()=>stopLivePlayback('stopped: window lost focus'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopLivePlayback('stopped: tab hidden');});
window.addEventListener('pagehide',()=>{
  stopLivePlayback('aborted by page navigation');
  if(loadController){loadController.abort();loadController=null;}
  if(scanController){scanController.abort();scanController=null;}
  if(currentSource&&currentSource.startsWith('blob:')){
    URL.revokeObjectURL(currentSource);
  }
  currentVideo=null;currentSource=null;currentMetadata=null;outputReport=null;outputEvidence=null;isScreening=false;isPlaying=false;
  $('progress-box')?.setAttribute('hidden','true');
  $('result-table')?.setAttribute('hidden','true');
  $('report-box')?.setAttribute('hidden','true');
  if($('load-status'))$('load-status').textContent='Video resources released during navigation. Load video again to screen.';
  updateButtons();
});
window.addEventListener('pageshow',()=>{updateButtons();});
updateButtons();
