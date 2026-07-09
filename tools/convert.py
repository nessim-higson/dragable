#!/usr/bin/env python3
"""Convert IAAH v7's blog_ourvice.xml into the rebuild's site.json.

The 2008 XML is hand-authored (loose entities, CDATA everywhere), so this
parses with regex rather than a strict XML parser.
"""
import json, re, sys, pathlib, zlib

SRC = pathlib.Path(sys.argv[1])

def swf_size(path):
    """Stage size in px from the SWF header RECT (twips)."""
    try:
        d = open(path, "rb").read()
        body = zlib.decompress(d[8:]) if d[:1] == b"C" else d[8:]
        nbits = body[0] >> 3
        bits = "".join(f"{b:08b}" for b in body[:32])[5:]
        vals = [int(bits[i*nbits:(i+1)*nbits], 2) for i in range(4)]
        return round((vals[1]-vals[0])/20), round((vals[3]-vals[2])/20)
    except Exception:
        return 760, 540
OUT = pathlib.Path(__file__).parent.parent / "data" / "site.json"

xml = SRC.read_text(encoding="utf-8", errors="replace")

def color(v):
    return "#" + v.replace("0x", "").zfill(6) if v else None

def slugify(deeplink):
    s = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "-", deeplink.strip())
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s or "untitled"

items = []
for m in re.finditer(r"<menuItem\s+([^>]*)>(.*?)</menuItem>", xml, re.S):
    attrs, body = m.group(1), m.group(2)
    deeplink = (re.search(r'deeplink="([^"]*)"', attrs) or [None, ""])[1]
    btn = re.search(r"<btn\s+([^>]*)>(.*?)</btn>\s*</btn>|<btn\s+([^>]*)>(.*?)</btn>", body, re.S)
    battrs = (btn.group(1) or btn.group(3) or "") if btn else ""
    binner = (btn.group(2) or btn.group(4) or "") if btn else ""
    title_m = re.search(r"<!\[CDATA\[(.*?)\]\]>", binner, re.S)
    title = title_m.group(1).strip() if title_m else deeplink
    def battr(name):
        r = re.search(rf'{name}="([^"]*)"', battrs)
        return r.group(1) if r else None
    bg = re.search(r'backGroundColor\s+color="([^"]*)"', body)
    slides = []
    for it in re.finditer(r'<item\s+([^>]*)>\s*<image><!\[CDATA\[([^\]]+)\]\]></image>', body):
        ia, path = it.group(1), it.group(2).strip()
        fx = re.search(r'focusX="(-?\d+)"', ia)
        fy = re.search(r'focusY="(-?\d+)"', ia)
        entry = {
            "src": path,
            "focusX": int(fx.group(1)) if fx else 0,
            "focusY": int(fy.group(1)) if fy else 0,
            "flash": path.lower().endswith(".swf"),
        }
        if entry["flash"]:
            w, h = swf_size(pathlib.Path(__file__).parent.parent / path)
            entry["w"], entry["h"] = w, h
        slides.append(entry)
    items.append({
        "deeplink": deeplink,
        "slug": slugify(deeplink),
        "title": title,
        "face": battr("face"),
        "fontSize": int(battr("fontSize") or 0) or None,
        "kerning": float(battr("kerning") or 0),
        "space": int(battr("spaceBelow") or 0),
        "out": color(battr("outcolor")),
        "over": color(battr("overcolor")),
        "select": color(battr("selectcolor")),
        "bg": color(bg.group(1)) if bg and bg.group(1) else "#ffffff",
        "slides": slides,
    })

mt = re.search(r'<menuTitle\s+([^>]*)>(.*?)</menuTitle>', xml, re.S)
def mattr(name):
    r = re.search(rf'{name}="([^"]*)"', mt.group(1)) if mt else None
    return r.group(1) if r else None
sc = re.search(r"<scrimColor>([^<]*)</scrimColor>", xml)
site = {
    "menuTitle": {
        "text": mt.group(2).strip() if mt else "ForWord",
        "face": mattr("face"),
        "fontSize": int(mattr("fontSize") or 34),
        "kerning": float(mattr("kerning") or 0),
        "space": int(mattr("spaceBelow") or 10),
    },
    "scrim": color(sc.group(1).strip()) if sc and sc.group(1).strip() else "#000000",
    "items": items,
}
OUT.write_text(json.dumps(site, indent=1), encoding="utf-8")
n_slides = sum(len(i["slides"]) for i in items)
n_flash = sum(1 for i in items for s in i["slides"] if s["flash"])
print(f"{len(items)} items, {n_slides} slides ({n_flash} flash placeholders) -> {OUT}")
