import {Analyzer} from './analyzer.mjs?v=0.5.1-20261018';
import {Evidence,csv,witnessCsv,reportHtml} from './evidence.mjs?v=0.5.1-20261018';
import * as reportModule from './report.mjs?v=0.5.1-20261018';
import * as sourceModule from './file-source.mjs?v=0.5.1-20261018';
import {areaSummary} from './area.mjs?v=0.5.1-20261018';
import {sc232Summary} from './export-metadata.mjs?v=0.5.1-20261018';
export const MODULE_BUILD='flash-review-0.5.1-20261018';
(globalThis.flashReviewModules??={})['file-analysis-page']=MODULE_BUILD;
export const PAGE_MODULES=["analyzer","area","evidence","export-metadata","file-analysis-page","file-source","report"];
const {stampReport,reviewText}=reportModule,{fileKind,imageType,videoSampleTimes,frameSeconds,playsFor,animationSamples}=sourceModule;
const moduleVersionProblem=()=>{try{return typeof reportModule.moduleVersionProblem==='function'?reportModule.moduleVersionProblem(PAGE_MODULES):STALE_REPORT;}catch{return STALE_REPORT;}};
const STALE_REPORT='Mixed Flash Review files are loaded (report unversioned). Hard-reload this page (Shift + Reload) before testing.';
const $=id=>document.getElementById(id),canvas=$('pixels'),ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
const MAX_IMAGE_FRAMES=3000,MAX_FRAME_BYTES=768*1024*1024,MAX_HASH_BYTES=1024*1024*1024;
let report=null,busy=false,generation=0;
const controls=['file','reference','rate','max-seconds','resolution','timing','background','area-enabled','css-width','css-height','keep-shots','analyze'];
function lock(value){for(const id of controls)$(id).disabled=value;$('cancel').hidden=!value;}
function status(text,progress){$('status').textContent=text;if(progress!=null)$('progress').value=progress;}
function analysisSize(w,h,width){const scale=Math.min(width/w,640/h,1);return [Math.max(1,Math.round(w*scale)),Math.max(1,Math.round(h*scale))];}
async function sha256(file){
  if(file.size>MAX_HASH_BYTES)return null;
  const digest=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
function settings(){
  const c={sampleRateHz:Number($('rate').value),maxSeconds:Number($('max-seconds').value),analysisWidth:Number($('resolution').value),timingModel:$('timing').value,background:$('background').value,keepShots:$('keep-shots').checked,
    calibration:$('area-enabled').checked?{cssWidth:Number($('css-width').value),cssHeight:Number($('css-height').value)}:null};
  if(c.calibration&&(!Number.isFinite(c.calibration.cssWidth)||!Number.isFinite(c.calibration.cssHeight)||c.calibration.cssWidth<=0||c.calibration.cssHeight<=0||c.calibration.cssWidth>100000||c.calibration.cssHeight>100000))throw Error('Enter valid displayed CSS dimensions.');
  return c;
}
// Static PNG frames at analysis resolution for the evidence report (never animated).
function shooter(c,w,h){
  return pixels=>{if(!c.keepShots||!pixels)return null;const shot=document.createElement('canvas');shot.width=w;shot.height=h;
    shot.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(pixels),w,h),0,0);return shot.toDataURL('image/png');};
}
function aspectProblem(c,w,h){
  return c.calibration&&!(Math.abs((w/h)/(c.calibration.cssWidth/c.calibration.cssHeight)-1)<=.02)?
    `Area calibration ${c.calibration.cssWidth} × ${c.calibration.cssHeight} CSS px does not match the file aspect ratio (${w} × ${h}); correct the displayed size or disable area measurement.`:null;
}
function seek(video,t){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{cleanup();reject(Error('Seek timed out'));},10000);
    const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Decode error while seeking'));};
    const cleanup=()=>{clearTimeout(timer);video.removeEventListener('seeked',done);video.removeEventListener('error',fail);};
    video.addEventListener('seeked',done);video.addEventListener('error',fail);video.currentTime=t;
  });
}
async function analyzeVideo(file,c,token){
  const url=URL.createObjectURL(file),video=document.createElement('video');
  // Attached (seeking needs a rendered element) but transparent and 1 px: never visible.
  video.muted=true;video.playsInline=true;video.preload='auto';video.setAttribute('aria-hidden','true');
  video.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  document.body.append(video);
  try{
    video.src=url;
    await new Promise((resolve,reject)=>{video.addEventListener('loadeddata',resolve,{once:true});video.addEventListener('error',()=>reject(Error('This browser cannot decode this video (codec or container unsupported).')),{once:true});});
    const W=video.videoWidth,H=video.videoHeight;if(!(W>0&&H>0))throw Error('Video has no decodable frames.');
    // Recorded WebM often reports an Infinity duration until the end has been seen (RT2-07).
    let durationNote=null;
    if(!Number.isFinite(video.duration)){
      try{await seek(video,1e7);}catch{}
      if(Number.isFinite(video.duration))durationNote='The container did not state a duration; it was found by seeking to the end.';
      else durationNote='The duration is unknown; analysis ran to the limit, and samples past the end may repeat the last frame.';
      try{await seek(video,0);}catch{}
    }
    const problem=aspectProblem(c,W,H);if(problem)throw Error(problem);
    const [w,h]=analysisSize(W,H,c.analysisWidth),plan=videoSampleTimes(video.duration,c.sampleRateHz,c.maxSeconds);
    if(!plan.times.length)throw Error('Video is shorter than one sample interval.');
    canvas.width=w;canvas.height=h;
    const analyzer=new Analyzer(w,h,{calibration:c.calibration}),evidence=new Evidence(w,h),shot=shooter(c,w,h);
    let ended='Whole file analyzed',changed=0,previous=null;
    for(const [i,t] of plan.times.entries()){
      if(token!==generation)return null;
      await seek(video,t);
      if(video.videoWidth!==W||video.videoHeight!==H){ended='Video dimensions changed; analysis stopped at the change';break;}
      ctx.drawImage(video,0,0,w,h);const rgba=ctx.getImageData(0,0,w,h).data;
      if(previous){for(let k=0;k<rgba.length;k+=4)if(rgba[k]!==previous[k]||rgba[k+1]!==previous[k+1]||rgba[k+2]!==previous[k+2]){changed++;break;}}
      previous=new Uint8ClampedArray(rgba);
      const frame=analyzer.push(rgba,t);evidence.push(rgba,t,frame,historical=>shot(historical?.rgba??rgba));
      if(i%20===0)status(`Decoded ${i+1} of ${plan.times.length} samples…`,100*i/plan.times.length);
    }
    if(plan.truncated&&ended==='Whole file analyzed')ended=`Analysis limit reached (${c.maxSeconds} s of ${video.duration.toFixed(1)} s)`;
    if(!Number.isFinite(video.duration)&&ended==='Whole file analyzed')ended=`Analysis limit reached (${c.maxSeconds} s; duration unknown)`;
    const changedFraction=plan.times.length>1?changed/(plan.times.length-1):0;
    return {analyzer,evidence,ended,viewport:{width:W,height:H},analysisResolution:{width:w,height:h},
      source:{kind:'video',intrinsicWidth:W,intrinsicHeight:H,durationSeconds:Number.isFinite(video.duration)?video.duration:null,samples:plan.times.length,sampleRateHz:c.sampleRateHz,truncated:plan.truncated,
        sampleOffset:sourceModule.SAMPLE_OFFSET,changedSampleFraction:+changedFraction.toFixed(4),durationNote},
      limitations:[`Frames were sampled by seeking every 1/${c.sampleRateHz} s, offset by ${sourceModule.SAMPLE_OFFSET} of an interval. The source frame rate is not measured. Source frames shorter than the interval can be skipped; choose a rate at or above the source frame rate.`,
        ...(changedFraction>.98&&c.sampleRateHz<120?[`${(changedFraction*100).toFixed(0)}% of samples differ from the previous sample, so the source may have more frames than ${c.sampleRateHz} per second. Rerun at a higher sample rate.`]:[]),
        ...(durationNote?[durationNote]:[]),
        'Decoding uses this browser’s codecs and colour conversion to an sRGB canvas. HDR, wide-gamut and protected media are not validated.',
        'Only the file was analyzed. Player controls, captions, overlays, playback rate and page layout are not included.']};
  }finally{video.removeAttribute('src');video.load();video.remove();URL.revokeObjectURL(url);}
}
async function decodeImage(file,c,token){
  const type=imageType(file);
  if(typeof ImageDecoder!=='function')throw Error('This browser has no ImageDecoder (WebCodecs). Use desktop Chrome or Edge.');
  if(!(await ImageDecoder.isTypeSupported(type)))throw Error(`This browser cannot decode ${type} animations.`);
  const decoder=new ImageDecoder({data:await file.arrayBuffer(),type});
  try{
    await decoder.tracks.ready;await decoder.completed;
    const track=decoder.tracks.selectedTrack,count=Math.min(track.frameCount,MAX_IMAGE_FRAMES);
    const first=(await decoder.decode({frameIndex:0})).image,W=first.displayWidth,H=first.displayHeight;first.close();
    const problem=aspectProblem(c,W,H);if(problem)throw Error(problem);
    const [w,h]=analysisSize(W,H,c.analysisWidth);canvas.width=w;canvas.height=h;
    if(count*w*h*4>MAX_FRAME_BYTES)throw Error('Animation is too large to analyze at this detail. Choose standard detail or a shorter file.');
    const frames=[],durations=[];
    for(let i=0;i<count;i++){
      if(token!==generation)return null;
      const {image}=await decoder.decode({frameIndex:i});
      // Frames are composited by the decoder; transparency is shown over the chosen background.
      ctx.fillStyle=c.background;ctx.fillRect(0,0,w,h);ctx.drawImage(image,0,0,w,h);
      frames.push(new Uint8ClampedArray(ctx.getImageData(0,0,w,h).data));durations.push(image.duration);image.close();
      if(i%10===0)status(`Decoded frame ${i+1} of ${count}…`,50*i/count);
    }
    return {frames,durations,W,H,w,h,repetitionCount:track.repetitionCount,animated:track.animated,frameCount:track.frameCount,truncatedFrames:track.frameCount>count,type};
  }finally{decoder.close();}
}
function runTimeline(d,c,model,withEvidence){
  const seconds=frameSeconds(d.durations,model),plays=playsFor(d.repetitionCount,seconds.reduce((a,b)=>a+b,0),c.maxSeconds);
  const plan=animationSamples(seconds,plays,c.maxSeconds);
  const analyzer=new Analyzer(d.w,d.h,{calibration:c.calibration}),evidence=withEvidence?new Evidence(d.w,d.h):null,shot=shooter(c,d.w,d.h);
  for(const s of plan.samples){const rgba=d.frames[s.frame],frame=analyzer.push(rgba,s.time);evidence?.push(rgba,s.time,frame,historical=>shot(historical?.rgba??rgba));}
  return {analyzer,evidence,plan,plays,seconds};
}
async function analyzeImage(file,c,token){
  const d=await decodeImage(file,c,token);if(!d)return null;
  const result=runTimeline(d,c,c.timingModel,true),other=c.timingModel==='display'?'encoded':'display';
  const differs=frameSeconds(d.durations,'display').some((s,i)=>s!==frameSeconds(d.durations,'encoded')[i]);
  let alternate=null;
  if(differs&&d.frames.length>1){const r=runTimeline(d,c,other,false).analyzer.report();alternate={timingModel:other,status:r.status,peakGeneral:r.peakGeneral,peakRed:r.peakRedHeuristic,sc232Status:r.sc232.status,sc232Peak:r.sc232.peakPairs};}
  const shortFrames=d.durations.filter(x=>!(x>10000)).length;
  return {analyzer:result.analyzer,evidence:result.evidence,ended:result.plan.truncated?`Analysis limit reached (${c.maxSeconds} s)`:`All ${result.plays} play(s) analyzed`,
    viewport:{width:d.W,height:d.H},analysisResolution:{width:d.w,height:d.h},
    source:{kind:d.frames.length>1?'animated-image':'static-image',type:d.type,intrinsicWidth:d.W,intrinsicHeight:d.H,frameCount:d.frameCount,framesAnalyzed:d.frames.length,
      encodedFrameDurationsMs:d.durations.slice(0,500).map(x=>x/1000),repetitionCount:Number.isFinite(d.repetitionCount)?d.repetitionCount:'infinite',playsAnalyzed:result.plays,
      loopSeconds:result.plan.totalSeconds,timingModel:c.timingModel,framesAtOrBelow10ms:shortFrames,background:c.background,truncatedFrames:d.truncatedFrames,alternateTiming:alternate},
    limitations:[`Every decoded frame was analyzed on its timeline (${c.timingModel==='display'?'browser display model: frames that specify 10 ms or less are shown for 100 ms':'encoded frame durations'}), including the loop seam${result.plays>1?'s':''} between plays.`,
      `Transparent pixels were composited over ${c.background}. The page background behind the image can change what flashes.`,
      ...(shortFrames?[`${shortFrames} frame(s) specify 10 ms or less. Browsers differ; the other timing model was also analyzed (alternateTiming).`]:[]),
      ...(d.truncatedFrames?[`Only the first ${d.frames.length} of ${d.frameCount} frames were analyzed.`]:[]),
      'Only the file was analyzed, not the page that shows it.']};
}
function render(){
  $('report').hidden=false;
  $('provenance').textContent=`Report ${report.reportId} · ${report.buildId} · Source: ${report.sourceType} · Result: ${report.status}`;
  const alt=report.sourceFile.alternateTiming;
  $('quality').textContent=[`SC 2.3.1 screening: ${report.outcome}. Peak general pairs ${report.peakGeneral}, experimental red ${report.peakRedHeuristic} per rolling second.`,sc232Summary(report.sc232),areaSummary(report.area),
    ...(alt&&alt.status!==report.status?[`With ${alt.timingModel} timing the SC 2.3.1 result would be ${alt.status} (peak ${alt.peakGeneral}). Review both.`]:[]),
    `${report.frames} samples over ${report.duration.toFixed(2)} s. ${report.endedBecause}.`,...report.observation.reasons].join(' ');
  $('intervals').replaceChildren(...report.windows.map(w=>{const p=document.createElement('p');p.textContent=`${w.start.toFixed(2)}–${w.end.toFixed(2)} s · general ${w.general} · red ${w.red} · ${(w.fraction*100).toFixed(2)}% of sampled pixels flagged`;return p;}));
}
$('setup').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const problem=moduleVersionProblem();if(problem){status(problem);return;}
  const file=$('file').files?.[0];if(!file){status('Choose a file first.');return;}
  let c;try{c=settings();}catch(e){status(e.message);return;}
  const kind=fileKind(file);if(!kind){status('Choose a video or a GIF, APNG, WebP or AVIF image.');return;}
  const token=++generation;busy=true;lock(true);report=null;$('report').hidden=true;status('Reading file…',0);
  try{
    const hash=await sha256(file);
    const r=kind==='video'?await analyzeVideo(file,c,token):await analyzeImage(file,c,token);
    if(!r||token!==generation){status('Analysis canceled. No report was produced.');return;}
    const base=r.analyzer.report();
    report=stampReport({...base,localFile:true,createdAt:new Date().toISOString(),criterion:'WCAG 2.2 SC 2.3.1 (Level A); SC 2.3.2 (Level AAA) strict screening',
      reference:$('reference').value.trim(),interactions:'Local file decoded frame by frame without playback.',requestedSeconds:c.maxSeconds,
      captureSettings:{source:'local-file-decoded',presentation:'decoded-file',sampleRateHz:kind==='video'?c.sampleRateHz:null,timingModel:kind==='video'?null:c.timingModel,analysisWidth:c.analysisWidth,calibration:c.calibration},
      endedBecause:r.ended,viewport:r.viewport,analysisResolution:r.analysisResolution,
      sourceFile:{name:file.name,type:file.type||null,bytes:file.size,sha256:hash,lastModified:new Date(file.lastModified).toISOString(),...r.source},
      limitations:[...base.limitations,...r.limitations],evidence:r.evidence.report(),
      scope:'Decoded frames of one local file. Not a capture of the page that displays it.'});
    r.evidence.releaseHistory();render();status(`Done. ${report.outcome}.`,100);
  }catch(e){if(token===generation)status(`Analysis failed: ${e.message||e.name||'error'}`);}
  finally{if(token===generation){busy=false;lock(false);}}
});
$('cancel').addEventListener('click',()=>{generation++;busy=false;lock(false);status('Analysis canceled. No report was produced.');});
function download(text,type,extension,suffix=''){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=`flash-review-${report.reportId}${suffix}.${extension}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('json').addEventListener('click',()=>{if(report)download(JSON.stringify(report,null,2),'application/json','json');});
$('html-report').addEventListener('click',()=>{if(report)download(reportHtml(report),'text/html','html');});
$('csv').addEventListener('click',()=>{if(report)download(csv(report.evidence,report),'text/csv','csv','-selected-probe');});
$('witness-csv').addEventListener('click',()=>{if(report)download(witnessCsv(report.evidence,report),'text/csv','csv','-detection-witness');});
$('text').addEventListener('click',()=>{if(report)download(reviewText(report),'text/plain','txt');});
if(moduleVersionProblem())status(moduleVersionProblem());
globalThis.flashReviewReady=true;
