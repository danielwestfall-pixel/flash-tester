import assert from 'node:assert/strict';
import {
  imageUrls,
  orderedPairs,
  orderedTriples,
  sequence,
  schedule,
  trajectorySchedule,
  imageAt,
  rasterKind,
  containRect,
  fitRect,
  exportSequencePlan,
  importSequencePlan
} from './dist/image-sequence.mjs';

assert.deepEqual(imageUrls('https://example.com/a.png\n\nhttps://example.com/a.png\nhttp://localhost/b.jpg'),['https://example.com/a.png','http://localhost/b.jpg']);
for(const url of ['javascript:alert(1)','file:///test.png','https://user:pass@example.com/a'])assert.throws(()=>imageUrls(url));
assert.throws(()=>imageUrls(Array.from({length:33},(_,i)=>`https://example.com/${i}`).join('\n')));

// Pairs and Triples
assert.equal(orderedPairs(4).length,12);assert.deepEqual(orderedPairs(2),[[0,1],[1,0]]);assert.throws(()=>orderedPairs(13));
assert.equal(orderedTriples(3).length,6,'3 images produce 6 ordered triples');
assert.equal(orderedTriples(4).length,24,'4 images produce 24 ordered triples');
assert.throws(()=>orderedTriples(2),/requires 3–8/);
assert.throws(()=>orderedTriples(9),/requires 3–8/);

// Sequences
const a=sequence(5,100,1234),b=sequence(5,100,1234);assert.deepEqual(a,b);assert.notDeepEqual(a,sequence(5,100,1235));
for(let i=1;i<a.length;i++)assert.notEqual(a[i],a[i-1],'No consecutive repeats, including shuffle boundaries');
const plan=schedule(4,3,20,1);assert.equal(plan.length,61);assert.equal(plan.at(-1).time,3);
for(let i=0;i<60;i++){assert.equal(imageAt(plan,i/20),plan[i].image);assert.equal(imageAt(plan,i/20+.001),plan[i].image);}
assert.equal(imageAt(plan,3),plan.at(-1).image);assert.throws(()=>schedule(3,3,100,0));

// Trajectory schedule
const traj=trajectorySchedule([0,1,2],{rate:10,totalDuration:1,loop:true});
assert.equal(traj.length,11);
assert.equal(traj[0].image,0);assert.equal(traj[1].image,1);assert.equal(traj[2].image,2);assert.equal(traj[3].image,0);

// Geometry and fit modes
assert.deepEqual(containRect(200,100,100,100),{x:0,y:25,width:100,height:50});
assert.deepEqual(fitRect(200,100,100,100,'cover'),{x:-50,y:0,width:200,height:100});
assert.deepEqual(fitRect(200,100,100,100,'crop'),{x:-50,y:0,width:200,height:100});
const thinRect=containRect(16000,1,64,64);assert.ok(thinRect.width>=1&&thinRect.height>=1,'TEST-10: Extreme aspect ratio clamped to minimum 1px');

// Sequence import / export
const exported=exportSequencePlan([{name:'a.png',width:100,height:100},{name:'b.png',width:100,height:100}],plan);
const imported=importSequencePlan(exported,4);
assert.equal(imported.format,'flash-review-sequence-v1');
assert.equal(imported.plan.length,61);
assert.throws(()=>importSequencePlan(exported,3),/out of range/,'Rejects plan referencing unallocated image indices');
assert.throws(()=>importSequencePlan('not json',4),/Invalid JSON/);

// Raster formats
assert.equal(rasterKind(new Uint8Array([255,216,255,0])),'jpeg');
assert.throws(()=>rasterKind(new TextEncoder().encode('GIF89a')),/static/);
const png=new Uint8Array(20);png.set([137,80,78,71,13,10,26,10]);png.set(new TextEncoder().encode('acTL'),12);assert.throws(()=>rasterKind(png),/Animated PNG/);
const webp=new Uint8Array(20);webp.set(new TextEncoder().encode('RIFF'),0);webp.set(new TextEncoder().encode('WEBPANIM'),8);assert.throws(()=>rasterKind(webp),/Animated WebP/);
const bombPng=new Uint8Array(33);bombPng.set([137,80,78,71,13,10,26,10],0);
const bombView=new DataView(bombPng.buffer);bombView.setUint32(8,13);bombPng.set(new TextEncoder().encode('IHDR'),12);
bombView.setUint32(16,30000);bombView.setUint32(20,30000);
assert.throws(()=>rasterKind(bombPng),/exceed 16 megapixels/);

console.log('Image URL validation, finite pair/triple coverage, reproducible shuffles, schedule boundaries, sizing, fit modes, trajectory export/import and animated-format rejection passed.');
