"""Minimal SVG rasteriser for our own output: <rect> bg + <path> (M/L/Q/C/Z) with optional translate group."""
import re
from PIL import Image, ImageDraw

def _flatten(d, steps=12):
    toks = re.findall(r"[MLQCZHV]|-?[\d.]+(?:e-?\d+)?", d)
    subs, cur, i, cmd, p0 = [], [], 0, None, (0, 0)
    pos = (0, 0)
    def num():
        nonlocal i; v = float(toks[i]); i += 1; return v
    while i < len(toks):
        t = toks[i]
        if t.isalpha(): cmd = t; i += 1
        if cmd == "M":
            if cur: subs.append(cur)
            pos = (num(), num()); cur = [pos]; cmd = "L"
        elif cmd == "L": pos = (num(), num()); cur.append(pos)
        elif cmd == "H": pos = (num(), pos[1]); cur.append(pos)
        elif cmd == "V": pos = (pos[0], num()); cur.append(pos)
        elif cmd == "Q":
            c, e = (num(), num()), (num(), num())
            for k in range(1, steps + 1):
                u = k / steps
                cur.append(((1-u)**2*pos[0]+2*(1-u)*u*c[0]+u*u*e[0], (1-u)**2*pos[1]+2*(1-u)*u*c[1]+u*u*e[1]))
            pos = e
        elif cmd == "C":
            c1, c2, e = (num(), num()), (num(), num()), (num(), num())
            for k in range(1, steps + 1):
                u = k / steps; a, b, c, dd = (1-u)**3, 3*(1-u)**2*u, 3*(1-u)*u*u, u**3
                cur.append((a*pos[0]+b*c1[0]+c*c2[0]+dd*e[0], a*pos[1]+b*c1[1]+c*c2[1]+dd*e[1]))
            pos = e
        elif cmd == "Z":
            if cur: subs.append(cur); pos = cur[0]
            cur = []; cmd = None
    if cur: subs.append(cur)
    return subs

def raster_svg_paths(svg, scale=2, ss=3):
    W, H = [float(v) for v in re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg).groups()]
    k = scale * ss
    bg = re.search(r'<rect[^>]*fill="([^"]+)"', svg).group(1)
    img = Image.new("RGB", (int(W * k), int(H * k)), bg)
    tx = ty = 0
    for m in re.finditer(r'(<g transform="translate\(([\d.]+),([\d.]+)\)">)|(<path fill="([^"]+)"[^>]*d="([^"]*)")|(</g>)', svg):
        if m.group(1): tx, ty = float(m.group(2)), float(m.group(3))
        elif m.group(7): tx = ty = 0
        else:
            col, d = m.group(5), m.group(6)
            # even-odd via XOR mask (correct for both evenodd and nonzero-without-overlap glyphs)
            mask = Image.new("1", img.size, 0)
            for sp in _flatten(d):
                if len(sp) < 3: continue
                t = Image.new("1", img.size, 0)
                ImageDraw.Draw(t).polygon([((x + tx) * k, (y + ty) * k) for x, y in sp], fill=1)
                from PIL import ImageChops
                mask = ImageChops.logical_xor(mask, t)
            img.paste(Image.new("RGB", img.size, col), (0, 0), mask.convert("L"))
    return img.resize((int(W * scale), int(H * scale)), Image.LANCZOS)
