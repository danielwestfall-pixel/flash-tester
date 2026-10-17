"""Deterministic encoded video fixtures from fixtures/video/patterns.json.

Requires ffmpeg with libx264 and libvpx-vp9. Never plays anything. Frames are
generated in memory (exact sRGB values) and piped to ffmpeg; outputs are tagged
BT.709 limited range. Usage: python3 generate-video-fixtures.py
"""
from pathlib import Path
import hashlib, json, subprocess

root = Path(__file__).resolve().parent / 'fixtures' / 'video'
spec = json.loads((root / 'patterns.json').read_text())
W, H = spec['size']; FPS = spec['fps']; N = FPS * spec['seconds']; code = spec['code']
COLOR = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv']
SCALE = 'scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int+bitexact,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv'
ENCODERS = {
    'mp4': ['-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-profile:v', 'high', '-threads', '1',
            '-x264-params', 'keyint=60:min-keyint=60', '-movflags', '+faststart'],
    'webm': ['-c:v', 'libvpx-vp9', '-crf', '15', '-b:v', '0', '-deadline', 'good', '-cpu-used', '2',
             '-threads', '1', '-row-mt', '0', '-g', '60'],
}

def fill(buf, rect, rgb):
    x, y, w, h = rect
    x0, x1 = max(0, x), min(W, x + w)
    if x1 <= x0: return
    row = bytes(rgb) * (x1 - x0)
    for yy in range(max(0, y), min(H, y + h)):
        o = (yy * W + x0) * 3
        buf[o:o + len(row)] = row

def state(region, n):
    return int((n / FPS) * 2 * region['hz']) % 2

def frame(fx, n):
    buf = bytearray(bytes(fx['base']) * (W * H))
    for r in fx['regions']:
        if 'hz' in r:
            fill(buf, r['rect'], r['b'] if state(r, n) else r['a'])
        else:  # moving region
            x, y, w, h = r['rect']
            pos = int(r['speed'] * n / FPS) % (W + w) - w
            fill(buf, [pos, y, w, h], r['rgb'])
    fill(buf, code['band']['rect'], code['band']['rgb'])
    g = n ^ (n >> 1)
    for b in range(code['bits']):
        bit = (g >> (code['bits'] - 1 - b)) & 1
        fill(buf, [code['x'] + b * (code['block'] + code['gap']), code['y'], code['block'], code['block']], code['one'] if bit else code['zero'])
    return bytes(buf)

def lin(v):
    v /= 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def lum(rgb):
    return .2126 * lin(rgb[0]) + .7152 * lin(rgb[1]) + .0722 * lin(rgb[2])

def expected_flashes(fx, frames):
    """Independent reference: max complete flashes (opposing transition pairs) in any 1 s window at the first region's center."""
    r = next((r for r in fx['regions'] if 'hz' in r), None)
    if not r: return 0
    ys = [lum(r['b'] if state(r, n) else r['a']) for n, _ in frames]
    trans = [t for (i, (_, t)) in enumerate(frames[1:], 1)
             if abs(ys[i] - ys[i - 1]) >= .1 and min(ys[i], ys[i - 1]) < .8]
    best = 0
    for i, t0 in enumerate(trans):
        best = max(best, sum(1 for t in trans[i:] if t - t0 <= 1 + 1e-9) // 2)
    return best

def plan(item):
    """Ordered (source frame index, presentation time) pairs after variants are applied."""
    if 'dropEvery' in item:
        return [(n, n / FPS) for n in range(N) if n % item['dropEvery'] != item['dropOffset']]
    if 'repeatEvery' in item:
        return [(n - 1 if n % item['repeatEvery'] == item['repeatOffset'] else n, n / FPS) for n in range(N)]
    return [(n, n / FPS) for n in range(N)]

def encode(fx, item, ext):
    out = root / f"{item['id']}.{ext}"
    frames = plan(item)
    vf = SCALE
    extra = []
    if 'dropEvery' in item:
        # Feed every source frame and drop with select so surviving frames keep source timestamps.
        vf = f"select='not(eq(mod(n\\,{item['dropEvery']})\\,{item['dropOffset']}))',{SCALE}"
        extra = ['-fps_mode', 'vfr']
        source = [n for n in range(N)]
    else:
        source = [n for n, _ in frames]
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
           '-vf', vf, *extra, *ENCODERS[ext], *COLOR, '-an', '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:v', '+bitexact', str(out)]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for n in source:
        p.stdin.write(frame(fx, n))
    p.stdin.close()
    assert p.wait() == 0, cmd
    return out, frames

def main():
    version = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.splitlines()[0]
    fixtures = {f['id']: f for f in spec['fixtures']}
    items = [(f, f) for f in spec['fixtures']] + [(fixtures[v['from']], v) for v in spec['variants']]
    files = []
    for fx, item in items:
        for ext in ENCODERS:
            out, frames = encode(fx, item, ext)
            files.append({'file': out.name, 'id': item['id'], 'from': fx['id'], 'container': ext,
                          'codec': 'h264' if ext == 'mp4' else 'vp9', 'safe': fx['safe'],
                          'frames': len(frames), 'sourceFrameIndices': [n for n, _ in frames],
                          'presentationSeconds': [round(t, 6) for _, t in frames],
                          'expectedMaxFlashesPerSecond': expected_flashes(fx, frames),
                          'reference': item['reference'], 'bytes': out.stat().st_size,
                          'sha256': hashlib.sha256(out.read_bytes()).hexdigest()})
            print(f"{out.name}: {files[-1]['bytes']} bytes, {len(frames)} frames, expected {files[-1]['expectedMaxFlashesPerSecond']} flashes/s")
    manifest = {'patternsVersion': spec['version'], 'encoder': version, 'size': [W, H], 'fps': FPS,
                'color': 'BT.709 primaries/transfer/matrix, limited range, yuv420p',
                'note': 'Hashes are for this encoder build; other ffmpeg versions may produce different bytes. test-video-fixtures.py verifies decoded content, not hashes alone. Expected flash counts come from the source pattern definition, not from the app.',
                'files': files}
    (root / 'manifest.json').write_text(json.dumps(manifest, indent=1) + '\n')

if __name__ == '__main__':
    main()
