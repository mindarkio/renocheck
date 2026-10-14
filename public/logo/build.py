"""RenoCheck 裝修點評 mark — geometric construction on a 100-unit grid."""
import os
from shapely.geometry import Polygon, LineString, box, Point
from shapely.ops import unary_union
from shapely import affinity
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont, TTCollection
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.varLib import instancer

OUT = os.path.dirname(os.path.abspath(__file__))
BLUE, GREY, WHITE = "#2f5d8a", "#2b2f36", "#ffffff"
RED, RED_REV = "#d64532", "#ff8f7d"  # reversed tint for >=3:1 on blue
RES = 64  # arc resolution

def rounded(g, r_out, r_in):
    g = g.buffer(-r_out, resolution=RES).buffer(r_out, resolution=RES)   # round convex corners
    g = g.buffer(r_in, resolution=RES).buffer(-r_in, resolution=RES)     # fillet concave corners
    return g

def mark(variant="full"):
    # body: x 14..86, bottom radius 14
    R = 14
    body = unary_union([box(14, 40, 86, 92 - R), box(14 + R, 40, 86 - R, 92),
                        Point(14 + R, 92 - R).buffer(R, resolution=RES),
                        Point(86 - R, 92 - R).buffer(R, resolution=RES)])
    # gable roof: 45° pitch-ish, eaves overhang 6 each side with short drop
    roof = Polygon([(8, 44), (50, 8), (92, 44), (92, 50), (86, 50), (86, 44), (14, 44), (14, 50), (8, 50)])
    roof = Polygon([(7, 43), (50, 7), (93, 43), (93, 49), (14, 49), (14, 49), (7, 49)])
    # tail bottom-left, pointing down-left
    tail = Polygon([(22, 86), (44, 86), (22, 106)])
    shape = rounded(unary_union([body, roof, tail]), 2.6, 2.0)
    T = {"full": 7.5, "f32": 8.6, "f16": 11}[variant]
    shape_nt = rounded(unary_union([body, roof]), 2.6, 2.0)
    inner = shape_nt.buffer(-T, resolution=RES, join_style=1)
    # eaves stay as solid tabs: only hollow the area inside the body walls
    inner = inner.intersection(box(14 + T, 0, 86 - T, 120))
    inner = rounded(inner, 3.0, 0.5)
    outline = shape.difference(inner)
    if variant == "full":  lines = [(31, 69, 51), (31, 69, 61.5), (31, 55, 72)]; w = 6.4
    else:                  lines = [(29, 71, 47), (29, 71, 60), (29, 53, 73)]; w = 6.6
    bars = unary_union([LineString([(a, y), (b, y)]).buffer(w / 2, resolution=RES) for a, b, y in lines])
    return unary_union([outline, bars])


def bounds(g): return g.bounds

def ring_d(coords, f):
    pts = [f(x, y) for x, y in coords]
    return "M" + " L".join(f"{x:.2f},{y:.2f}" for x, y in pts) + " Z"

def geom_path(g, f=lambda x, y: (x, y)):
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    d = []
    for p in polys:
        d.append(ring_d(p.exterior.coords, f))
        d += [ring_d(i.coords, f) for i in p.interiors]
    return " ".join(d)

def draw_geom(dr, g, f, fill):
    # render with holes: fill exteriors, then knock holes using bg via mask
    from PIL import ImageChops
    polys = [g] if g.geom_type == "Polygon" else list(g.geoms)
    acc = Image.new("1", dr.im.size, 0)
    for p in polys:
        for ring in [p.exterior, *p.interiors]:
            t = Image.new("1", acc.size, 0)
            ImageDraw.Draw(t).polygon([f(x, y) for x, y in ring.coords], fill=1)
            acc = ImageChops.logical_xor(acc, t)
    dr.bitmap((0, 0), acc.convert("L"), fill=fill)

def paste_geom(img, g, ox, oy, s, color, ss=4):
    """Antialiased paste of geometry g (units) at (ox,oy) px with scale s px/unit."""
    x0, y0, x1, y1 = g.bounds
    W, H = int((x1 - x0) * s) + 4, int((y1 - y0) * s) + 4
    m = Image.new("L", (W * ss, H * ss), 0)
    draw_geom(ImageDraw.Draw(m), g, lambda x, y: (((x - x0) * s + 2) * ss, ((y - y0) * s + 2) * ss), 255)
    m = m.resize((W, H), Image.LANCZOS)
    img.paste(Image.new("RGB", (W, H), color), (int(ox + x0 * s - 2), int(oy + y0 * s - 2)), m)

M = mark()
BAR = LineString([(31, 72), (55, 72)]).buffer(3.2, resolution=RES)
MAIN = M.difference(BAR.buffer(0.3, resolution=RES))
MX0, MY0, MX1, MY1 = M.bounds
MW, MH = MX1 - MX0, MY1 - MY0
CX = (MX0 + MX1) / 2

# ---------- mark SVGs/PNGs ----------
def mark_svg(fg, bg, name, pad=14, acc=None):
    vb = (MX0 - pad, MY0 - pad, MW + 2 * pad, MH + 2 * pad)
    bgr = f'<rect x="{vb[0]}" y="{vb[1]}" width="{vb[2]}" height="{vb[3]}" fill="{bg}"/>' if bg else ""
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]:.2f} {vb[1]:.2f} {vb[2]:.2f} {vb[3]:.2f}">'
         f'{bgr}<path fill="{fg}" fill-rule="evenodd" d="{geom_path(MAIN)}"/><path fill="{acc or fg}" d="{geom_path(BAR)}"/></svg>')
    open(f"{OUT}/{name}.svg", "w").write(s)

def mark_png(fg, bg, name, size=1024, pad=0.14, acc=None):
    img = Image.new("RGB", (size, size), bg)
    s = size * (1 - 2 * pad) / max(MW, MH)
    paste_geom(img, MAIN, size / 2 - CX * s, size / 2 - (MY0 + MH / 2) * s, s, fg)
    paste_geom(img, BAR, size / 2 - CX * s, size / 2 - (MY0 + MH / 2) * s, s, acc or fg)
    img.save(f"{OUT}/{name}.png"); return img

for fg, bg, n, a in [(BLUE, WHITE, "mark-color-on-white", RED), (WHITE, BLUE, "mark-reversed-on-blue", RED_REV), ("#000000", WHITE, "mark-black", None)]:
    mark_svg(fg, bg, n, acc=a); mark_png(fg, bg, n, acc=a)
mark_svg(BLUE, None, "mark-color-transparent", acc=RED)
avatar = mark_png(WHITE, BLUE, "avatar-512", 512, pad=0.2, acc=RED_REV)

# ---------- favicons (hand-tuned variants) ----------
fav = {}
for px, var in [(32, "f32"), (16, "f16")]:
    g = mark(var); x0, y0, x1, y1 = g.bounds
    img = Image.new("RGB", (px, px), WHITE)
    s = (px - (2 if px == 32 else 1)) / max(x1 - x0, y1 - y0)
    # snap to whole pixels
    ox = round(px / 2 - (x0 + x1) / 2 * s); oy = round(px / 2 - (y0 + y1) / 2 * s)
    paste_geom(img, g, ox, oy, s, BLUE, ss=8)
    PX = {16: ["................", ".......##.......", "......####......", ".....##..##.....",
               "....##....##....", "...##......##...", "..###......###..", "...#.######.#...",
               "...#........#...", "...#.######.#...", "...#........#...", "...#.####...#...",
               "...#........#...", "...##########...", "...##...........", "...#............"],
          32: None}
    if px == 16:
        img = Image.new("RGB", (16, 16), WHITE)
        for yy, row in enumerate(PX[16]):
            for xx, c in enumerate(row):
                if c == "#": img.putpixel((xx, yy), (0xd6, 0x45, 0x32) if (yy == 11 and 5 <= xx <= 8) else (0x2f, 0x5d, 0x8a))
    else:  # 32: threshold-render at exact pixel grid (no AA) then clean
        g2 = mark("f32"); x0, y0, x1, y1 = g2.bounds; s2 = 30 / max(x1-x0, y1-y0)
        m = Image.new("L", (32*8, 32*8), 0)
        draw_geom(ImageDraw.Draw(m), g2, lambda x, y: (((x-x0)*s2 + (32-(x1-x0)*s2)/2)*8, ((y-y0)*s2+1)*8), 255)
        m = m.resize((32, 32), Image.BOX).point(lambda v: 255 if v > 110 else 0)
        img = Image.new("RGB", (32, 32), WHITE); img.paste(Image.new("RGB", (32, 32), BLUE), (0, 0), m)
        # recolour the bottom (shortest) bar: lowest bar pixels inside the walls
        bar_row = max(yy for yy in range(32) for xx in range(10, 22) if m.getpixel((xx, yy)) and yy < 26 and not m.getpixel((20, yy)) )
        rows = [yy for yy in range(bar_row - 3, bar_row + 1) if any(m.getpixel((xx, yy)) for xx in range(10, 18)) and not m.getpixel((20, yy))]
        for yy in rows:
            for xx in range(7, 19):
                if m.getpixel((xx, yy)): img.putpixel((xx, yy), (0xd6, 0x45, 0x32))
    img.save(f"{OUT}/favicon-{px}.png"); fav[px] = img
    open(f"{OUT}/favicon-{px}.svg", "w").write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{x0-2:.2f} {y0-2:.2f} {x1-x0+4:.2f} {y1-y0+4:.2f}"><path fill="{BLUE}" fill-rule="evenodd" d="{geom_path(g)}"/></svg>')
fav[32].save(f"{OUT}/favicon.ico", sizes=[(16, 16), (32, 32)], append_images=[fav[16]])

# ---------- type ----------
CJK = TTCollection("/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc")
cjk_idx = next(i for i, f in enumerate(CJK.fonts) if "TC" in f["name"].getDebugName(1))
cjk_font = CJK.fonts[cjk_idx]
GEIST_SRC = "/usr/share/fonts/truetype/sand-box/google/Geist/Geist-VariableFont_wght.ttf"
GEIST = f"{OUT}/.geist-600.ttf"
if not os.path.exists(GEIST):
    instancer.instantiateVariableFont(TTFont(GEIST_SRC), {"wght": 600}).save(GEIST)
geist_font = TTFont(GEIST)

def text_shape(font, text, size, tracking=0.0):
    """Return (list of (glyphname, x_offset_units)), width_px, scale; tracking in em."""
    upm = font["head"].unitsPerEm; cmap = font.getBestCmap(); hmtx = font["hmtx"]
    sc = size / upm; x = 0; out = []
    for i, ch in enumerate(text):
        gn = cmap[ord(ch)]; out.append((gn, x))
        x += hmtx[gn][0] + (tracking * upm if i < len(text) - 1 else 0)
    return out, x * sc, sc

def text_path(font, text, size, ox, baseline, tracking=0.0):
    gs = font.getGlyphSet(); glyphs, w, sc = text_shape(font, text, size, tracking); d = []
    for gn, x in glyphs:
        pen = SVGPathPen(gs)
        gs[gn].draw(TransformPen(pen, (sc, 0, 0, -sc, ox + x * sc, baseline)))
        d.append(pen.getCommands())
    return " ".join(d), w

def cap_height(font, size):
    os2 = font["OS/2"]; return getattr(os2, "sCapHeight", 0) * size / font["head"].unitsPerEm

def text_bbox_y(font, text, size):
    """ink top/bottom relative to baseline (y-down), units->px."""
    from fontTools.pens.boundsPen import BoundsPen
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); sc = size / font["head"].unitsPerEm
    lo, hi = 1e9, -1e9
    for ch in text:
        bp = BoundsPen(gs); gs[cmap[ord(ch)]].draw(bp)
        if bp.bounds: lo = min(lo, bp.bounds[1]); hi = max(hi, bp.bounds[3])
    return -hi * sc, -lo * sc

# ---------- lockups (built as SVG elements in px space, rendered to PNG via path rasterising) ----------
from svgpath_raster import raster_svg_paths  # small helper below

def lockup(kind, fg_mark, fg_cjk, fg_lat, bg, name, acc=None):
    U = 1.0  # 1 unit = 1 px at layout scale; mark height 100 units -> scale
    if kind == "h":
        mh = 200.0; s = mh / MH
        cjk_size = 84; lat_size = 36; trk = 0.32
        mx = 0; my = 0
        tx = MW * s + 0.36 * MW * s
        ct, cb = text_bbox_y(cjk_font, "裝修點評", cjk_size)
        lt, lb = text_bbox_y(geist_font, "RENOCHECK", lat_size)
        gap = 26
        block = (cb - ct) + gap + (lb - lt)
        top = (mh - block) / 2 - 4   # optical: nudge up slightly
        cjk_base = top - ct; lat_base = cjk_base + cb + gap - lt
        cd, cw = text_path(cjk_font, "裝修點評", cjk_size, tx, cjk_base)
        _, lw0, _ = text_shape(geist_font, "RENOCHECK", lat_size, 0)
        # stretch tracking so latin width == cjk width
        n = len("RENOCHECK") - 1
        trk = (cw * 0.96 - lw0) / n / lat_size
        ld, lw = text_path(geist_font, "RENOCHECK", lat_size, tx, lat_base, trk)
        W, H = tx + cw, mh
        mxo, myo = -MX0 * s, -MY0 * s
    else:
        mh = 220.0; s = mh / MH
        cjk_size = 78; lat_size = 33
        cd0, cw = text_path(cjk_font, "裝修點評", cjk_size, 0, 0)
        _, lw0, _ = text_shape(geist_font, "RENOCHECK", lat_size, 0)
        trk = (cw * 0.96 - lw0) / 8 / lat_size
        ct, cb = text_bbox_y(cjk_font, "裝修點評", cjk_size)
        lt, lb = text_bbox_y(geist_font, "RENOCHECK", lat_size)
        W = max(cw, MW * s)
        mxo = W / 2 - CX * s; myo = -MY0 * s
        cjk_base = mh + 46 - ct; lat_base = cjk_base + cb + 22 - lt
        cd, _ = text_path(cjk_font, "裝修點評", cjk_size, (W - cw) / 2, cjk_base)
        ld, lw = text_path(geist_font, "RENOCHECK", lat_size, (W - cw * 0.96) / 2, lat_base, trk)
        H = lat_base + lb
    pad = 60
    md = geom_path(MAIN, lambda x, y: (x * s + mxo + pad, y * s + myo + pad))
    bd = geom_path(BAR, lambda x, y: (x * s + mxo + pad, y * s + myo + pad))
    tr = f'transform="translate({pad},{pad})"'
    Wt, Ht = W + 2 * pad, H + 2 * pad
    bgr = f'<rect width="{Wt:.1f}" height="{Ht:.1f}" fill="{bg}"/>'
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {Wt:.1f} {Ht:.1f}" width="{Wt:.0f}" height="{Ht:.0f}">{bgr}'
           f'<path fill="{fg_mark}" fill-rule="evenodd" d="{md}"/><path fill="{acc or fg_mark}" d="{bd}"/>'
           f'<g {tr}><path fill="{fg_cjk}" d="{cd}"/><path fill="{fg_lat}" d="{ld}"/></g></svg>')
    open(f"{OUT}/{name}.svg", "w").write(svg)
    img = raster_svg_paths(svg, scale=2)
    img.save(f"{OUT}/{name}.png"); return img

LK = {}
LK["h"] = lockup("h", BLUE, BLUE, GREY, WHITE, "lockup-horizontal", RED)
LK["v"] = lockup("v", BLUE, BLUE, GREY, WHITE, "lockup-stacked", RED)
LK["hd"] = lockup("h", WHITE, WHITE, "#c9d6e3", BLUE, "lockup-horizontal-reversed", RED_REV)
LK["vd"] = lockup("v", WHITE, WHITE, "#c9d6e3", BLUE, "lockup-stacked-reversed", RED_REV)
lockup("v", "#000000", "#000000", "#000000", WHITE, "lockup-stacked-black")
LK["hm"] = lockup("h", "#000000", "#000000", "#000000", WHITE, "lockup-horizontal-black")

# ---------- overview ----------
OV = Image.new("RGB", (2400, 1900), "#f3f4f6")
d = ImageDraw.Draw(OV)
lab = ImageFont.truetype(GEIST_SRC, 22)
def card(x, y, w, h, im, label, bg=WHITE, fit=0.8, nearest=False):
    d.rectangle([x, y, x + w, y + h], fill=bg)
    r = min(w * fit / im.width, h * fit / im.height)
    im2 = im.resize((max(1, int(im.width * r)), max(1, int(im.height * r))), Image.NEAREST if nearest else Image.LANCZOS)
    OV.paste(im2, (x + (w - im2.width) // 2, y + (h - im2.height) // 2))
    d.text((x + 16, y + h + 8), label, fill="#555", font=lab)
y = 40
card(40, y, 560, 520, Image.open(f"{OUT}/mark-color-on-white.png"), "mark · #2f5d8a on white")
card(640, y, 560, 520, Image.open(f"{OUT}/mark-reversed-on-blue.png"), "mark · reversed (bar #ff8f7d)", bg=BLUE)
card(1240, y, 560, 520, Image.open(f"{OUT}/mark-black.png"), "mark · mono")
av = avatar.copy(); m = Image.new("L", av.size, 0); ImageDraw.Draw(m).ellipse([0, 0, 511, 511], fill=255)
avc = Image.new("RGB", av.size, WHITE); avc.paste(av, (0, 0), m)
card(1840, y, 520, 520, avc, "avatar 512 (circle crop preview)", fit=0.85)
y = 620
card(40, y, 1360, 420, LK["h"], "horizontal lockup", fit=0.85)
card(1440, y, 920, 860, LK["v"], "stacked lockup", fit=0.7)
y2 = 1100
card(40, y2, 1360, 380, LK["hd"], "horizontal · reversed", bg=BLUE, fit=0.85)
y3 = 1540
# favicons: actual size + 8x nearest
x = 40
for px in (16, 32):
    card(x, y3, 300, 300, fav[px], f"favicon {px}px @ {256//px*1 if px==32 else 16}x", nearest=True, fit=256 / 300 if px == 32 else 256 / 300)
    x += 340
d.rectangle([x, y3, x + 260, y3 + 300], fill=WHITE)
OV.paste(fav[16], (x + 60, y3 + 140)); OV.paste(fav[32], (x + 140, y3 + 132))
d.rectangle([x + 40, y3 + 200, x + 230, y3 + 240], fill="#dfe3e8")
OV.paste(fav[16], (x + 52, y3 + 212)); d.text((x + 76, y3 + 210), "RenoCheck", fill="#333", font=ImageFont.truetype(GEIST_SRC, 16))
d.text((x + 16, y3 + 308), "favicons at 1x + tab mock", fill="#555", font=lab)
x += 300
card(x, y3, 340, 300, LK["hm"], "lockup · mono", fit=0.85)
x += 380
small = Image.open(f"{OUT}/mark-color-on-white.png")
OV.save(f"{OUT}/overview.png")
print("done")
