/* dragable — IAAH v7 rebuilt.
   A draggable-canvas portfolio engine driven by data/site.json,
   transcribed from the 2008 original (dragable.swf + blog_ourvice.xml). */

const stage = document.getElementById("stage");
const plane = document.getElementById("plane");
const hint = document.getElementById("hint");
const counter = document.getElementById("count");
const sectionTitle = document.getElementById("section-title");
const menu = document.getElementById("menu");
const menuList = document.getElementById("menu-list");
const menuTitle = document.getElementById("menu-title");

const SYS_SLUGS = new Set(["intro", "info", "what", "reel"]);

let site = null;
let item = null;          // current section
let slideIdx = 0;

/* ------------------------------------------------------------------
   camera: position + inertia. The original engine tweened the plane
   with GreenSock; here a small critically-damped follow + decay.
------------------------------------------------------------------- */
const cam = {
	x: 0, y: 0,           // rendered position
	tx: 0, ty: 0,         // target position
	vx: 0, vy: 0,         // inertia velocity (px/frame)
	minX: 0, maxX: 0, minY: 0, maxY: 0,
	dragging: false,
};

function clampTargets() {
	cam.tx = Math.min(cam.maxX, Math.max(cam.minX, cam.tx));
	cam.ty = Math.min(cam.maxY, Math.max(cam.minY, cam.ty));
}

function tick() {
	if (!cam.dragging) {
		cam.tx += cam.vx;
		cam.ty += cam.vy;
		cam.vx *= 0.94;
		cam.vy *= 0.94;
		if (Math.abs(cam.vx) < 0.05) cam.vx = 0;
		if (Math.abs(cam.vy) < 0.05) cam.vy = 0;
		clampTargets();
	}
	cam.x += (cam.tx - cam.x) * 0.18;
	cam.y += (cam.ty - cam.y) * 0.18;
	plane.style.transform = `translate3d(${cam.x}px, ${cam.y}px, 0)`;
	requestAnimationFrame(tick);
}

/* pointer drag (mouse + touch unified) */
let last = null;
stage.addEventListener("pointerdown", (e) => {
	stage.setPointerCapture(e.pointerId);
	stage.classList.add("dragging");
	cam.dragging = true;
	cam.vx = cam.vy = 0;
	last = { x: e.clientX, y: e.clientY, t: performance.now() };
});
stage.addEventListener("pointermove", (e) => {
	if (!cam.dragging || !last) return;
	const dx = e.clientX - last.x;
	const dy = e.clientY - last.y;
	cam.tx += dx;
	cam.ty += dy;
	clampTargets();
	cam.vx = dx;
	cam.vy = dy;
	last = { x: e.clientX, y: e.clientY, t: performance.now() };
	hint.classList.add("gone");
});
function endDrag() {
	cam.dragging = false;
	stage.classList.remove("dragging");
	last = null;
}
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);

/* ------------------------------------------------------------------
   slide rendering
------------------------------------------------------------------- */
function setBounds(w, h) {
	const vw = innerWidth, vh = innerHeight;
	if (w <= vw) { cam.minX = cam.maxX = (vw - w) / 2; }
	else { cam.minX = vw - w; cam.maxX = 0; }
	if (h <= vh) { cam.minY = cam.maxY = (vh - h) / 2; }
	else { cam.minY = vh - h; cam.maxY = 0; }
}

function placeCamera(slide, w, h) {
	setBounds(w, h);
	// focusX/Y from the XML: the slide's authored starting offset.
	cam.tx = (innerWidth - w) / 2 + (slide.focusX || 0);
	cam.ty = (innerHeight - h) / 2 + (slide.focusY || 0);
	clampTargets();
	cam.x = cam.tx; cam.y = cam.ty;
	cam.vx = cam.vy = 0;
}

function el(html) {
	const t = document.createElement("template");
	t.innerHTML = html.trim();
	return t.content.firstElementChild;
}

function showSlide(idx, { immediate = false } = {}) {
	slideIdx = idx;
	const slide = item.slides[idx];
	counter.textContent = `${idx + 1}/${item.slides.length}`;
	plane.textContent = "";

	const mount = (node, w, h) => {
		node.classList.add("slide");
		plane.style.width = w + "px";
		plane.style.height = h + "px";
		plane.appendChild(node);
		placeCamera(slide, w, h);
		requestAnimationFrame(() => node.classList.add("on"));
	};

	if (slide.type === "hello") {
		const node = el(slide.html);
		plane.appendChild(node);
		const w = Math.max(node.offsetWidth, innerWidth * 0.86);
		const h = Math.max(node.offsetHeight, innerHeight * 0.8);
		node.remove();
		mount(node, w, h);
		return;
	}

	if (slide.flash) {
		const node = el(`<div class="flash-card">
			<span class="k">original flash slide</span>
			This slide of <b>${item.title}</b> was an authored Flash animation
			(<code>${slide.src.split("/").pop()}</code>). It lives on in the
			<a href="https://archive.iamalwayshungry.com/sites/v7/">emulated original</a> —
			a native conversion is on the rebuild roadmap.
		</div>`);
		plane.appendChild(node);
		const w = node.offsetWidth || 640, h = node.offsetHeight || 240;
		node.remove();
		mount(node, Math.max(w, innerWidth * 0.7), Math.max(h, innerHeight * 0.5));
		return;
	}

	const img = new Image();
	img.src = "/" + slide.src;
	if (img.complete) {
		mount(img, img.naturalWidth, img.naturalHeight);
	} else {
		img.onload = () => mount(img, img.naturalWidth, img.naturalHeight);
		img.onerror = () => mount(el(`<div class="flash-card">missing: ${slide.src}</div>`), 640, 240);
	}
	// warm the next slide
	const next = item.slides[idx + 1];
	if (next && !next.flash && !next.type) new Image().src = "/" + next.src;
}

/* ------------------------------------------------------------------
   sections + routing
------------------------------------------------------------------- */
function luminance(hex) {
	const n = parseInt(hex.slice(1), 16);
	const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function showItem(next, idx = 0, { push = true } = {}) {
	item = next;
	document.body.style.setProperty("--bg", item.bg);
	document.body.style.backgroundColor = item.bg;
	const dark = luminance(item.bg) < 0.45;
	document.body.style.setProperty("--ink", dark ? "#f2f2f2" : "#111111");
	document.body.style.color = dark ? "#f2f2f2" : "#111111";
	sectionTitle.textContent = SYS_SLUGS.has(item.slug) ? "" : item.title;
	if (push) history.pushState({}, "", `${basePath}${item.slug === "intro" ? "" : item.slug}`);
	document.title = `${item.title} — iamalwayshungry™ no.7`;
	closeMenu();
	showSlide(idx);
}

function step(dir) {
	let i = slideIdx + dir;
	if (i >= item.slides.length) {
		const n = site.items[(site.items.indexOf(item) + 1) % site.items.length];
		showItem(n, 0);
		return;
	}
	if (i < 0) {
		const p = site.items[(site.items.indexOf(item) - 1 + site.items.length) % site.items.length];
		showItem(p, p.slides.length - 1);
		return;
	}
	showSlide(i);
}

document.getElementById("tab-next").addEventListener("click", () => step(1));
document.getElementById("tab-prev").addEventListener("click", () => step(-1));
addEventListener("keydown", (e) => {
	if (e.key === "ArrowRight") step(1);
	else if (e.key === "ArrowLeft") step(-1);
	else if (e.key === "Escape") toggleMenu(false);
});

/* menu */
function toggleMenu(force) {
	const open = force !== undefined ? force : menu.hidden;
	menu.hidden = !open;
}
function closeMenu() { menu.hidden = true; }
document.getElementById("wordmark").addEventListener("click", () => toggleMenu());

function buildMenu() {
	menuTitle.textContent = site.menuTitle;
	for (const it of site.items) {
		const li = document.createElement("li");
		if (SYS_SLUGS.has(it.slug)) li.className = "sys";
		const a = document.createElement("a");
		a.href = `${basePath}${it.slug === "intro" ? "" : it.slug}`;
		a.textContent = it.title;
		a.style.color = it.out || "#707171";
		a.addEventListener("mouseenter", () => (a.style.color = it.over || "#000"));
		a.addEventListener("mouseleave", () => (a.style.color = it.out || "#707171"));
		a.addEventListener("click", (e) => {
			e.preventDefault();
			showItem(it, 0);
		});
		li.appendChild(a);
		menuList.appendChild(li);
	}
}

/* routing: clean slugs; legacy SWFAddress hashes (#/EasierThanReading/) redirect */
const basePath = location.pathname.replace(/[^/]*$/, "");
function itemFromLocation() {
	const legacy = location.hash.match(/^#\/([^/]+)/);
	if (legacy) {
		const found = site.items.find((i) => i.deeplink.toLowerCase() === legacy[1].toLowerCase());
		if (found) return found;
	}
	const seg = location.pathname.slice(basePath.length).replace(/\/$/, "");
	return site.items.find((i) => i.slug === seg) || site.items[0];
}
addEventListener("popstate", () => showItem(itemFromLocation(), 0, { push: false }));
addEventListener("resize", () => showSlide(slideIdx, { immediate: true }));

/* ------------------------------------------------------------------
   boot
------------------------------------------------------------------- */
const HELLO_HTML = `
<div class="hello">
	<p class="big">hello.</p>
	<h2>This is a website.</h2>
	<p>A seventh iteration of iamalwayshungry representing a bulk of work from 2008
	and some of 2009 in a temporary and experimental shell.</p>
	<hr class="rule">
	<p><b>Click and drag to navigate.</b><br>
	<b>Use tabs to the left and right or arrow keys to navigate quickly.</b></p>
	<hr class="rule">
	<p class="prev"><b>Rebuilt in 2026.</b> The emulated original
	<a href="https://archive.iamalwayshungry.com/sites/v7/">lives here</a>.</p>
</div>`;

fetch("/data/site.json")
	.then((r) => r.json())
	.then((data) => {
		site = data;
		// the INTRO section opens on the hello screen, then its images follow
		const intro = site.items.find((i) => i.slug === "intro");
		if (intro) intro.slides = [{ type: "hello", html: HELLO_HTML, focusX: 0, focusY: 0 }, ...intro.slides.filter((s) => !s.flash)];
		buildMenu();
		showItem(itemFromLocation(), 0, { push: false });
		tick();
	});
