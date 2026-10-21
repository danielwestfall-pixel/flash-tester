// Scheduling, finite combinations, fit geometry and sequence serialization.
export function imageUrls(text){
  const urls=(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  if(urls.length>32)throw Error('Use at most 32 image URLs.');
  return [...new Set(urls.map(s=>{const u=new URL(s);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)throw Error('Use HTTP(S) image URLs without embedded credentials.');return u.href;}))];
}

export function orderedPairs(count){
  if(!Number.isInteger(count)||count<2||count>12)throw Error('Pair screening requires 2–12 loaded images.');
  const pairs=[];for(let a=0;a<count;a++)for(let b=0;b<count;b++)if(a!==b)pairs.push([a,b]);return pairs;
}

export function orderedTriples(count){
  if(!Number.isInteger(count)||count<3||count>8)throw Error('Triple screening requires 3–8 loaded images.');
  const triples=[];
  for(let a=0;a<count;a++){
    for(let b=0;b<count;b++){
      if(b===a)continue;
      for(let c=0;c<count;c++){
        if(c===b||c===a)continue;
        triples.push([a,b,c]);
      }
    }
  }
  return triples;
}

export function sequence(count,length,seed=1){
  if(!Number.isInteger(count)||count<2||!Number.isInteger(length)||length<1||length>10000)throw Error('Invalid sequence size.');
  let state=Number(seed)>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296;};
  const out=[];
  while(out.length<length){const bag=Array.from({length:count},(_,i)=>i);
    for(let i=bag.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}
    if(out.length&&bag[0]===out.at(-1))[bag[0],bag[1]]=[bag[1],bag[0]];
    out.push(...bag.slice(0,length-out.length));
  }return out;
}

export function schedule(count,seconds,changesPerSecond,seed){
  if(!Number.isFinite(seconds)||seconds<1||seconds>10||!Number.isFinite(changesPerSecond)||changesPerSecond<=0||changesPerSecond>30)throw Error('Invalid duration or transition rate.');
  return sequence(count,Math.ceil(seconds*changesPerSecond)+1,seed).map((image,i)=>({image,time:i/changesPerSecond}));
}

export function imageAt(plan,time){
  let i=Math.min(plan.length-1,Math.max(0,Math.floor(time/(plan[1].time-plan[0].time)+1e-9)));
  return plan[i].image;
}

export function trajectorySchedule(steps,options={}){
  const {rate=10,totalDuration=3,loop=true}=options;
  if(!Array.isArray(steps)||steps.length<2)throw Error('Trajectory requires at least two image steps.');
  const stepTime=1/rate;
  const count=Math.ceil(totalDuration*rate)+1;
  const plan=[];
  for(let i=0;i<count;i++){
    const idx=loop?(i%steps.length):Math.min(i,steps.length-1);
    plan.push({image:steps[idx],time:i*stepTime});
  }
  return plan;
}

export function rasterKind(bytes){
  const text=(start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
  if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let p=2;p+8<=bytes.length;){
      if(bytes[p]!==0xff){p++;continue;}
      const m=bytes[p+1];
      if([0xc0,0xc1,0xc2,0xc3].includes(m)&&p+8<=bytes.length){
        const h=view.getUint16(p+5),w=view.getUint16(p+7);
        if(w*h>16000000||w>16384||h>16384)throw Error('Image dimensions exceed 16 megapixels.');
        break;
      }
      if(p+3>=bytes.length)break;
      const len=view.getUint16(p+2);
      if(len<2||p+2+len>bytes.length)break;
      p+=2+len;
    }
    return 'jpeg';
  }
  if(bytes[0]===137&&text(1,3)==='PNG'){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let p=8;p+12<=bytes.length;){
      const n=view.getUint32(p),k=text(p+4,4);
      if(k==='IHDR'&&p+20<=bytes.length){
        const w=view.getUint32(p+8),h=view.getUint32(p+12);
        if(w*h>16000000||w>16384||h>16384)throw Error('Image dimensions exceed 16 megapixels.');
      }
      if(k==='acTL')throw Error('Animated PNG is not supported yet.');
      if(n>bytes.length-p-12)throw Error('Invalid PNG chunk.');
      p+=12+n;
    }
    return 'png';
  }
  if(text(0,4)==='RIFF'&&text(8,4)==='WEBP'){
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
    for(let p=12;p+8<=bytes.length;){
      const n=view.getUint32(p+4,true),kind=text(p,4);
      if(['ANIM','ANMF'].includes(kind))throw Error('Animated WebP is not supported yet.');
      if(kind==='VP8X'&&p+18<=bytes.length){
        const w=1+(view.getUint32(p+8,true)&0xffffff),h=1+((view.getUint32(p+11,true)>>8)&0xffffff);
        if(w*h>16000000||w>16384||h>16384)throw Error('Image dimensions exceed 16 megapixels.');
      }
      if(n>bytes.length-p-8)throw Error('Invalid WebP chunk.');
      p+=8+n+(n%2);
    }
    return 'webp';
  }
  throw Error('Use static PNG, JPEG or WebP images. GIF, SVG and other formats are not supported.');
}

export function fitRect(sourceWidth,sourceHeight,targetWidth,targetHeight,mode='contain'){
  let scale;
  if(mode==='cover'){
    scale=Math.max(targetWidth/sourceWidth,targetHeight/sourceHeight);
  }else if(mode==='crop'){
    scale=1;
  }else{
    // Default contain
    scale=Math.min(targetWidth/sourceWidth,targetHeight/sourceHeight);
  }
  const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
  return {x:(targetWidth-width)/2,y:(targetHeight-height)/2,width,height};
}

export function containRect(sourceWidth,sourceHeight,targetWidth,targetHeight){
  return fitRect(sourceWidth,sourceHeight,targetWidth,targetHeight,'contain');
}

export function exportSequencePlan(images,plan,settings={}){
  return JSON.stringify({
    format:'flash-review-sequence-v1',
    createdAt:new Date().toISOString(),
    images:images.map(i=>({name:i.name,width:i.bitmap?.width??i.width,height:i.bitmap?.height??i.height})),
    settings,
    plan
  },null,2);
}

export function importSequencePlan(jsonString,imageCount){
  let data;
  try{data=JSON.parse(jsonString);}catch{throw Error('Invalid JSON format.');}
  if(!data||typeof data!=='object'||!Array.isArray(data.plan)){
    throw Error('Invalid sequence plan: missing plan array.');
  }
  for(const step of data.plan){
    if(typeof step!=='object'||!Number.isInteger(step.image)||step.image<0||step.image>=imageCount||!Number.isFinite(step.time)||step.time<0){
      throw Error(`Invalid step in plan: image index ${step.image} out of range (loaded: ${imageCount}) or invalid time.`);
    }
  }
  return data;
}
