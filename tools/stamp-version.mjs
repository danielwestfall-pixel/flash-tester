// Stamp one build version into every dist module and page.
// usage: node tools/stamp-version.mjs 0.5.0 20261017
// - every relative module import and page script uses ?v=<version>, so browsers
//   cannot combine cached files from different builds;
// - every module exports MODULE_BUILD, checked at runtime by report.mjs.
import fs from 'node:fs';
const [version,date]=process.argv.slice(2);
if(!/^\d+\.\d+\.\d+$/.test(version??'')||!/^\d{8}$/.test(date??''))throw Error('usage: node tools/stamp-version.mjs X.Y.Z YYYYMMDD');
const build=`flash-review-${version}-${date}`,dir=new URL('../dist/',import.meta.url);
for(const f of fs.readdirSync(dir)){
  const p=new URL(f,dir);if(!/\.(mjs|html)$/.test(f))continue;
  let s=fs.readFileSync(p,'utf8');const before=s;
  s=s.replace(/((?:from|import)\s*\(?\s*['"]\.\/[\w-]+\.mjs)(?:\?v=[\w.]+)?(['"])/g,`$1?v=${version}$2`);
  s=s.replace(/(<script type="module" src="[\w-]+\.mjs)(?:\?v=[\w.]+)?(")/g,`$1?v=${version}$2`);
  if(f.endsWith('.mjs')){
    if(/export const MODULE_BUILD='[^']*';/.test(s))s=s.replace(/export const MODULE_BUILD='[^']*';/,`export const MODULE_BUILD='${build}';`);
    else s=s.replace(/^((?:import[^\n]*\n)*)/,`$1export const MODULE_BUILD='${build}';\n`);
  }
  if(f==='report.mjs')s=s.replace(/export const BUILD_ID='[^']*';/,`export const BUILD_ID='${build}';`);
  if(s!==before){fs.writeFileSync(p,s);console.log('stamped',f);}
}
