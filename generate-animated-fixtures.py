"""Deterministic animated-image fixtures (GIF, APNG, animated WebP) for file analysis.

GIF and APNG are written directly (exact delays); WebP uses img2webp from libwebp.
Requires img2webp, and ffprobe for timing read-back (`brew install webp ffmpeg`).
Never displays anything. Frame durations are multiples of 10 ms, so all three formats
store them exactly. Expected flash counts are computed here from the definitions,
independently of the app. Usage: python3 generate-animated-fixtures.py
"""
from pathlib import Path
import hashlib, json, shutil, subprocess, tempfile, zlib, struct

root = Path(__file__).resolve().parent / 'fixtures' / 'animated'
W, H = 96, 54
BLACK, WHITE = (0, 0, 0, 255), (255, 255, 255, 255)
CLEAR = (0, 0, 0, 0)

def full(c): return {'base': c, 'rect': None}
def zone(base, c, rect): return {'base': base, 'rect': rect, 'fill': c}

def alternating(a, b, ms, frames): return [(a if i % 2 == 0 else b, ms) for i in range(frames)]

# Each definition: frames = [(layer, duration_ms)], loop: 'infinite' or plays (int >= 1).
FIXTURES = [
    {'id': 'bw-4hz', 'loop': 'infinite', 'formats': ['gif', 'png', 'webp'], 'frames': alternating(full(BLACK), full(WHITE), 120, 16),
     'note': 'Full-frame black/white, 120 ms frames (4.17 flashes/s).'},
    {'id': 'bw-2hz', 'loop': 'infinite', 'formats': ['gif', 'png', 'webp'], 'frames': alternating(full(BLACK), full(WHITE), 250, 8),
     'note': '250 ms frames: 2 flashes/s, below the frequency limit.'},
    {'id': 'bw-3hz', 'loop': 'infinite', 'formats': ['gif', 'png', 'webp'], 'frames': alternating(full(BLACK), full(WHITE), 170, 12),
     'note': '170 ms frames: at most 3 flashes in any second.'},
    {'id': 'seam-loop-4hz', 'loop': 'infinite', 'formats': ['gif', 'png', 'webp'], 'frames': alternating(full(BLACK), full(WHITE), 120, 2),
     'note': 'Two frames. Flashing exists only across the loop seam.'},
    {'id': 'seam-once-4hz', 'loop': 1, 'formats': ['gif', 'png', 'webp'], 'frames': alternating(full(BLACK), full(WHITE), 120, 2),
     'note': 'Same two frames, played once: a single change, no flash.'},
    {'id': 'fast-10ms', 'loop': 'infinite', 'formats': ['gif', 'png', 'webp'], 'frames': alternating(full(BLACK), full(WHITE), 10, 20),
     'note': '10 ms frames. Browsers show them for 100 ms (5 flashes/s); as encoded, 50 flashes/s.'},
    {'id': 'low-contrast-4hz', 'loop': 'infinite', 'formats': ['gif', 'png', 'webp'], 'frames': alternating(full((100, 100, 100, 255)), full((110, 110, 110, 255)), 120, 16),
     'note': 'Delta Y about 0.028: no general flashes. Safe to view.'},
    {'id': 'red-cyan-4hz', 'loop': 'infinite', 'formats': ['png', 'webp'], 'frames': alternating(full((255, 0, 0, 255)), full((0, 255, 255, 255)), 120, 16),
     'note': 'Saturated red/cyan: general and experimental red candidates.'},
    {'id': 'small-zone-4hz', 'loop': 'infinite', 'formats': ['gif', 'png', 'webp'], 'frames': alternating(zone(BLACK, BLACK, (44, 23, 8, 8)), zone(BLACK, WHITE, (44, 23, 8, 8)), 120, 16),
     'note': '8 x 8 white square on black. Area depends on the displayed size.'},
    {'id': 'transparent-4hz', 'loop': 'infinite', 'formats': ['png', 'webp'], 'frames': alternating(full(CLEAR), full(BLACK), 120, 16),
     'note': 'Alternates transparent and opaque black: flashes over a white background, not over black.'},
]

def lin(v):
    v /= 255
    return v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4

def composite(layer, bg):
    """RGB at the region centre (or frame centre) over background bg."""
    c = layer['fill'] if layer['rect'] else layer['base']
    a = c[3] / 255
    return tuple(round(c[i] * a + bg[i] * (1 - a)) for i in range(3))

def lum(rgb): return .2126 * lin(rgb[0]) + .7152 * lin(rgb[1]) + .0722 * lin(rgb[2])

def expected(fx, model, bg=(255, 255, 255), seconds=30):
    """Max complete flashes (opposing transitions >= 0.10, darker < 0.80) with both transitions in a closed 1 s window."""
    durs = [(100 if ms <= 10 else ms) if model == 'display' else ms for _, ms in fx['frames']]
    plays = 10**6 if fx['loop'] == 'infinite' else fx['loop']
    ys, times, t = [], [], 0
    while len(times) == 0 or (t < seconds * 1000 and len(times) < plays * len(durs)):
        i = len(times) % len(durs)
        ys.append(lum(composite(fx['frames'][i][0], bg))); times.append(t / 1000); t += durs[i]
    tr = [times[i] for i in range(1, len(ys)) if abs(ys[i] - ys[i - 1]) >= .1 and min(ys[i], ys[i - 1]) < .8]
    return max([sum(1 for u in tr[i:] if u - t0 <= 1 + 1e-9) // 2 for i, t0 in enumerate(tr)] or [0])

def png(path, layer):
    rows = []
    for y in range(H):
        row = bytearray([0])
        for x in range(W):
            r = layer['rect']
            c = layer['fill'] if r and r[0] <= x < r[0] + r[2] and r[1] <= y < r[1] + r[3] else layer['base']
            row += bytes(c)
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)
    def chunk(k, d): return struct.pack('>I', len(d)) + k + d + struct.pack('>I', zlib.crc32(k + d) & 0xffffffff)
    path.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) + chunk(b'IDAT', raw) + chunk(b'IEND', b''))

def pixels(layer):
    r = layer['rect']
    return [layer['fill'] if r and r[0] <= x < r[0] + r[2] and r[1] <= y < r[1] + r[3] else layer['base'] for y in range(H) for x in range(W)]

def gif(fx, out):
    """Minimal GIF89a writer: exact centisecond delays, no resampling, no dithering."""
    palette = []
    frames = []
    for layer, ms in fx['frames']:
        px = pixels(layer)
        for c in px:
            if c[3] != 255: raise ValueError('GIF fixtures must be opaque')
            if c[:3] not in palette: palette.append(c[:3])
        frames.append(([palette.index(c[:3]) for c in px], ms))
    bits = max(2, (len(palette) - 1).bit_length()); size = 1 << bits
    table = b''.join(bytes(c) for c in palette) + b'\0' * 3 * (size - len(palette))
    data = bytearray(b'GIF89a' + struct.pack('<HHBBB', W, H, 0x80 | (bits - 1), 0, 0) + table)
    if fx['loop'] == 'infinite': data += b'\x21\xff\x0bNETSCAPE2.0\x03\x01' + struct.pack('<H', 0) + b'\0'
    elif fx['loop'] > 1: data += b'\x21\xff\x0bNETSCAPE2.0\x03\x01' + struct.pack('<H', fx['loop'] - 1) + b'\0'
    for idx, ms in frames:
        if ms % 10: raise ValueError('GIF delays are centiseconds')
        data += b'\x21\xf9\x04\x04' + struct.pack('<H', ms // 10) + b'\0\0'
        data += b'\x2c' + struct.pack('<HHHHB', 0, 0, W, H, 0)
        # "Uncompressed" LZW: a clear code before the dictionary would widen the code size.
        clear, end, width = 1 << bits, (1 << bits) + 1, bits + 1
        codes, run = [clear], 0
        for i in idx:
            codes.append(i); run += 1
            if run == (1 << bits) - 2: codes.append(clear); run = 0
        codes.append(end)
        acc = nbits = 0; stream = bytearray()
        for c in codes:
            acc |= c << nbits; nbits += width
            while nbits >= 8: stream.append(acc & 255); acc >>= 8; nbits -= 8
        if nbits: stream.append(acc & 255)
        data += bytes([bits])
        for i in range(0, len(stream), 255): chunk = stream[i:i + 255]; data += bytes([len(chunk)]) + chunk
        data += b'\0'
    out.write_bytes(bytes(data + b'\x3b'))

def apng(fx, out):
    """Minimal APNG writer: exact millisecond delays (delay_num / 1000)."""
    def chunk(k, d): return struct.pack('>I', len(d)) + k + d + struct.pack('>I', zlib.crc32(k + d) & 0xffffffff)
    plays = 0 if fx['loop'] == 'infinite' else fx['loop']
    body = chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0)) + chunk(b'acTL', struct.pack('>II', len(fx['frames']), plays))
    seq = 0
    for n, (layer, ms) in enumerate(fx['frames']):
        raw = zlib.compress(b''.join(b'\0' + b''.join(bytes(c) for c in pixels(layer)[y * W:(y + 1) * W]) for y in range(H)), 9)
        body += chunk(b'fcTL', struct.pack('>IIIIIHHBB', seq, W, H, 0, 0, ms, 1000, 0, 0)); seq += 1
        if n == 0: body += chunk(b'IDAT', raw)
        else: body += chunk(b'fdAT', struct.pack('>I', seq) + raw); seq += 1
    out.write_bytes(b'\x89PNG\r\n\x1a\n' + body + chunk(b'IEND', b''))

def build(fx, fmt, tmp):
    out = root / f"{fx['id']}.{fmt}"
    if fmt == 'gif': gif(fx, out); return out
    if fmt == 'png': apng(fx, out); return out
    frames = []
    for i, (layer, ms) in enumerate(fx['frames']):
        p = tmp / f"{fx['id']}-{i:03d}.png"; png(p, layer); frames.append((p, ms))
    cmd = ['img2webp', '-loop', '0' if fx['loop'] == 'infinite' else str(fx['loop']), '-lossless', '-exact']
    for p, ms in frames: cmd += ['-d', str(ms), str(p)]
    subprocess.run(cmd + ['-o', str(out)], check=True, capture_output=True)
    return out

def check_timing(out, fx):
    """Independent read-back of GIF/APNG frame timing with ffprobe (WebP is checked in Chrome)."""
    if out.suffix == '.webp': return None
    rows = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'packet=duration_time', '-of', 'csv=p=0', str(out)], capture_output=True, text=True, check=True).stdout.split()
    got = [round(float(r) * 1000) for r in rows]
    want = [ms for _, ms in fx['frames']]
    if got != want: raise SystemExit(f'{out.name}: ffprobe frame durations {got} != definition {want}')
    return got

def main():
    root.mkdir(parents=True, exist_ok=True)
    versions = {'ffmpeg': subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True).stdout.splitlines()[0],
                'img2webp': subprocess.run(['img2webp', '-version'], capture_output=True, text=True).stdout.strip()}
    files = []
    with tempfile.TemporaryDirectory() as d:
        tmp = Path(d)
        for fx in FIXTURES:
            for fmt in fx['formats']:
                out = build(fx, fmt, tmp)
                check_timing(out, fx)
                files.append({'file': out.name, 'id': fx['id'], 'format': {'gif': 'image/gif', 'png': 'image/png', 'webp': 'image/webp'}[fmt],
                              'frames': len(fx['frames']), 'frameDurationsMs': [ms for _, ms in fx['frames']], 'loop': fx['loop'],
                              'safe': fx['id'] in ('low-contrast-4hz',),
                              'expectedFlashes': {'display': expected(fx, 'display'), 'encoded': expected(fx, 'encoded'),
                                                  'displayOverBlack': expected(fx, 'display', (0, 0, 0))},
                              'note': fx['note'], 'bytes': out.stat().st_size, 'sha256': hashlib.sha256(out.read_bytes()).hexdigest()})
                print(f"{out.name}: {out.stat().st_size} bytes, expected {files[-1]['expectedFlashes']}")
    (root / 'manifest.json').write_text(json.dumps({'size': [W, H], 'tools': versions,
        'note': 'Expected flash counts come from the definitions (30 s, closed 1 s window, white background unless stated), not from the app. Most fixtures flash intentionally; nothing autoplays from this folder.',
        'files': files}, indent=1) + '\n')

if __name__ == '__main__':
    if not shutil.which('img2webp'): raise SystemExit('img2webp (libwebp) is required')
    main()
