"""Build the in-app mark (transparent) and launcher icons (white rounded card).
Source art is public/assets/logo-repaired.png; requires ffmpeg only.
"""
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'public/assets'
LOGO = ASSETS / 'logo-repaired.png'
RES = ROOT / 'android/app/src/main/res'
TMP = pathlib.Path(tempfile.mkdtemp())
W, H = 1408, 768


def raw(png, w, h):
    return bytearray(subprocess.check_output(
        ['ffmpeg', '-v', 'error', '-i', str(png), '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']))


def write_png(data, w, h, out):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba',
                    '-s', f'{w}x{h}', '-i', '-', '-frames:v', '1', str(out)],
                   input=data, check=True)


def scale_raw(png, w, h):
    return raw(png, w, h) if (w, h) == (W, H) else bytearray(subprocess.check_output(
        ['ffmpeg', '-v', 'error', '-i', str(png), '-vf', f'scale={w}:{h}',
         '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']))


def emblem_box():
    data = raw(LOGO, W, H)
    xs, ys = [], []
    for y in range(0, 490):  # emblem only; the wordmark starts around y=502
        row = y * W * 4
        for x in range(W):
            if data[row + x * 4 + 3] > 8:
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs), max(ys)


def main():
    x0, y0, x1, y1 = emblem_box()
    pad = 6
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(W, x1 + pad), min(H, y1 + pad)
    cw, ch = x1 - x0, y1 - y0
    emblem = TMP / 'emblem.png'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(LOGO), '-vf',
                    f'crop={cw}:{ch}:{x0}:{y0}', '-frames:v', '1', str(emblem)], check=True)

    # In-app mark: transparent, tightly cropped.
    mark_w = 512
    mark_h = round(ch * mark_w / cw)
    write_png(scale_raw(emblem, mark_w, mark_h), mark_w, mark_h, ASSETS / 'mark.png')
    print('mark', mark_w, mark_h)

    # Launcher card: white rounded rectangle, emblem centred.
    size, radius, ss = 512, 112, 2
    big = size * ss
    canvas = bytearray(big * big * 4)
    r = radius * ss
    for y in range(big):
        for x in range(big):
            dx = max(r - x, 0, x - (big - r))
            dy = max(r - y, 0, y - (big - r))
            if dx * dx + dy * dy <= r * r:
                i = (y * big + x) * 4
                canvas[i:i + 4] = b'\xff\xff\xff\xff'

    ew = round(size * 0.70) * ss
    eh = round(ch * ew / cw)
    art = scale_raw(emblem, ew, eh)
    ox = (big - ew) // 2
    oy = (big - eh) // 2 - 6 * ss
    for y in range(eh):
        for x in range(ew):
            si = (y * ew + x) * 4
            a = art[si + 3]
            if not a:
                continue
            di = ((oy + y) * big + ox + x) * 4
            inv = 255 - a
            for c in range(3):
                canvas[di + c] = (art[si + c] * a + canvas[di + c] * inv) // 255
            canvas[di + 3] = 255

    # Box-downsample the supersampled canvas.
    out = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                row = ((y * ss + sy) * big + x * ss) * 4
                for sx in range(ss):
                    i = row + sx * 4
                    for c in range(4):
                        acc[c] += canvas[i + c]
            di = (y * size + x) * 4
            for c in range(4):
                out[di + c] = acc[c] // (ss * ss)

    icon = TMP / 'icon512.png'
    write_png(out, size, size, icon)

    for name, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
        folder = RES / f'mipmap-{name}'
        folder.mkdir(parents=True, exist_ok=True)
        for file in ('ic_launcher.png', 'ic_launcher_round.png'):
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(icon), '-vf', f'scale={px}:{px}',
                            '-frames:v', '1', str(folder / file)], check=True)

    # Web icon + favicon reuse the same card.
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(icon), '-vf', 'scale=256:256',
                    '-frames:v', '1', str(ASSETS / 'icon.png')], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(icon), '-vf', 'scale=48:48',
                    '-frames:v', '1', str(ASSETS / 'favicon.png')], check=True)
    print('icons written')


if __name__ == '__main__':
    main()
