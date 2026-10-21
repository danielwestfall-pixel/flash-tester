import assert from 'node:assert/strict';
import fs from 'node:fs';

class Element {
  constructor() {
    this.listeners = {};
    this.children = [];
    this.value = '';
    this.files = [];
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.style = {};
    this.textContent = '';
  }
  addEventListener(n, fn) { this.listeners[n] = fn; }
  removeEventListener(n, fn) { delete this.listeners[n]; }
  fire(n, e = {}) { return this.listeners[n]?.(e); }
  append(n) { this.children.push(n); }
  replaceChildren() { this.children = []; }
  focus() {}
  click() {}
  play() { return Promise.resolve(); }
  pause() {}
  removeAttribute() {}
}

const html = fs.readFileSync(new URL('./dist/video.html', import.meta.url), 'utf8');
const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
const $ = id => elements.get(id);

const docEvents = {}, winEvents = {};
globalThis.document = {
  hidden: false,
  getElementById: $,
  createElement: tag => {
    if (tag === 'canvas') {
      let canvasW = 320, canvasH = 180;
      return {
        set width(w) { canvasW = w; },
        get width() { return canvasW; },
        set height(h) { canvasH = h; },
        get height() { return canvasH; },
        getContext: () => ({
          drawImage() {},
          putImageData() {},
          getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) })
        }),
        toDataURL: () => 'data:image/png;base64,TEST'
      };
    }
    if (tag === 'video') {
      const v = {
        duration: 2.0, videoWidth: 640, videoHeight: 360, readyState: 2,
        _currentTime: 0,
        listeners: {},
        addEventListener(event, fn) {
          this.listeners[event] = fn;
          if (event === 'loadedmetadata') queueMicrotask(fn);
        },
        removeEventListener(event, fn) { delete this.listeners[event]; },
        set currentTime(val) {
          this._currentTime = val;
          if (this.listeners['seeked']) {
            const fn = this.listeners['seeked'];
            delete this.listeners['seeked'];
            queueMicrotask(fn);
          }
        },
        get currentTime() { return this._currentTime; },
        play: async () => {},
        pause() {}
      };
      return v;
    }
    return new Element();
  },
  addEventListener: (n, fn) => docEvents[n] = fn
};

globalThis.window = {
  addEventListener: (n, fn) => winEvents[n] = fn
};

globalThis.Blob = class {
  constructor(parts) { this.parts = parts; }
  async arrayBuffer() {
    const mp4 = new Uint8Array(16);
    mp4[4] = 0x66; mp4[5] = 0x74; mp4[6] = 0x79; mp4[7] = 0x70;
    return mp4.buffer;
  }
};

globalThis.URL = {
  createObjectURL: () => 'blob:test-video',
  revokeObjectURL: () => {}
};

await import('./dist/video-page.mjs');

// 1. Initial State
assert.equal($('screen-btn').disabled, true, 'Screen button starts disabled');
assert.equal($('play-btn').disabled, true, 'Play button starts disabled');

// 2. Fail-Safe Gate UI Contracts
$('ack').checked = true;
$('ack').fire('change');
assert.equal($('play-btn').disabled, true, 'Checkbox alone cannot unlock playback');

$('confirm-text').value = 'I agree';
$('confirm-text').fire('input');
assert.equal($('play-btn').disabled, true, 'Failsafe without loaded video keeps play disabled');

// 3. Load Video File
$('file').files = [{ name: 'test.mp4', size: 1024, slice: () => new globalThis.Blob([]) }];
await $('load-btn').fire('click');

assert.ok($('load-status').textContent.includes('Loaded test.mp4'), 'Video metadata loaded');
assert.equal($('screen-btn').disabled, false, 'Screen button enabled after video load');
assert.equal($('play-btn').disabled, false, 'Play button enabled with video + failsafe');

// Unicode failsafe normalization in video UI
$('confirm-text').value = 'i\u00A0agree\u200B';
$('confirm-text').fire('input');
assert.equal($('play-btn').disabled, false, 'Accepts non-breaking and zero-width spaces');

$('confirm-text').value = '“i agree”';
$('confirm-text').fire('input');
assert.equal($('play-btn').disabled, false, 'Accepts smart quotes');

$('confirm-text').value = 'no';
$('confirm-text').fire('input');
assert.equal($('play-btn').disabled, true, 'Invalid failsafe locks play button');

$('confirm-text').value = 'I understand';
$('confirm-text').fire('input');
assert.equal($('play-btn').disabled, false, 'I understand unlocks play button');

// 4. Safe Background Screening Execution
await $('screen-btn').fire('click');
assert.equal($('results-section').hidden, false, 'Results section revealed after screening');
assert.ok($('result-summary').textContent.includes('Result:'), 'Result summary rendered');

// 5. Live Playback & Emergency Abort Paths
$('play-btn').fire('click');
assert.equal($('setup').hidden, true, 'Setup hidden during live playback');
assert.equal($('stage').hidden, false, 'Stage shown during live playback');

// Abort via Escape
winEvents.keydown({ key: 'Escape' });
assert.equal($('setup').hidden, false, 'Setup restored on Escape');
assert.equal($('stage').hidden, true, 'Stage hidden on Escape');
assert.equal($('play-btn').disabled, true, 'Fail-safe re-locked after stop');

// Abort via Blur
$('confirm-text').value = 'I agree';
$('confirm-text').fire('input');
$('ack').checked = true;
$('ack').fire('change');
$('play-btn').fire('click');
assert.equal($('stage').hidden, false);
winEvents.blur();
assert.equal($('stage').hidden, true, 'Emergency abort on window blur');

// Abort via Visibility Hidden
$('confirm-text').value = 'I agree';
$('confirm-text').fire('input');
$('ack').checked = true;
$('ack').fire('change');
$('play-btn').fire('click');
assert.equal($('stage').hidden, false);
document.hidden = true;
docEvents.visibilitychange();
document.hidden = false;
assert.equal($('stage').hidden, true, 'Emergency abort on tab hide');


// 6. Navigation Cleanup (pagehide / pageshow)
$('confirm-text').value = 'I agree';
$('confirm-text').fire('input');
$('ack').checked = true;
$('ack').fire('change');
$('file').files = [{ name: 'test.mp4', size: 1024, slice: () => new globalThis.Blob([]) }];
await $('load-btn').fire('click');
assert.equal($('screen-btn').disabled, false);

winEvents.pagehide();
assert.equal($('screen-btn').disabled, true, 'Screen button disabled after pagehide navigation');
assert.equal($('play-btn').disabled, true, 'Play button disabled after pagehide navigation');
assert.ok($('load-status').textContent.includes('Video resources released during navigation'), 'Status notes released resources');
winEvents.pageshow();
assert.equal($('screen-btn').disabled, true, 'Resources must be reloaded after pageshow');

console.log('Video UI contracts, failsafe lockouts, screening flow, emergency aborts and navigation cleanup passed.');
