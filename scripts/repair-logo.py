"""Localized approximation of the missing pale-blue shoulder. Requires ffmpeg only.
Original lettering and all pixels outside (567, 313)-(697, 367) stay unchanged.
Run against the preserved damaged source, never the generated repair.
"""
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[1]
assets = root / 'public/assets'
source = assets / 'logo-original-damaged.png'
w, h = 1408, 768
raw = bytearray(subprocess.check_output([
    'ffmpeg', '-v', 'error', '-i', str(source), '-f', 'rawvideo', '-pix_fmt', 'rgba', '-']))
# Smooth shoulder silhouette with the original white inner-arm channel retained.
polygon = [(567,350),(580,329),(589,322),(600,318),(612,317),(625,319),
           (640,325),(657,335),(676,346),(697,354),(689,367),
           (669,360),(649,352),(631,345),(627,341),(637,334),
           (624,331),(613,334),(603,340),(597,348),(600,356),(577,367)]

def inside(x, y):
    result = False
    for i, (ax, ay) in enumerate(polygon):
        bx, by = polygon[i - 1]
        if (ay > y) != (by > y) and x < (bx-ax)*(y-ay)/(by-ay)+ax:
            result = not result
    return result

for y in range(313, 368):
    for x in range(567, 698):
        i = (y*w+x)*4
        coverage = sum(inside(x+(sx+.5)/4, y+(sy+.5)/4)
                       for sy in range(4) for sx in range(4))/16
        r, g, b, alpha = raw[i:i+4]
        # Never touch the child's dark outline/cream fill or other non-blue art.
        if alpha > 128 and (r < 170 or g < 195 or b < g):
            continue
        # Remove floating pale-blue fragments above the reconstructed shoulder.
        if y < 351 and not coverage:
            raw[i:i+4] = bytes((255, 255, 255, 0))
            continue
        if not coverage:
            continue
        t = (y-317)/55
        color = (round(210-3*t), round(234-5*t), round(242+1*t))
        # Keep surviving pixels and feather the fill into them, avoiding white seams.
        blend = max(0, min(1, (351-y)/16)) if alpha > 250 else 1
        for c in range(3):
            raw[i+c] = round(color[c]*blend + raw[i+c]*(1-blend))
        raw[i+3] = round(255*coverage) if y < 351 else max(alpha, round(255*coverage))

subprocess.run(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','rgba',
                '-s',f'{w}x{h}','-i','-','-frames:v','1',
                str(assets/'logo-repaired.png')], input=raw, check=True)
