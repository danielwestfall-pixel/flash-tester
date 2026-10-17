// Deterministic sampling plans for local files decoded without playback.
// Video: seek on a regular grid. Animated images: every decoded frame, on its timeline.
export const MODULE_BUILD='flash-review-0.5.0-20261017';
export const VIDEO_TYPES=/^video\//;
export const IMAGE_TYPES=['image/gif','image/png','image/apng','image/webp','image/avif'];
export function fileKind(file){
  const type=(file?.type||'').toLowerCase(),name=(file?.name||'').toLowerCase();
  if(VIDEO_TYPES.test(type)||/\.(mp4|m4v|webm|mov|ogv|mkv)$/.test(name))return 'video';
  if(IMAGE_TYPES.includes(type)||/\.(gif|png|apng|webp|avif)$/.test(name))return 'image';
  return null;
}
export function imageType(file){
  const type=(file?.type||'').toLowerCase();if(IMAGE_TYPES.includes(type))return type==='image/apng'?'image/png':type;
  const ext=(file?.name||'').toLowerCase().split('.').pop();return {gif:'image/gif',png:'image/png',apng:'image/png',webp:'image/webp',avif:'image/avif'}[ext]??null;
}
// Sample times for seeking: k/rate + half a period, so each frame of a source at
// `rate` fps is sampled once, mid-frame, never on an ambiguous frame boundary.
export function videoSampleTimes(duration,rate,maxSeconds){
  if(!Number.isFinite(rate)||rate<=0)throw Error('Invalid sample rate');
  const end=Math.min(Number.isFinite(duration)?duration:maxSeconds,maxSeconds),out=[];
  for(let k=0;;k++){const t=(k+.5)/rate;if(t>=end)break;out.push(t);}
  return {times:out,truncated:Number.isFinite(duration)&&duration>maxSeconds,end};
}
// Browsers (Blink, Gecko) display animation frames that specify <= 10 ms for 100 ms.
// WebCodecs ImageDecoder reports the encoded value, so the display model is applied here.
export function frameSeconds(durationsMicroseconds,model){
  return durationsMicroseconds.map(d=>model==='encoded'?Math.max(d??0,1000)/1e6:(!(d>10000)?.1:d/1e6));
}
export function playsFor(repetitionCount,totalSeconds,maxSeconds){
  // repetitionCount counts repeats after the first play; Infinity loops forever.
  if(Number.isFinite(repetitionCount)&&repetitionCount>=0)return Math.max(1,Math.floor(repetitionCount)+1);
  return Math.max(2,Math.ceil(maxSeconds/totalSeconds));
}
// Every frame at its start time, plus hold samples every `step` s (keeps observed
// sampling dense without skipping any decoded frame), and a final sample at the end.
export function animationSamples(seconds,plays,maxSeconds,step=1/60){
  const total=seconds.reduce((a,b)=>a+b,0);if(!(total>0))throw Error('Animation has no duration');
  const samples=[];let t=0,truncated=false;
  outer:for(let p=0;p<plays;p++)for(let i=0;i<seconds.length;i++){
    if(t>=maxSeconds-1e-9){truncated=true;break outer;}
    for(let s=0;s<seconds[i]-1e-9&&t+s<maxSeconds;s+=step)samples.push({frame:i,play:p,time:+(t+s).toFixed(9)});
    t+=seconds[i];
  }
  if(!truncated)samples.push({frame:seconds.length-1,play:plays-1,time:+t.toFixed(9),final:true});
  return {samples,truncated,end:Math.min(t,maxSeconds),totalSeconds:total};
}
