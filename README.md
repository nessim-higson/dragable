# dragable — IAAH v7, rebuilt

The 2008–2009 iamalwayshungry portfolio ("a temporary and experimental
shell", engine: `dragable.swf`) rebuilt as a modern, dependency-free
web app. The content is a direct transcription of the original site's
`blog_ourvice.xml` — menu, colors, deep links, and per-slide camera
focus points — running on a hand-rolled inertial drag canvas.

The emulated original lives at
[archive.iamalwayshungry.com/sites/v7](https://archive.iamalwayshungry.com/sites/v7/).
Emulate to remember, rebuild to continue.

- `tools/convert.py` — XML → `data/site.json`
- `js/app.js` — camera, drag physics, router, menu
- `assets/` — original imagery, unmodified
- Flash-authored slides render as placeholders pending native conversion

Dev: `python3 -m http.server 4202` · Deploy: `./deploy.sh` (Cloudflare Pages)
