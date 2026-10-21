import assert from 'node:assert/strict';
import {videoUrls, videoFileKind, scanVideo} from './dist/video-scanner.mjs';

// 1. videoUrls validation
assert.deepEqual(videoUrls('https://example.com/test.mp4\nhttp://cdn.local/video.webm'), [
  'https://example.com/test.mp4',
  'http://cdn.local/video.webm'
]);
assert.deepEqual(videoUrls('  https://example.com/a.mp4  \n\n  https://example.com/a.mp4  '), [
  'https://example.com/a.mp4'
], 'Duplicates and surrounding whitespace trimmed');

assert.throws(() => videoUrls('file:///c:/video.mp4'), /Use HTTP\(S\)/, 'Rejects file:// URLs');
assert.throws(() => videoUrls('javascript:alert(1)'), /Use HTTP\(S\)/, 'Rejects javascript: URLs');
assert.throws(() => videoUrls('https://user:pass@example.com/v.mp4'), /credentials/, 'Rejects credentials');
assert.throws(() => videoUrls('not-a-url'), /Invalid URL/, 'Rejects malformed strings');

const elevenUrls = Array.from({length: 11}, (_, i) => `https://example.com/video${i}.mp4`).join('\n');
assert.throws(() => videoUrls(elevenUrls), /at most 10/, 'Enforces 10 URL limit');

// 2. videoFileKind binary header parsing
// MP4 with 'ftyp' at offset 4
const mp4Header = new Uint8Array(16);
mp4Header[4] = 0x66; mp4Header[5] = 0x74; mp4Header[6] = 0x79; mp4Header[7] = 0x70; // 'ftyp'
mp4Header[8] = 0x69; mp4Header[9] = 0x73; mp4Header[10] = 0x6f; mp4Header[11] = 0x6d; // 'isom'
assert.ok(videoFileKind(mp4Header).includes('mp4'), 'Recognizes MP4 container');

// WebM with 0x1A 0x45 0xDF 0xA3
const webmHeader = new Uint8Array(16);
webmHeader[0] = 0x1a; webmHeader[1] = 0x45; webmHeader[2] = 0xdf; webmHeader[3] = 0xa3;
assert.equal(videoFileKind(webmHeader), 'webm', 'Recognizes WebM container');

// OGG with 'OggS'
const oggHeader = new Uint8Array(16);
oggHeader[0] = 0x4f; oggHeader[1] = 0x67; oggHeader[2] = 0x67; oggHeader[3] = 0x53; // 'OggS'
assert.equal(videoFileKind(oggHeader), 'ogg', 'Recognizes OGG container');

// Rejects non-video
assert.throws(() => videoFileKind(new Uint8Array([1, 2, 3])), /too small/, 'Rejects small buffers');
assert.throws(() => videoFileKind(new Uint8Array(20)), /Unsupported format/, 'Rejects zeroed buffer');
assert.throws(() => videoFileKind(new TextEncoder().encode('<!DOCTYPE html><html>')), /Unsupported format/, 'Rejects HTML');

// 3. Synthetic scanVideo execution with mock video
class MockCanvas {
  constructor(w, h) { this.width = w; this.height = h; }
  getContext() {
    return {
      drawImage() {},
      getImageData: (x, y, w, h) => {
        // Return 10 Hz alternating white / black frames based on mockVideo.currentTime
        const isWhite = Math.floor(mockVideo.currentTime * 20) % 2 === 0;
        const val = isWhite ? 255 : 0;
        const data = new Uint8ClampedArray(w * h * 4);
        for (let i = 0; i < data.length; i += 4) {
          data[i] = data[i+1] = data[i+2] = val;
          data[i+3] = 255;
        }
        return { data };
      }
    };
  }
}

globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') return new MockCanvas(320, 180);
    return {};
  }
};

const mockVideo = {
  duration: 2.0,
  videoWidth: 640,
  videoHeight: 360,
  _currentTime: 0,
  listeners: {},
  set currentTime(v) {
    this._currentTime = v;
    if (this.listeners['seeked']) {
      const fn = this.listeners['seeked'];
      delete this.listeners['seeked'];
      queueMicrotask(fn);
    }
  },
  get currentTime() { return this._currentTime; },
  addEventListener(event, fn) { this.listeners[event] = fn; },
  removeEventListener(event, fn) { delete this.listeners[event]; },
  pause() {}
};

// Force seeking mode with 30 fps stepping
const progressLogs = [];
const {report, evidence} = await scanVideo(mockVideo, {
  analysisWidth: 320,
  analysisHeight: 180,
  maxDuration: 2.0,
  stepFps: 30,
  forceSeeking: true,
  keepScreenshots: false,
  onProgress: p => progressLogs.push(p.percent)
});

assert.ok(report.reportId, 'Report includes generated reportId');
assert.equal(report.buildId, 'flash-review-0.4.3-20261019');
assert.equal(report.sourceType, 'video-file-screening');
assert.equal(report.videoMetadata.width, 640);
assert.equal(report.videoMetadata.height, 360);
assert.ok(report.peakGeneral > 3, '10 Hz alternating frames detect flash candidates');
assert.equal(report.status, 'candidates-detected');
assert.ok(progressLogs.length > 10, 'Progress callback fired multiple times');
assert.ok(evidence.trace.length > 10, 'Evidence trace collected');

console.log('Video scanner unit tests and synthetic screening checks passed.');
