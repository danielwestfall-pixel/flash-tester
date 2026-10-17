"""Verify encoded video fixtures by decoding them with ffmpeg (no app code).

Checks container/codec/color tags, frame count and presentation timestamps,
the Gray-coded source frame index of every decoded frame, decoded pixel values
against the pattern definition, safe-fixture luminance steps, and an
independently computed flash count from decoded pixels.

Usage: python3 test-video-fixtures.py [DIR_OR_FILES...] [--browser-encoded]
With --browser-encoded, files come from recorder.html (VP8/VP9 WebM, variable
timing): frame-index continuity is reported rather than required.
"""
from pathlib import Path
import hashlib, json, subprocess, sys

root = Path(__file__).resolve().parent / 'fixtures' / 'video'
spec = json.loads((root / 'patterns.json').read_text())
W, H = spec['size']; FPS = spec['fps']; code = spec['code']
fixtures = {f['id']: f for f in spec['fixtures']}
for v in spec['variants']: fixtures[v['id']] = fixtures[v['from']]
browser = '--browser-encoded' in sys.argv
args = [a for a in sys.argv[1:] if not a.startswith('--')]

def lin(v):
    v /= 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4
def lum(rgb): return .2126 * lin(rgb[0]) + .7152 * lin(rgb[1]) + .0722 * lin(rgb[2])

def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                          'stream=codec_name,width,height,color_space,color_primaries,color_transfer,color_range:frame=pts_time,best_effort_timestamp_time',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True).stdout
    return json.loads(out)

def decode(path, w, h):
    # Reference fixtures are known BT.709 limited. Browser recordings are decoded
    # per their own stream tags (ffmpeg falls back to BT.601 when untagged).
    matrix = '' if browser else 'in_color_matrix=bt709:in_range=tv:'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-vf',
                          f'scale={matrix}flags=accurate_rnd+full_chroma_int,format=rgb24',
                          '-fps_mode', 'passthrough', '-f', 'rawvideo', '-'], capture_output=True, check=True).stdout
    size = w * h * 3
    return [raw[i:i + size] for i in range(0, len(raw), size)]

def px(f, x, y, w):
    o = (y * w + x) * 3
    return list(f[o:o + 3])

def frame_index(f, w, h):
    sx, sy = w / W, h / H  # browser recordings may be scaled
    g = 0
    for b in range(code['bits']):
        cx = code['x'] + b * (code['block'] + code['gap']) + code['block'] // 2
        cy = code['y'] + code['block'] // 2
        v = sum(px(f, int(cx * sx), int(cy * sy), w)) / 3
        g = (g << 1) | (v > (code['zero'][0] + code['one'][0]) / 2)
    n, s = g, g >> 1
    while s: n ^= s; s >>= 1
    return n

def expected_rgb(fx, n, x, y):
    rgb = fx['base']
    for r in fx['regions']:
        rx, ry, rw, rh = r['rect']
        if 'hz' in r:
            if rx <= x < rx + rw and ry <= y < ry + rh:
                rgb = r['b'] if int((n / FPS) * 2 * r['hz']) % 2 else r['a']
        else:
            pos = int(r['speed'] * n / FPS) % (W + rw) - rw
            if pos <= x < pos + rw and ry <= y < ry + rh: rgb = r['rgb']
    return rgb

def flashes(times, ys):
    trans = [times[i] for i in range(1, len(ys)) if abs(ys[i] - ys[i - 1]) >= .1 and min(ys[i], ys[i - 1]) < .8]
    return max([sum(1 for t in trans[i:] if t - t0 <= 1 + 1e-9) // 2 for i, t0 in enumerate(trans)] or [0])

def verify(path, entry=None):
    fid = path.stem.split('.')[0]
    fx = fixtures[fid]
    info = probe(path); st = info['streams'][0]; w, h = st['width'], st['height']
    times = [float(fr.get('pts_time') or fr.get('best_effort_timestamp_time')) for fr in info['frames']]
    frames = decode(path, w, h)
    checks = {}
    checks['decoded frame count matches probe'] = len(frames) == len(times)
    idx = [frame_index(f, w, h) for f in frames]
    # Sample points: region centers, a base point, and a 5 x 4 grid (avoiding the code band).
    pts = [(r['rect'][0] + r['rect'][2] // 2, r['rect'][1] + r['rect'][3] // 2) for r in fx['regions'] if 'hz' in r]
    grid = [(int(W * (i + .5) / 5), int(328 * (j + .5) / 4)) for i in range(5) for j in range(4)]
    tol = 6 if not browser else 14
    worst = 0
    for f, n in zip(frames, idx):
        for (x, y) in pts + grid:
            if fx['regions'] and any('speed' in r for r in fx['regions']):
                r = fx['regions'][0]; pos = int(r['speed'] * n / FPS) % (W + r['rect'][2]) - r['rect'][2]
                if abs(x - pos) < 3 or abs(x - (pos + r['rect'][2])) < 3: continue  # skip codec-blurred edges
            if any('hz' in r and (abs(x - r['rect'][0]) < 3 or abs(x - r['rect'][0] - r['rect'][2]) < 3 or abs(y - r['rect'][1]) < 3 or abs(y - r['rect'][1] - r['rect'][3]) < 3) for r in fx['regions']): continue
            exp = expected_rgb(fx, n, x, y); got = px(f, int(x * w / W), int(y * h / H), w)
            worst = max(worst, max(abs(a - b) for a, b in zip(exp, got)))
    checks[f'decoded RGB within {tol} of definition'] = worst <= tol
    if pts:
        cx, cy = pts[0]
        ys = [lum(px(f, int(cx * w / W), int(cy * h / H), w)) for f in frames]
        got_flashes = flashes([t - times[0] for t in times], ys)
    else:
        got_flashes = 0
    if fx['safe']:
        steps = [abs(lum(px(a, int(x * w / W), int(y * h / H), w)) - lum(px(b, int(x * w / W), int(y * h / H), w)))
                 for a, b in zip(frames, frames[1:]) for (x, y) in grid]
        checks['safe: no luminance step >= 0.10 at sample points'] = max(steps or [0]) < .1
    result = {'file': path.name, 'codec': st['codec_name'], 'size': [w, h], 'frames': len(frames),
              'colorTags': [st.get(k) for k in ('color_space', 'color_primaries', 'color_transfer', 'color_range')],
              'firstIndices': idx[:6], 'maxRgbError': worst, 'decodedFlashes': got_flashes}
    if not browser:
        checks['manifest hash matches file'] = hashlib.sha256(path.read_bytes()).hexdigest() == entry['sha256']
        checks['codec'] = st['codec_name'] == entry['codec']
        checks['size'] = [w, h] == [W, H]
        checks['BT.709 limited tags'] = (st.get('color_space'), st.get('color_primaries'), st.get('color_transfer'), st.get('color_range')) == ('bt709', 'bt709', 'bt709', 'tv')
        checks['frame count'] = len(frames) == entry['frames']
        checks['timestamps match plan (<1 ms)'] = len(times) == entry['frames'] and all(abs(a - b) < .001 for a, b in zip(times, entry['presentationSeconds']))
        checks['every frame index matches plan'] = idx == entry['sourceFrameIndices']
        checks['decoded flashes == expected'] = got_flashes == entry['expectedMaxFlashesPerSecond']
    else:
        steps = [b - a for a, b in zip(idx, idx[1:])]
        result.update({'indexStepCounts': {str(s): steps.count(s) for s in sorted(set(steps))},
                       'droppedSourceFrames': sum(s - 1 for s in steps if s > 1), 'repeatedFrames': steps.count(0),
                       'backwardSteps': sum(1 for s in steps if s < 0),
                       'timestampDeltasMs': sorted({round((b - a) * 1000, 1) for a, b in zip(times, times[1:])})[:12],
                       'durationSeconds': times[-1] - times[0] if times else 0})
        checks['frame indices never go backwards'] = result['backwardSteps'] == 0
        checks['timestamps nondecreasing'] = all(b >= a for a, b in zip(times, times[1:]))
        expected = next((e['expectedMaxFlashesPerSecond'] for e in manifest['files'] if e['id'] == fid), None)
        result['expectedFlashes'] = expected
        checks['decoded flashes == source expectation'] = got_flashes == expected
    result['ok'] = all(checks.values()); result['failed'] = [k for k, v in checks.items() if not v]
    return result

manifest = json.loads((root / 'manifest.json').read_text())
if args:
    paths = [p for a in args for p in (sorted(Path(a).glob('*.webm')) + sorted(Path(a).glob('*.mp4')) if Path(a).is_dir() else [Path(a)])]
    results = [verify(p, next((e for e in manifest['files'] if e['file'] == p.name), None)) for p in paths]
else:
    results = [verify(root / e['file'], e) for e in manifest['files']]
for r in results:
    print(('ok  ' if r['ok'] else 'FAIL') + f" {r['file']}: {r['frames']} frames, max RGB error {r['maxRgbError']}, decoded flashes {r['decodedFlashes']}" + (f" failed={r['failed']}" if r['failed'] else '') +
          (f" drops={r['droppedSourceFrames']} repeats={r['repeatedFrames']} deltas={r['timestampDeltasMs']}" if browser else ''))
out = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--json=')), None)
if out: Path(out).write_text(json.dumps(results, indent=1))
ok = all(r['ok'] for r in results)
print(f"{len(results)} video files {'verified' if ok else 'FAILED'}. Decoded content only; does not validate browser playback, display or capture.")
sys.exit(0 if ok else 1)
