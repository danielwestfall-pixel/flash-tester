// Video file validation, container inspection and frame screening engine.
import {Analyzer} from './analyzer.mjs';
import {Evidence} from './evidence.mjs';
import {stampReport, BUILD_ID} from './report.mjs';

export function videoUrls(text){
  const urls=(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(urls.length>10)throw Error('Use at most 10 video URLs.');
  return [...new Set(urls.map(s=>{
    let u;
    try{u=new URL(s);}catch{throw Error(`Invalid URL: ${s}`);}
    if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Use HTTP(S) video URLs without embedded credentials.');
    return u.href;
  }))];
}

export function videoFileKind(bytes){
  if(!bytes||bytes.length<12)throw Error('File is too small to be a valid video container.');
  const text=(start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
  
  // MP4 / QuickTime: bytes 4-7 are 'ftyp' or 'moov'
  if(text(4,4)==='ftyp'){
    const brand=text(8,4).trim().toLowerCase();
    return `mp4 (${brand||'isom'})`;
  }
  if(text(4,4)==='moov')return 'quicktime (moov)';

  // WebM / Matroska: EBML header 0x1A 0x45 0xDF 0xA3
  if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3){
    return 'webm';
  }

  // Ogg Video: 'OggS'
  if(text(0,4)==='OggS'){
    return 'ogg';
  }

  throw Error('Unsupported format. Please select an MP4, WebM, or OGG video file.');
}

export function createVideoElement(src,isObjectUrl=false){
  const video=document.createElement('video');
  video.muted=true;
  video.playsInline=true;
  video.preload='auto';
  if(!isObjectUrl){
    video.crossOrigin='anonymous';
  }
  video.src=src;
  return video;
}

export async function loadVideoMetadata(video,timeoutMs=15000){
  if(video.readyState>=1&&Number.isFinite(video.duration)&&video.videoWidth>0){
    return {duration:video.duration,width:video.videoWidth,height:video.videoHeight};
  }
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{
      cleanup();
      reject(new Error('Video metadata loading timed out. Ensure the URL supports CORS and is a valid video.'));
    },timeoutMs);

    const onLoaded=()=>{
      cleanup();
      if(!Number.isFinite(video.duration)||video.duration<=0){
        reject(new Error('Video has invalid or indeterminate duration (live streams are not supported for file screening).'));
        return;
      }
      if(video.videoWidth<=0||video.videoHeight<=0){
        reject(new Error('Video has invalid dimensions.'));
        return;
      }
      if(video.videoWidth*video.videoHeight>16000000){
        reject(new Error('Video resolution exceeds 16 megapixels limit.'));
        return;
      }
      resolve({duration:video.duration,width:video.videoWidth,height:video.videoHeight});
    };

    const onError=()=>{
      cleanup();
      const err=video.error;
      reject(new Error(`Failed to load video (${err?err.message||`code ${err.code}`:'network or format error'}).`));
    };

    const cleanup=()=>{
      clearTimeout(timer);
      video.removeEventListener('loadedmetadata',onLoaded);
      video.removeEventListener('error',onError);
    };

    video.addEventListener('loadedmetadata',onLoaded,{once:true});
    video.addEventListener('error',onError,{once:true});
  });
}

export async function scanVideo(video,options={}){
  const {
    analysisWidth=320,
    analysisHeight=180,
    maxDuration=Math.min(video.duration||60,60),
    stepFps=30,
    calibration=null,
    probeX=0,
    probeY=0,
    signal=null,
    onProgress=null,
    keepScreenshots=true
  }=options;

  if(!Number.isInteger(analysisWidth)||!Number.isInteger(analysisHeight)||analysisWidth<1||analysisHeight<1){
    throw Error('Invalid analysis dimensions');
  }

  const canvas=document.createElement('canvas');
  canvas.width=analysisWidth;
  canvas.height=analysisHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true,colorSpace:'srgb'});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='medium';

  const analyzer=new Analyzer(analysisWidth,analysisHeight,{calibration});
  const evidence=new Evidence(analysisWidth,analysisHeight,probeX,probeY);

  const duration=Math.min(video.duration||maxDuration,maxDuration);
  const stepTime=1/stepFps;

  let stopped=false;
  const abortHandler=()=>{
    stopped=true;
  };
  if(signal){
    if(signal.aborted)throw new Error('Video screening was cancelled.');
    signal.addEventListener('abort',abortHandler,{once:true});
  }

  try{
    // Use requestVideoFrameCallback if available and video can play, else step currentTime
    const hasRvfc=typeof video.requestVideoFrameCallback==='function';
    
    if(hasRvfc&&!options.forceSeeking){
      let frameStart=null,lastMedia=null;
      video.currentTime=0;
      await video.play().catch(()=>{});

      await new Promise((resolve,reject)=>{
        let callbackId=null;
        const cleanup=()=>{
          if(callbackId&&video.cancelVideoFrameCallback)video.cancelVideoFrameCallback(callbackId);
          video.pause();
        };

        const onFrame=(now,info)=>{
          if(stopped||(signal&&signal.aborted)){
            cleanup();
            resolve();
            return;
          }

          if(frameStart===null)frameStart=info.mediaTime;
          const mediaT=info.mediaTime-frameStart;

          if(lastMedia!==null&&info.mediaTime<=lastMedia){
            callbackId=video.requestVideoFrameCallback(onFrame);
            return;
          }
          lastMedia=info.mediaTime;

          ctx.drawImage(video,0,0,analysisWidth,analysisHeight);
          const rgba=ctx.getImageData(0,0,analysisWidth,analysisHeight).data;
          const res=analyzer.push(rgba,mediaT);

          evidence.push(rgba,mediaT,res,historical=>{
            if(!keepScreenshots)return null;
            const shot=document.createElement('canvas');
            shot.width=analysisWidth;shot.height=analysisHeight;
            const shotCtx=shot.getContext('2d');
            if(historical){
              shotCtx.putImageData(new ImageData(historical.rgba,analysisWidth,analysisHeight),0,0);
              return shot.toDataURL('image/png');
            }
            shotCtx.drawImage(video,0,0,analysisWidth,analysisHeight);
            return shot.toDataURL('image/jpeg',0.85);
          });

          if(onProgress){
            onProgress({
              time:mediaT,
              duration,
              percent:Math.min(100,(mediaT/duration)*100),
              frames:analyzer.frames,
              general:res.general,
              red:res.red,
              peakGeneral:analyzer.peakGeneral,
              peakRed:analyzer.peakRed
            });
          }

          if(mediaT>=duration||video.ended){
            cleanup();
            resolve();
            return;
          }

          callbackId=video.requestVideoFrameCallback(onFrame);
        };

        video.addEventListener('ended',()=>resolve(),{once:true});
        video.addEventListener('error',()=>reject(new Error('Error during video playback')),{once:true});
        callbackId=video.requestVideoFrameCallback(onFrame);
      });
    }else{
      // Deterministic seeking step
      let t=0;
      while(t<=duration&&!stopped){
        if(signal&&signal.aborted)break;

        await new Promise(r=>{
          const onSeek=()=>{video.removeEventListener('seeked',onSeek);r();};
          video.addEventListener('seeked',onSeek,{once:true});
          video.currentTime=t;
          setTimeout(r,50);
        });

        if(stopped)break;

        ctx.drawImage(video,0,0,analysisWidth,analysisHeight);
        const rgba=ctx.getImageData(0,0,analysisWidth,analysisHeight).data;
        const res=analyzer.push(rgba,t);

        evidence.push(rgba,t,res,historical=>{
          if(!keepScreenshots)return null;
          const shot=document.createElement('canvas');
          shot.width=analysisWidth;shot.height=analysisHeight;
          const shotCtx=shot.getContext('2d');
          if(historical){
            shotCtx.putImageData(new ImageData(historical.rgba,analysisWidth,analysisHeight),0,0);
            return shot.toDataURL('image/png');
          }
          shotCtx.drawImage(video,0,0,analysisWidth,analysisHeight);
          return shot.toDataURL('image/jpeg',0.85);
        });

        if(onProgress){
          onProgress({
            time:t,
            duration,
            percent:Math.min(100,(t/duration)*100),
            frames:analyzer.frames,
            general:res.general,
            red:res.red,
            peakGeneral:analyzer.peakGeneral,
            peakRed:analyzer.peakRed
          });
        }

        t+=stepTime;
      }
    }
  }finally{
    if(signal)signal.removeEventListener('abort',abortHandler);
    video.pause();
  }

  const rawReport=analyzer.report();
  const report=stampReport({
    ...rawReport,
    createdAt:new Date().toISOString(),
    criterion:'WCAG 2.2 SC 2.3.1 (Level A) & SC 2.3.2 (Level AAA)',
    synthetic:false,
    sourceType:'video-file-screening',
    videoMetadata:{
      duration:video.duration,
      width:video.videoWidth,
      height:video.videoHeight,
      sampledDuration:Math.min(video.duration||duration,duration),
      sampledFrames:analyzer.frames,
      analysisResolution:{width:analysisWidth,height:analysisHeight}
    },
    captureSettings:{
      source:'Decoded video file / stream without interactive playback',
      stepFps,
      calibration
    },
    viewport:{width:video.videoWidth,height:video.videoHeight},
    analysisResolution:{width:analysisWidth,height:analysisHeight},
    evidence:evidence.report(),
    endedBecause:stopped?'Cancelled by user or limit':'Video stream screening complete',
    limitations:[
      'Video file screening decodes frames in sRGB; Display P3 wide-gamuts and HDR10/Dolby Vision peak luminance are not calibrated (RED-03).',
      'Spatial downsampling averages fine-pitch counter-phase checkerboards and stipple patterns (RED-04, RED-05).',
      'Frame rate stepping can miss transient sub-frame flashes operating above the sampling frequency (RED-10).',
      'Screening does not evaluate physical viewing distance, user display size or ambient light.'
    ]
  });

  return {report,evidence:evidence.report()};
}
