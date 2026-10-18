// SC 2.3.3 motion review records: completeness checks, summary, CSV/text exports.
// Manual-review support only; no automated motion detection is claimed.
import assert from 'node:assert/strict';
import * as motion from './dist/motion-review.mjs';
const ids={reportId:'r-1',buildId:'flash-review-test',createdAt:'2026-10-17T00:00:00Z'};
const empty=motion.reviewRecord({reference:'',environment:''},[],ids);
assert.equal(empty.summary.status,'no-interactions-recorded');assert.equal(empty.summary.conformance,'not-determined');
assert.ok(motion.reviewCsv(empty).includes('No interactions recorded.'),'Empty review still exports a row');
const items=[
  {...motion.emptyItem(),interaction:'Scroll the hero section',trigger:'scroll',motion:'Parallax background',mechanism:'prefers-reduced-motion',outcome:'motion-disabled'},
  {...motion.emptyItem(),interaction:'Open the menu',trigger:'click-or-tap',motion:'Menu slides in',mechanism:'both',outcome:'not-disabled'},
  {...motion.emptyItem(),interaction:'Drag the map',trigger:'drag',motion:'Map pans',mechanism:'none-found',outcome:'essential'},
  {...motion.emptyItem(),interaction:'Hover a card',trigger:'hover-or-focus',motion:'',mechanism:'not-tested',outcome:'not-tested'},
  {...motion.emptyItem(),interaction:'',trigger:'other',motion:'Spinner',mechanism:'none-found',outcome:'motion-disabled'},
];
assert.deepEqual(motion.itemProblems(items[0]),[]);
assert.deepEqual(motion.itemProblems(items[2]),['An essential claim needs a written rationale.']);
assert.deepEqual(motion.itemProblems(items[4]),['Describe the interaction.','"Motion is disabled" contradicts "no mechanism found".']);
const rec=motion.reviewRecord({reference:'=HYPERLINK("x")',environment:'Chrome 155'},items,ids),s=rec.summary;
assert.deepEqual([s.total,s.open,s.needsAttention,s.essentialClaims,s.incomplete.map(x=>x.n)],[5,1,1,1,[3,5]]);
assert.equal(s.status,'review-incomplete');
const done=motion.reviewRecord({reference:'p',environment:'e'},[items[0],{...items[2],rationale:'Panning is the function'}],ids);
assert.equal(done.summary.status,'review-recorded');assert.equal(done.summary.conformance,'not-determined');
// Incomplete records keep the review incomplete even when nothing is untested.
assert.equal(motion.reviewRecord({reference:'p',environment:'e'},[items[0],items[2]],ids).summary.status,'review-incomplete');
const attention=motion.reviewRecord({reference:'p',environment:'e'},[items[0],items[1]],ids);assert.equal(attention.summary.status,'motion-not-disabled-recorded');
const csv=motion.reviewCsv(rec),lines=csv.split('\n');
assert.equal(lines.length,6);assert.ok(lines[1].includes("\"'=HYPERLINK(\"\"x\"\")\""),'Formula-like cells are neutralized and quoted');
assert.ok(motion.reviewText(rec).includes('Conformance status: Not determined')&&motion.reviewText(rec).includes('RECORD INCOMPLETE: An essential claim needs a written rationale.'));
console.log('SC 2.3.3 motion review records passed: completeness checks, summary states, CSV escaping and text notes (no automated motion detection).');
