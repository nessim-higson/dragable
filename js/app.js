/* dragable — IAAH v7, rebuilt faithfully.
 *
 * Behavior transcribed from the decompiled original engine
 * (dragable.swf → com.ourvice.*, JPEXS export):
 *
 *   DynamicDrag   — elastic follow: pos += (goal − pos)/6 per frame @30fps;
 *                   after release it keeps easing toward the release point;
 *                   drag is UNBOUNDED (setRectLimitation never engaged).
 *   DragView      — a section is ONE horizontal strip: each slide placed at
 *                   a running x offset, vertically centered (y = −h/2);
 *                   slide focus = tween strip to (−slideX − focusX, −focusY),
 *                   2s, easeOutExpo (Tweener default); image fade-in 1s;
 *                   sequential load queue; auto-center slide 0 when loaded.
 *   Main          — current slide = hit-test against viewport center on
 *                   release; NEXT past last slide → next section (PREV
 *                   mirror); counter "n/m" inside BOTH edge tabs; tabs slide
 *                   out on hover (1s) and hide while dragging; drag-hint
 *                   follows the mouse elastically (/6) until first drag.
 *   MenuView      — menu opens on logo HOVER; closes when mouseX > 400 (or
 *                   below the list); scrim to 0.7 alpha in 2s; item colors
 *                   tween 1s (out/over/select); menu click fades the strip
 *                   (0.8s) before swapping; list scrolls by mouse position.
 *   BackGroundView— background color tween 2s.
 */

const stage = document.getElementById("stage");
const plane = document.getElementById("plane");
const hint = document.getElementById("hint");
const scrim = document.getElementById("scrim");
const menuEl = document.getElementById("menu");
const menuCol = document.getElementById("menu-col");
const logo = document.getElementById("logo");
const loadbar = document.getElementById("loadbar");
const tabPrev = document.getElementById("tab-prev");
const tabNext = document.getElementById("tab-next");
const counts = document.querySelectorAll(".edge-tab .count");

const FRAME = 1000 / 30;        // the original ran its easing per-frame at 30fps
const EASE = 1 / 6;             // DynamicDrag: distance/6 per frame
const TWEEN_S = 2000;           // Tweener slide/section tween: 2s
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

const SYS_SLUGS = new Set(["intro", "info", "what", "reel"]);

let site = null;
let menuId = 0;                 // current section
let id = 0;                     // current slide
let slides = [];                // runtime: {x,w,h,el,loaded}
let loadGen = 0;                // cancels stale load queues
let attract = true;             // pre-first-drag state (hint follows mouse)

/* ------------------------------------------------------------------
   camera
------------------------------------------------------------------- */
const cam = {
	x: 0, y: 0,
	mode: "idle",               // idle | drag | glide | tween
	goalX: 0, goalY: 0,         // drag/glide target
	grabX: 0, grabY: 0,         // pointer offset at grab
	t0: 0, fx: 0, fy: 0, tx: 0, ty: 0,
};

function tweenTo(x, y) {
	cam.mode = "tween";
	cam.t0 = performance.now();
	cam.fx = cam.x; cam.fy = cam.y;
	cam.tx = x; cam.ty = y;
}

let lastT = performance.now();
let pointer = { x: innerWidth / 2, y: innerHeight / 2 };
const hintPos = { x: innerWidth / 2, y: innerHeight / 2 };

function tick(now) {
	const dt = Math.min(100, now - lastT);
	lastT = now;
	const k = 1 - Math.pow(1 - EASE, dt / FRAME); // frame-rate-independent /6 @30fps

	if (cam.mode === "drag" || cam.mode === "glide") {
		if (cam.mode === "drag") {
			cam.goalX = pointer.x - cam.grabX;
			cam.goalY = pointer.y - cam.grabY;
		}
		cam.x += (cam.goalX - cam.x) * k;
		cam.y += (cam.goalY - cam.y) * k;
		if (cam.mode === "glide" && Math.abs(cam.goalX - cam.x) < 1 && Math.abs(cam.goalY - cam.y) < 1) {
			cam.mode = "idle";
		}
	} else if (cam.mode === "tween") {
		const p = Math.min(1, (now - cam.t0) / TWEEN_S);
		const e = easeOutExpo(p);
		cam.x = cam.fx + (cam.tx - cam.fx) * e;
		cam.y = cam.fy + (cam.ty - cam.fy) * e;
		if (p >= 1) cam.mode = "idle";
	}
	// left-anchored, TOP-aligned: the original DragView left every clip at
	// y=0 (its -height/2 was computed but never applied) with the container
	// at the stage top — slides share a common top edge and grow downward
	plane.style.transform = `translate3d(${cam.x}px, ${20 + cam.y}px, 0)`;

	// the drag hint chases the mouse with the same elastic /6
	if (attract) {
		hintPos.x += (pointer.x + 14 - hintPos.x) * k;
		hintPos.y += (pointer.y + 22 - hintPos.y) * k;
		hint.style.transform = `translate3d(${hintPos.x}px, ${hintPos.y}px, 0)`;
	}

	// menu autoscroll: speed proportional to distance from vertical center
	if (menuOpen && menuScrollMax > 0) {
		const v = (2 * pointer.y - innerHeight) / innerHeight; // −1 … 1
		menuScroll = Math.max(-menuScrollMax, Math.min(0, menuScroll - v * 14 * (dt / FRAME)));
		menuCol.style.transform = `translateY(${menuScroll}px)`;
	}
	requestAnimationFrame(tick);
}

/* ------------------------------------------------------------------
   drag (pointer events; touch behaves like the mouse did)
------------------------------------------------------------------- */
stage.addEventListener("pointerdown", (e) => {
	stage.setPointerCapture(e.pointerId);
	pointer = { x: e.clientX, y: e.clientY };
	cam.grabX = e.clientX - cam.x;
	cam.grabY = e.clientY - cam.y;
	cam.mode = "drag";
	stage.classList.add("dragging");
	document.body.classList.add("dragging"); // hides both tabs, as original
	endAttract();
});
addEventListener("pointermove", (e) => { pointer = { x: e.clientX, y: e.clientY }; });
function releaseDrag() {
	if (cam.mode !== "drag") return;
	cam.goalX = pointer.x - cam.grabX;   // keep gliding toward the release point
	cam.goalY = pointer.y - cam.grabY;
	cam.mode = "glide";
	stage.classList.remove("dragging");
	document.body.classList.remove("dragging");
	checkCurId();
}
stage.addEventListener("pointerup", releaseDrag);
stage.addEventListener("pointercancel", releaseDrag);

function endAttract() {
	if (!attract) return;
	attract = false;
	hint.classList.remove("on");
	stage.classList.remove("attract");
}

/* current slide = the one under the viewport center (Main.checkCurIdHandler) */
function checkCurId() {
	const cx = innerWidth / 2 - cam.x; // viewport center in plane coords
	const cy = innerHeight / 2 - 20 - cam.y;
	for (let i = 0; i < slides.length; i++) {
		const s = slides[i];
		if (!s.loaded) continue;
		if (cx >= s.x && cx < s.x + s.w && cy >= 0 && cy < s.h) {
			id = i;
			updateCounters();
			return;
		}
	}
}

/* ------------------------------------------------------------------
   strip building (DragView.setData + LoadQueue)
------------------------------------------------------------------- */
function el(html) {
	const t = document.createElement("template");
	t.innerHTML = html.trim();
	return t.content.firstElementChild;
}

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
	<p class="prev"><b>The previous site</b> <a href="https://archive.iamalwayshungry.com/sites/v7/">lives here</a></p>
</div>`;

let rufflePromise = null;
function ensureRuffle() {
	if (!rufflePromise) {
		window.RufflePlayer = window.RufflePlayer || {};
		window.RufflePlayer.config = {
			autoplay: "on", unmuteOverlay: "hidden", splashScreen: false,
			letterbox: "off", contextMenu: "rightClickOnly", logLevel: "error",
		};
		rufflePromise = new Promise((res, rej) => {
			const s = document.createElement("script");
			s.src = "/ruffle/ruffle.js";
			s.onload = res; s.onerror = rej;
			document.head.appendChild(s);
		});
	}
	return rufflePromise;
}

function flashCard(item, slide) {
	return el(`<div class="flash-card">
		<span class="k">original flash slide</span>
		This slide of <b>${item.title}</b> was an authored Flash animation
		(<code>${slide.src.split("/").pop()}</code>). It survives in the
		<a href="https://archive.iamalwayshungry.com/sites/v7/">emulated original</a>.
	</div>`);
}

function loadSection(index, { push = true } = {}) {
	const item = site.items[index];
	menuId = index;
	id = 0;
	const gen = ++loadGen;

	// background: 2s color tween (BackGroundView)
	document.body.style.backgroundColor = item.bg;
	const dark = luminance(item.bg) < 0.45;
	document.body.style.color = dark ? "#f2f2f2" : "#111111";

	menuSelect(index);
	if (push) history.pushState({}, "", `${basePath}${item.slug === "intro" ? "" : item.slug}`);
	document.title = `${item.title} — iamalwayshungry™ no.7`;

	// strip reset (DragView.setData: view.x = 0, alpha = 1)
	plane.textContent = "";
	plane.style.opacity = 1;
	cam.mode = "idle";
	cam.x = cam.y = 0;
	slides = item.slides.map((s) => ({ x: 0, el: null, loaded: false, ...s })); // keep authored w/h from the data
	updateCounters();

	// sequential load queue; each slide lands at the running x offset
	let xpos = 0;
	let done = 0;
	loadbar.classList.add("on");
	loadbar.style.width = "0";

	const place = (i, node, w, h) => {
		if (gen !== loadGen) return;
		const s = slides[i];
		s.w = w; s.h = h; s.x = xpos; s.loaded = true;
		xpos += Math.round(w);
		const holder = document.createElement("div");
		holder.className = "holder";
		holder.style.left = s.x + "px";
		holder.style.top = "0px"; // top-aligned, as the original engine laid slides
		holder.style.width = w + "px";
		holder.style.height = h + "px";
		holder.appendChild(node);
		plane.appendChild(holder);
		requestAnimationFrame(() => holder.classList.add("on")); // 1s fade
		s.el = holder;
		if (i === 0) tweenTo(-(s.x + (s.focusX || 0)), -(s.focusY || 0)); // auto-center slide 0
		done++;
		loadbar.style.width = (done / slides.length) * 100 + "%";
		if (done === slides.length) { loadbar.classList.remove("on"); }
		next(i + 1);
	};

	const next = (i) => {
		if (gen !== loadGen || i >= slides.length) return;
		const s = slides[i];
		if (s.type === "hello") {
			// one.swf's stage was exactly 760×640; the Click slide abuts at x=760
			place(i, el(s.html), 760, 640);
		} else if (s.flash) {
			const w = s.w || 760, h = s.h || 540;
			ensureRuffle().then(() => {
				if (gen !== loadGen) return;
				const player = window.RufflePlayer.newest().createPlayer();
				player.style.width = w + "px";
				player.style.height = h + "px";
				place(i, player, w, h); // attach first — Ruffle ignores load() on disconnected elements
				(player.ruffle ? player.ruffle() : player).load({ url: "/" + s.src });
			}).catch(() => place(i, flashCard(item, s), 720, 220));
		} else {
			const img = new Image();
			img.src = "/" + s.src;
			img.onload = () => place(i, img, img.naturalWidth, img.naturalHeight);
			img.onerror = () => place(i, el(`<div class="flash-card">missing: ${s.src}</div>`), 720, 220);
		}
	};
	next(0);
}

/* slide focus (DragView.updateCenterScroll / nextAdvanceCenter) */
function centerSlide(i) {
	const s = slides[i];
	tweenTo(-(s.x + (s.focusX || 0)), -(s.focusY || 0));
}

/* NEXT / PREV — exact Main.as logic incl. loaded/drag gates */
function nextKey() {
	if (cam.mode === "drag") return;
	if (id < slides.length - 1) {
		if (slides[id + 1].loaded) { id++; centerSlide(id); updateCounters(); }
	} else if (menuId < site.items.length - 1) {
		loadSection(menuId + 1);
	}
}
function prevKey() {
	if (cam.mode === "drag") return;
	if (id > 0) {
		if (slides[id - 1].loaded) { id--; centerSlide(id); updateCounters(); }
	} else if (menuId > 0) {
		loadSection(menuId - 1);
	}
}
tabNext.addEventListener("click", nextKey);
tabPrev.addEventListener("click", prevKey);
addEventListener("keydown", (e) => {
	if (e.key === "ArrowRight") nextKey();
	else if (e.key === "ArrowLeft") prevKey();
	else if (e.key === "Escape") closeMenu();
});

function updateCounters() {
	counts.forEach((c) => (c.textContent = `${id + 1}/${slides.length}`));
}

/* ------------------------------------------------------------------
   menu (MenuView): opens on logo hover, closes past x=400
------------------------------------------------------------------- */
let menuOpen = false;
let menuScroll = 0;
let menuScrollMax = 0;
let menuLinks = [];

function faceClass(face) {
	const f = (face || "").toLowerCase();
	if (f.includes("politica")) return "f-politica";
	if (f.includes("gotham")) return "f-gotham";
	if (f.includes("caslon")) return "f-caslon";
	return "f-gotham";
}

function buildMenu() {
	site.items.forEach((it, i) => {
		const a = document.createElement("a");
		a.href = `${basePath}${it.slug === "intro" ? "" : it.slug}`;
		a.className = faceClass(it.face);
		a.textContent = it.title;
		a.style.fontSize = (it.fontSize || 16) + "px";
		a.style.letterSpacing = (it.kerning || 0) + "px";
		const nextIsProject = SYS_SLUGS.has(it.slug) && site.items[i + 1] && !SYS_SLUGS.has(site.items[i + 1].slug);
		a.style.marginBottom = SYS_SLUGS.has(it.slug) ? (nextIsProject ? "26px" : "7px") : (it.space || 0) + "px";
		a.style.color = it.out || "#707171";
		a.addEventListener("mouseenter", () => { if (!a.classList.contains("selected")) a.style.color = it.over || "#000"; });
		a.addEventListener("mouseleave", () => { if (!a.classList.contains("selected")) a.style.color = it.out || "#707171"; });
		a.addEventListener("click", (e) => {
			e.preventDefault();
			if (a.classList.contains("selected")) return;
			// original: fade the strip 0.8s, then swap
			plane.style.opacity = 0;
			setTimeout(() => loadSection(i), 800);
		});
		menuCol.appendChild(a);
		menuLinks.push({ a, it });
	});
}

function menuSelect(index) {
	menuLinks.forEach(({ a, it }, i) => {
		const sel = i === index;
		a.classList.toggle("selected", sel);
		a.style.color = sel ? (it.select || "#fff") : (it.out || "#707171");
	});
}

function openMenu() {
	if (menuOpen) return;
	menuOpen = true;
	menuEl.hidden = false;
	requestAnimationFrame(() => {
		menuEl.classList.add("open");
		scrim.classList.add("on");
	});
	menuScroll = 0;
	menuScrollMax = Math.max(0, menuCol.scrollHeight + 60 - innerHeight);
	endAttract();
	addEventListener("mousemove", menuCloseWatch);
}
function closeMenu() {
	if (!menuOpen) return;
	menuOpen = false;
	menuEl.classList.remove("open");
	scrim.classList.remove("on");
	removeEventListener("mousemove", menuCloseWatch);
	setTimeout(() => { if (!menuOpen) menuEl.hidden = true; }, 1000);
}
function menuCloseWatch(e) {
	// MenuView.checkXpos: close when the mouse strays right of the column
	if (e.clientX > 400 || e.clientY > menuCol.scrollHeight + menuScroll + 150) closeMenu();
}
logo.addEventListener("mouseenter", openMenu);
logo.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu())); // touch

/* ------------------------------------------------------------------
   routing (SWFAddress semantics → History API)
------------------------------------------------------------------- */
const basePath = "/";
function indexFromLocation() {
	const legacy = location.hash.match(/^#\/([^/]+)/);
	if (legacy) {
		const i = site.items.findIndex((x) => x.deeplink.toLowerCase() === legacy[1].toLowerCase());
		if (i >= 0) return i;
	}
	const seg = location.pathname.slice(1).replace(/\/$/, "");
	const i = site.items.findIndex((x) => x.slug === seg);
	return i >= 0 ? i : 0;
}
addEventListener("popstate", () => loadSection(indexFromLocation(), { push: false }));

function luminance(hex) {
	const n = parseInt(hex.slice(1), 16);
	return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
}

/* ------------------------------------------------------------------
   boot
------------------------------------------------------------------- */
fetch("/data/site.json")
	.then((r) => r.json())
	.then((data) => {
		site = data;
		const intro = site.items.find((i) => i.slug === "intro");
		if (intro) intro.slides = [{ type: "hello", html: HELLO_HTML, focusX: 0, focusY: 0 }, ...intro.slides.filter((s) => !s.flash)];
		buildMenu();
		stage.classList.add("attract");
		hint.classList.add("on");
		loadSection(indexFromLocation(), { push: false });
		requestAnimationFrame((t) => { lastT = t; tick(t); });
		requestAnimationFrame(() => logo.classList.add("in")); // logo drops in (2s)
	});
