// Native (headless Chrome) verification of file-analysis.html against fixture manifests.
// Nothing is displayed: headless, and the page never plays or shows the file.
// usage: node tools/verify-file-analysis.mjs BASE_URL OUT_DIR [filter]
// Requires a local server for the repository root, e.g.
//   python3 -m http.server 8791 --bind 127.0.0.1
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [base,outDir,filter]=process.argv.slice(2);
if(!base||!outDir)throw Error('usage: node tools/verify-file-analysis.mjs BASE_URL OUT_DIR [filter]');
const repo=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const CHROME=process.env.CHROME??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
fs.mkdirSync(outDir,{recursive:true});
const profile=fs.mkdtempSync(path.join(outDir,'profile-')),port=9350+Math.floor(Math.random()*40);
const proc=spawn(CHROME,[`--user-data-dir=${profile}`,`--remote-debugging-port=${port}`,'--headless=new','--no-first-run','about:blank'],{stdio:'ignore'});
let ver;for(let i=0;i<100&&!ver;i++){try{ver=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();}catch{await sleep(100);}}
const ws=new WebSocket(ver.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
let id=0;const pending=new Map(),events=[];
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {res,rej}=pending.get(m.id);pending.delete(m.id);m.error?rej(Error(JSON.stringify(m.error))):res(m.result);}else events.push(m);};
const send=(method,params={},sessionId)=>new Promise((res,rej)=>{const i=++id;pending.set(i,{res,rej});ws.send(JSON.stringify({id:i,method,params,...(sessionId?{sessionId}:{})}));});
const downloads=path.join(outDir,'downloads');fs.mkdirSync(downloads,{recursive:true});
await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});
const {targetId}=await send('Target.createTarget',{url:'about:blank',newWindow:true});
const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
const s=(m,p)=>send(m,p,sessionId);
await s('Page.enable');await s('Runtime.enable');await s('DOM.enable');
const evaluate=async(expression,gesture=false)=>{const r=await s('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:gesture});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails).slice(0,400));return r.result.value;};
await s('Page.navigate',{url:`${base}/dist/file-analysis.html`});await sleep(1500);
const cases=[];
const video=JSON.parse(fs.readFileSync(path.join(repo,'fixtures/video/manifest.json'),'utf8')).files;
for(const f of video)cases.push({file:`fixtures/video/${f.file}`,kind:'video',expected:f.expectedMaxFlashesPerSecond,options:{rate:'60'}});
const animated=JSON.parse(fs.readFileSync(path.join(repo,'fixtures/animated/manifest.json'),'utf8')).files;
for(const f of animated){
  cases.push({file:`fixtures/animated/${f.file}`,kind:'image',expected:f.expectedFlashes.display,expectedAlternate:f.expectedFlashes.encoded!==f.expectedFlashes.display?f.expectedFlashes.encoded:null,options:{timing:'display',background:'#ffffff'}});
  if(f.id==='transparent-4hz')cases.push({file:`fixtures/animated/${f.file}`,kind:'image',label:'over black',expected:f.expectedFlashes.displayOverBlack,options:{timing:'display',background:'#000000'}});
}
const results=[];
for(const c of cases.filter(c=>!filter||c.file.includes(filter))){
  const before=new Set(fs.readdirSync(downloads));
  const {root}=await s('DOM.getDocument');const {nodeId}=await s('DOM.querySelector',{nodeId:root.nodeId,selector:'#file'});
  await s('DOM.setFileInputFiles',{files:[path.join(repo,c.file)],nodeId});
  await evaluate(`(()=>{const $=id=>document.getElementById(id);${Object.entries(c.options).map(([k,v])=>`$('${k}').value=${JSON.stringify(v)};`).join('')}$('area-enabled').checked=false;$('max-seconds').value='30';return true;})()`);
  // Clear the previous result first, so a stale "Done" cannot satisfy the wait below.
  await evaluate(`document.getElementById('status').textContent='';true`);
  await evaluate(`document.getElementById('analyze').click()`,true);
  let state='';for(let i=0;i<600;i++){await sleep(200);state=await evaluate(`document.getElementById('status').textContent`);if(/^Done|^Analysis failed/.test(state))break;}
  let report=null;
  if(/^Done/.test(state)){await evaluate(`document.getElementById('json').click()`,true);
    for(let i=0;i<50&&!report;i++){await sleep(200);const f=fs.readdirSync(downloads).find(x=>!before.has(x)&&x.endsWith('.json'));if(f)try{report=JSON.parse(fs.readFileSync(path.join(downloads,f),'utf8'));}catch{}}}
  const expectedStatus=c.expected>3?'candidates-detected':null;
  const r={file:c.file,label:c.label??null,kind:c.kind,state:state.slice(0,160),expected:c.expected,peakGeneral:report?.peakGeneral??null,peakRed:report?.peakRedHeuristic??null,
    status:report?.status??null,sc232:report?.sc232?.status??null,sc232Peak:report?.sc232?.peakPairs??null,frames:report?.frames??null,fps:report?.observedFps??null,
    alternate:report?.sourceFile?.alternateTiming??null,expectedAlternate:c.expectedAlternate??null,sourceType:report?.sourceType??null,buildId:report?.buildId??null};
  r.countMatch=r.peakGeneral===c.expected;
  r.flagMatch=report?(c.expected>3)===(report.status==='candidates-detected'):false;
  r.alternateMatch=c.expectedAlternate==null||r.alternate?.peakGeneral===c.expectedAlternate;
  r.ok=r.countMatch&&r.flagMatch&&r.alternateMatch;
  results.push(r);console.log(`${r.ok?'ok  ':'FAIL'} ${c.file}${c.label?' ('+c.label+')':''}: general ${r.peakGeneral} (expected ${c.expected}) red ${r.peakRed} status ${r.status} sc232 ${r.sc232}${r.alternate?` alt ${r.alternate.timingModel} ${r.alternate.peakGeneral}`:''}${/failed/.test(state)?' '+state:''}`);
}
fs.writeFileSync(path.join(outDir,'file-analysis-results.json'),JSON.stringify({browser:ver.Browser,results},null,1));
const failed=results.filter(r=>!r.ok);
console.log(`${results.length-failed.length}/${results.length} file-analysis cases match their fixture definitions (${ver.Browser}, headless).`);
ws.close();proc.kill();fs.rmSync(profile,{recursive:true,force:true});
process.exit(failed.length?1:0);
