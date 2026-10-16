import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Analyzer} from './dist/analyzer.mjs';
import {fixtures,fixtureSpec,fixtureInfo,fixtureRect,fixtureState,fixtureFrame} from './dist/fixtures.mjs';

assert.equal(fixtures.length,13);
assert.equal(new Set(fixtures.map(f=>f.id)).size,fixtures.length);
const results=[];
for(const f of fixtures){
  const info=fixtureInfo(f),a=new Analyzer(64,48),r=fixtureRect(f);
  assert.ok(info.deltaY>=0&&info.deltaY<=1);
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=1024&&r.y+r.height<=768);
  // Exact integer sampling: every requested frequency divides the 120 fps clock.
  let transitions=0;
  for(let i=1;i<=120;i++)if(fixtureState(f,i)!==fixtureState(f,i-1))transitions++;
  assert.equal(transitions,2*f.hz,`${f.id}: two transitions per complete flash`);
  for(let i=0;i<=360;i++)a.push(fixtureFrame(f,i,64,48),i/120);
  const report=a.report();
  assert.equal(report.status,info.appExpected,`${f.id}: app screening expectation`);
  const expectedGeneral=f.candidates?f.hz:(f.id==='two-hz'||f.id==='three-hz'?f.hz:0);
  assert.equal(report.peakGeneral,expectedGeneral,`${f.id}: general frequency`);
  assert.equal(report.peakRedHeuristic,info.redExpected,`${f.id}: red frequency`);
  assert.equal(report.evaluation.area,'not-evaluated');
  assert.equal(report.evaluation.conformance,'not-determined');
  if(f.hz>3&&info.deltaY>=.1){
    assert.equal(f.expected,info.maxConcurrentPixelsInReferenceField<=21824?'pass':'fail',`${f.id}: reference-area oracle`);
  }
  // Confirm exact RGB values and source geometry before reduction.
  const frame=fixtureFrame(f,Math.round(120/(f.hz*2||1)),1024,768);
  const rgb=fixtureState(f,Math.round(120/(f.hz*2||1)));
  let lit=0;
  for(let y=0;y<768;y++)for(let x=0;x<1024;x++){
    const k=(y*1024+x)*4,inside=x>=r.x&&x<r.x+r.width&&y>=r.y&&y<r.y+r.height;
    assert.equal(frame[k+3],255);
    if(inside){assert.equal(frame[k],rgb[0]);assert.equal(frame[k+1],rgb[1]);assert.equal(frame[k+2],rgb[2]);lit++;}
    else assert.equal(frame[k]+frame[k+1]+frame[k+2],0);
  }
  assert.equal(lit,r.width*r.height);
  results.push({id:f.id,referenceInput:f.expected,appStatus:report.status,peakGeneral:report.peakGeneral,peakRed:report.peakRedHeuristic,flaggedFraction:report.maxFlaggedFraction});
}
const byId=id=>fixtureInfo(fixtures.find(f=>f.id===id));
assert.ok(byId('requested-grays').deltaY>.25);
assert.ok(byId('soft-gray').deltaY<.1);
assert.equal(byId('small-zone').maxConcurrentPixelsInReferenceField,4096);
assert.ok(byId('small-zone').screenFraction<.01);
assert.ok(byId('area-trap').screenFraction<.25);
assert.ok(byId('area-trap').maxConcurrentPixelsInReferenceField>21824);
// The tiny browser-only analysis must preserve detection at its center sample too.
const tiny=new Analyzer(16,12),small=fixtures.find(f=>f.id==='small-zone');
for(let i=0;i<=360;i++)tiny.push(fixtureFrame(small,i,16,12),i/120);
assert.equal(tiny.report().peakGeneral,10);
if(process.argv.includes('--write')){
  fs.mkdirSync(new URL('./fixtures/',import.meta.url),{recursive:true});
  fs.writeFileSync(new URL('./fixtures/manifest.json',import.meta.url),JSON.stringify({spec:fixtureSpec,fixtures:fixtures.map(fixtureInfo)},null,2)+'\n');
  fs.writeFileSync(new URL('./fixtures/synthetic-results.json',import.meta.url),JSON.stringify({source:'Generated raw RGBA frames; no browser capture',resolution:{width:64,height:48},fps:120,seconds:3,results},null,2)+'\n');
}
console.table(results);
console.log('13 fixture inputs verified: timing, colors, spatial geometry, luminance, reference expectations and current app results.');
