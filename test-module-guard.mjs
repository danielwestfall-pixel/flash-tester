// NF-08 / RT-05 / RT-06 / RT-10: mixed-build protection. Static checks on dist, then
// stale copies of each module are loaded from a temporary directory and every page must
// refuse to run. MOCKED browser APIs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const dist=new URL('./dist/',import.meta.url);
const {BUILD_ID,EXPECTED_ALGORITHM}=await import('./dist/report.mjs');
const version=BUILD_ID.match(/^flash-review-(\d+\.\d+\.\d+)-\d{8}$/)[1];
const modules=fs.readdirSync(dist).filter(f=>f.endsWith('.mjs'));
// 1. Every relative import is versioned, and every module carries the build.
for(const f of modules){
  const s=fs.readFileSync(new URL(f,dist),'utf8');
  for(const m of s.matchAll(/(?:from|import)\s*\(?\s*['"](\.\/[^'"]+)['"]/g))assert.ok(m[1].endsWith(`.mjs?v=${version}`),`${f} imports ${m[1]} without ?v=${version}`);
  assert.ok(s.includes(`export const MODULE_BUILD='${BUILD_ID}';`),`${f} exports MODULE_BUILD ${BUILD_ID}`);
}
for(const f of fs.readdirSync(dist).filter(f=>f.endsWith('.html'))){
  const s=fs.readFileSync(new URL(f,dist),'utf8');
  for(const m of s.matchAll(/<script type="module" src="([^"]+)"/g)){
    assert.ok(m[1].endsWith(`.mjs?v=${version}`),`${f} loads ${m[1]} without ?v=${version}`);
    const page=fs.readFileSync(new URL(m[1].split('?')[0],dist),'utf8');assert.ok(page.includes('globalThis.flashReviewReady=true'),`${m[1]} signals readiness`);
  }
  if(/<script type="module"/.test(s))assert.ok(s.includes("addEventListener('load',()=>{if(globalThis.flashReviewReady)return;"),`${f} has the load watchdog`);
}
// 2. Functional: stale modules are named by the guard.
const tmpRoot=fs.mkdtempSync(path.join(os.tmpdir(),'flash-guard-'));
let n=0;
function staleCopy(edits){
  const dir=path.join(tmpRoot,String(n++));fs.cpSync(dist,dir,{recursive:true});
  for(const [file,from,to] of edits){const p=path.join(dir,file),s=fs.readFileSync(p,'utf8');assert.ok(s.includes(from),`${file} contains ${from}`);fs.writeFileSync(p,s.replace(from,to));}
  return dir;
}
const stale=f=>[f,`export const MODULE_BUILD='${BUILD_ID}';`,"export const MODULE_BUILD='flash-review-0.4.5-20261017';"];
for(const f of ['analyzer.mjs','area.mjs','export-metadata.mjs','evidence.mjs']){
  const dir=staleCopy([stale(f)]),{moduleVersionProblem}=await import(pathToFileURL(path.join(dir,'report.mjs')).href+`?v=${version}`);
  const problem=moduleVersionProblem();assert.ok(problem?.includes(`${f.replace('.mjs','')} flash-review-0.4.5`),`${f}: ${problem}`);
}
{const dir=staleCopy([['analyzer.mjs',`export const ALGORITHM='${EXPECTED_ALGORITHM}';`,"export const ALGORITHM='flash-screen-0.4.2';"]]);
  const {moduleVersionProblem}=await import(pathToFileURL(path.join(dir,'report.mjs')).href+`?v=${version}`);assert.ok(moduleVersionProblem().includes('analyzer algorithm flash-screen-0.4.2'));}
{const {moduleVersionProblem}=await import('./dist/report.mjs');
  assert.equal(moduleVersionProblem(),null,'Current files are consistent');
  assert.ok(moduleVersionProblem({app:'flash-review-0.4.5-20261017'}).includes('app flash-review-0.4.5'),'Entry modules are checked');
  assert.ok(moduleVersionProblem({examples:undefined}).includes('examples unversioned'));}
// 3. Pages refuse to run. A minimal DOM mock per page.
class El{constructor(){this.listeners={};this.children=[];this.dataset={};this.style={};this.value='';this.checked=false;this.hidden=false;this.disabled=false;this.textContent='';this.innerHTML='';this.files=[];}
  addEventListener(t,f){this.listeners[t]=f;}async fire(t){return this.listeners[t]?.({preventDefault(){},key:''});}append(...x){this.children.push(...x);}replaceChildren(...x){this.children=x;}
  setAttribute(k,v){this[k]=v;}focus(){}click(){}getContext(){return {drawImage(){},putImageData(){},fillRect(){},clearRect(){},getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)})};}toDataURL(){return 'data:,';}
  getBoundingClientRect(){return {x:0,y:0,width:100,height:100};}}
function mockPage(htmlFile){
  const html=fs.readFileSync(new URL(htmlFile,dist),'utf8'),els=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],new El()]));
  globalThis.document={getElementById:id=>{if(!els.has(id))els.set(id,new El());return els.get(id);},createElement:()=>new El(),querySelectorAll:()=>[],querySelector:()=>new El(),addEventListener(){},hidden:false,body:new El()};
  globalThis.window={addEventListener(){}};globalThis.addEventListener=()=>{};globalThis.location={href:'http://localhost/'+htmlFile,search:''};globalThis.requestAnimationFrame=()=>1;globalThis.cancelAnimationFrame=()=>{};
  globalThis.ImageData=class{};delete globalThis.flashReviewReady;
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getDisplayMedia:async()=>{throw Error('must not start');}}}});
  const v=els.get('source');if(v){v.requestVideoFrameCallback=()=>1;v.cancelVideoFrameCallback=()=>{};v.pause=()=>{};v.play=async()=>{};}
  return id=>document.getElementById(id);
}
const reload=/Mixed Flash Review files are loaded|Reload required/;
{const dir=staleCopy([stale('examples.mjs')]),$=mockPage('index.html');await import(pathToFileURL(path.join(dir,'app.mjs')).href+`?v=${version}`);
  assert.match($('support').textContent,reload,'Capture page warns on load');await $('setup').fire('submit');assert.equal($('headline').textContent,'Reload required','Capture refuses to start');}
{const dir=staleCopy([['report.mjs','export function moduleVersionProblem(','export function removedModuleVersionProblem(']]),$=mockPage('index.html');
  await import(pathToFileURL(path.join(dir,'app.mjs')).href+`?v=${version}`);await $('setup').fire('submit');
  assert.equal($('headline').textContent,'Reload required','A stale report.mjs is reported instead of leaving a dead page (RT-06)');}
{const dir=staleCopy([stale('image-sequence.mjs')]),$=mockPage('image-sequences.html');await import(pathToFileURL(path.join(dir,'image-sequences-page.mjs')).href+`?v=${version}`);
  $('urls').value='https://example.com/a.png';await $('load').fire('click');assert.match($('load-status').textContent,reload,'Image-sequence page refuses to load');}
{const dir=staleCopy([stale('analyzer.mjs')]),$=mockPage('fixtures.html');await import(pathToFileURL(path.join(dir,'fixtures-page.mjs')).href+`?v=${version}`);
  assert.match($('result').textContent,reload,'Fixtures page warns on load (RT-10)');$('result').textContent='';await $('analyze').fire('click');assert.match($('result').textContent,reload,'Fixtures page refuses to analyze');}
{const dir=staleCopy([stale('file-source.mjs')]),$=mockPage('file-analysis.html');await import(pathToFileURL(path.join(dir,'file-analysis-page.mjs')).href+`?v=${version}`);
  assert.match($('status').textContent,reload,'File analysis page warns on load');}
{const dir=staleCopy([stale('motion-review.mjs')]),$=mockPage('motion-review.html');await import(pathToFileURL(path.join(dir,'motion-review-page.mjs')).href+`?v=${version}`);
  assert.match($('summary').textContent,reload,'Motion review page warns on load');await $('json').fire('click');assert.match($('summary').textContent,reload,'Motion review page refuses to export');}
fs.rmSync(tmpRoot,{recursive:true,force:true});
console.log(`Module guard passed: ${modules.length} versioned modules, watchdogs on every page, stale analyzer/area/export-metadata/evidence/examples/report/image-sequence/file-source/motion-review refused on every page (mock browser APIs).`);
