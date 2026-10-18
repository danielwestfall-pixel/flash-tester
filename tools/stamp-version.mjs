// Stamp one build into every dist module and page.
// usage: node tools/stamp-version.mjs 0.5.1 20261018
// - every relative module import, page script and stylesheet uses ?v=<version>-<date>,
//   so browsers cannot combine cached files from different builds;
// - every module exports MODULE_BUILD and registers it in globalThis.flashReviewModules;
// - every page module exports PAGE_MODULES: its full import closure, which the page's
//   module guard checks against the registry (a page cannot forget a module);
// - every HTML page carries <meta name="flash-review-build">, checked by the guard.
import fs from 'node:fs';
const [version,date]=process.argv.slice(2);
if(!/^\d+\.\d+\.\d+$/.test(version??'')||!/^\d{8}$/.test(date??''))throw Error('usage: node tools/stamp-version.mjs X.Y.Z YYYYMMDD');
const build=`flash-review-${version}-${date}`,key=`${version}-${date}`,dir=new URL('../dist/',import.meta.url);
const read=f=>fs.readFileSync(new URL(f,dir),'utf8');
const files=fs.readdirSync(dir).filter(f=>/\.(mjs|html)$/.test(f));
const importsOf=s=>[...s.matchAll(/(?:from|import)\s*\(?\s*['"]\.\/([\w-]+)\.mjs(?:\?v=[\w.-]+)?['"]/g)].map(m=>m[1]);
function closure(name,seen=new Set()){if(seen.has(name))return seen;seen.add(name);for(const d of importsOf(read(`${name}.mjs`)))closure(d,seen);return seen;}
const pages=files.filter(f=>f.endsWith('.html')).flatMap(f=>[...read(f).matchAll(/<script type="module" src="([\w-]+)\.mjs/g)].map(m=>m[1]));
for(const f of files){
  let s=read(f);const before=s,name=f.replace(/\.mjs$/,'');
  s=s.replace(/((?:from|import)\s*\(?\s*['"]\.\/[\w-]+\.mjs)(?:\?v=[\w.-]+)?(['"])/g,`$1?v=${key}$2`);
  s=s.replace(/(<script type="module" src="[\w-]+\.mjs)(?:\?v=[\w.-]+)?(")/g,`$1?v=${key}$2`);
  s=s.replace(/(<link rel="stylesheet" href="[\w-]+\.css)(?:\?v=[\w.-]+)?(")/g,`$1?v=${key}$2`);
  if(f.endsWith('.html')){
    if(/<meta name="flash-review-build" content="[^"]*">/.test(s))s=s.replace(/<meta name="flash-review-build" content="[^"]*">/,`<meta name="flash-review-build" content="${build}">`);
    else s=s.replace(/(<meta charset="utf-8">)/,`$1<meta name="flash-review-build" content="${build}">`);
  } else {
    const stamp=`export const MODULE_BUILD='${build}';\n(globalThis.flashReviewModules??={})['${name}']=MODULE_BUILD;`;
    if(/export const MODULE_BUILD='[^']*';(\n\(globalThis\.flashReviewModules\?\?=\{\}\)\['[\w-]+'\]=MODULE_BUILD;)?/.test(s))s=s.replace(/export const MODULE_BUILD='[^']*';(\n\(globalThis\.flashReviewModules\?\?=\{\}\)\['[\w-]+'\]=MODULE_BUILD;)?/,stamp);
    else s=s.replace(/^((?:import[^\n]*\n)*)/,`$1${stamp}\n`);
    if(pages.includes(name)){
      const list=`export const PAGE_MODULES=${JSON.stringify([...closure(name)].sort())};`;
      s=/export const PAGE_MODULES=\[[^\]]*\];/.test(s)?s.replace(/export const PAGE_MODULES=\[[^\]]*\];/,list):s.replace(stamp,`${stamp}\n${list}`);
    }
  }
  if(f==='report.mjs')s=s.replace(/export const BUILD_ID='[^']*';/,`export const BUILD_ID='${build}';`);
  if(s!==before){fs.writeFileSync(new URL(f,dir),s);console.log('stamped',f);}
}
