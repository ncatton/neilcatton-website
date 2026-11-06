/* Builds the downloadable PDFs into downloads/:
     neil-catton-<service>.pdf            one A4 page per service, read from the built service page
     neil-catton-how-an-engagement-runs.pdf   one A4 page, from print/engagement.json
     neil-catton-engagement-guide.pdf     overview plus a page per phase, from print/engagement.json
   Run with `npm run pdfs` (it builds the site first). Needs the playwright dev dependency.
   The one-pagers have no words of their own: change a service page and rerun this, and the PDF follows.
   Each one-pager must fit one page. If it doesn't, the type steps down a little; below 90% it fails. */
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist"), OUT = join(ROOT, "downloads");
const site = JSON.parse(readFileSync(join(ROOT, "src/data/site.json"), "utf8"));
const arc = JSON.parse(readFileSync(join(ROOT, "print/engagement.json"), "utf8"));
const years = new Date().getFullYear() - site.careerStartYear;
const fill = (s) => s.replace(/\{\{years\}\}/g, String(years)).replace(/\{\{sectors\}\}/g, site.sectorCount);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const host = site.substack.replace(/^https?:\/\//, "");
const BOOKS = "Author of The Next Evolution, The Cognitive Crucible, The Shadow System, Working as Designed and Predictive Purpose";

if (!existsSync(join(DIST, "services.html"))) { console.error("No dist/. Run npm run build first."); process.exit(1); }

/* Serve dist at the root (so /assets/fonts.css works) and print/ at /print/. */
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".png": "image/png", ".json": "application/json" };
const server = createServer((q, r) => {
  const u = decodeURIComponent(q.url.split("?")[0]);
  const f = u.startsWith("/print/") ? join(ROOT, u) : join(DIST, u === "/" ? "index.html" : u);
  if (existsSync(f) && statSync(f).isFile()) { r.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream" }); r.end(readFileSync(f)); }
  else { r.writeHead(404); r.end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

const head = (title) => `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="stylesheet" href="${BASE}/assets/fonts.css"><link rel="stylesheet" href="${BASE}/print/print.css"></head><body>`;
const close = (url) => `<footer class="bottom">
  <div class="close">
    <div><p class="close-h">One conversation.</p><p class="close-p">No obligation. The right fit matters more than the right brochure.</p></div>
    <div class="cta"><a class="cta-b" href="${esc(site.booking)}">Book a call →</a><span class="cta-l"><a href="mailto:${site.email}">${site.email}</a> · <a href="${esc(url)}">${esc(url.replace(/^https:\/\//, ""))}</a></span></div>
  </div>
  <p class="foot"><span>${site.name} · Independent technology strategist · ${BOOKS}</span><a href="${site.substack}">${host}</a></p>
</footer>`;

/* What a service page says, read from the built page. */
function readService() {
  const T = (e) => (e ? e.textContent.replace(/\s+/g, " ").trim() : "");
  const m = document.querySelector("main");
  const secs = [...m.querySelectorAll(":scope > section")];
  const sec = (l) => secs.find((s) => T(s.querySelector(".label")).toLowerCase().startsWith(l));
  const fam = sec("sound familiar"), runs = sec("how it runs"), ch = sec("what changes"), pr = sec("what this draws on") || sec("done before");
  const step = (li) => { const sub = li.querySelector(".dotsub"); return [T(li).replace(T(sub), "").trim(), T(sub)]; };
  return {
    name: T(m.querySelector("h1")),
    promise: T(m.querySelector(".sv-lead")),
    facts: [...m.querySelectorAll(".fact")].map((f) => { const c = [...f.children]; return [T(c[0]), T(c[c.length - 1])]; }),
    fam: [...fam.querySelectorAll(".fam-i")].map(T), famP: T(fam.querySelector(".fam-p")),
    strap: T(runs.querySelector(".h2")),
    steps: [...runs.querySelectorAll(".dotstep")].map(step),
    cadence: [...runs.querySelectorAll(".viz-2 > div")].map((d) => [T(d.querySelector(".viz-t")), T(d.querySelector(".viz-big"))]),
    coversTitle: T(runs.querySelector(".sv-cov")), covers: [...runs.querySelectorAll(".covers li")].map(T),
    changes: [...ch.querySelectorAll(".ba-r")].map((r) => [T(r.querySelector(".ba-b")).replace(/^Before\s*/, ""), T(r.querySelector(".ba-a")).replace(/^After\s*/, "")]),
    proofLabel: T(pr.querySelector(".label")),
    proofs: [...pr.querySelectorAll(".proof")].map((p) => [T(p.querySelector(".proof-n")), T(p.querySelector(".proof-c")), T(p.querySelector(".proof-s"))])
  };
}

function onePager(d, url) {
  const how = d.steps.length
    ? `<ol class="steps">${d.steps.map(([t, s]) => `<li><b>${esc(t)}.</b> ${esc(s)}</li>`).join("")}</ol>`
    : `<ul class="steps cadence">${d.cadence.map(([t, s]) => `<li><b>${esc(t)}</b>${s ? esc(s) : ""}</li>`).join("")}</ul>`;
  return `${head(d.name + " — Neil Catton")}<div class="sheet">
<header class="top"><div class="row"><span class="brand">${site.name}</span><span class="kind">Services · One-page summary</span></div>
  <h1>${esc(d.name)}</h1><p class="promise">${esc(d.promise)}</p></header>
<dl class="facts">${d.facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
<div class="body">
  <section class="col">
    <h2 class="k">Sound familiar?</h2>
    <ul class="fam">${d.fam.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="fam-p">${esc(d.famP)}</p>
    <h2 class="k">How it runs</h2>
    <p class="strap">${esc(d.strap)}</p>
    ${how}
    <h3 class="k2">${esc(d.coversTitle)}</h3>
    <ul class="covers">${d.covers.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
  </section>
  <section class="col">
    <h2 class="k">What changes</h2>
    <div class="ba-head"><span>Before</span><span></span><span>After</span></div>
    <ul class="ba">${d.changes.map(([b, a]) => `<li><span class="b">${esc(b)}</span><span class="arr">→</span><span class="a">${esc(a)}</span></li>`).join("")}</ul>
    <h2 class="k">${esc(d.proofLabel)}</h2>
    <ul class="proofs">${d.proofs.map(([n, c, s]) => `<li><span class="n${n.length > 6 ? " long" : ""}">${esc(n)}</span><span>${esc(c)}<span class="s">${esc(s)}</span></span></li>`).join("")}</ul>
  </section>
</div>
${close(url)}</div></body></html>`;
}

const arcList = (on = -1) => `<ol class="arc">${arc.phases.map((p, i) => `<li${i === on ? ' class="on"' : ""}><span class="an">${esc(p.name)}</span><span class="at">${esc(p.when)}</span></li>`).join("")}</ol>`;

function overviewSheet(kind) {
  return `<div class="sheet">
<header class="top"><div class="row"><span class="brand">${site.name}</span><span class="kind">${kind}</span></div>
  <h1>${esc(arc.title)}</h1><p class="promise">${esc(arc.standfirst)}</p></header>
<div class="wide">
  ${arcList()}
  <p class="found">${esc(fill(arc.foundation))}</p>
  <ol class="phases">${arc.phases.map((p, i) => `<li><span class="pn">0${i + 1}</span><span class="pt">${esc(p.name)}</span>${esc(p.summary)}</li>`).join("")}</ol>
</div>
${close(site.origin + "/services.html")}</div>`;
}

function phaseSheet(p, i) {
  const last = i === arc.phases.length - 1;
  return `<div class="sheet">
<header class="top"><div class="row"><span class="brand">${site.name}</span><span class="of">How an engagement runs · Phase ${i + 1} of ${arc.phases.length}</span></div>
  <div class="phase-top"><span class="big-n">0${i + 1}</span><div><h1>${esc(p.name)}</h1><p class="promise">${esc(p.sub)}</p></div></div></header>
<div class="guide-body">
  <section>
    <p class="desc">${esc(p.description)}</p>
    <h2 class="k" style="margin-top:7mm">Key activities</h2>
    <ul class="acts">${p.activities.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
  </section>
  <aside class="side">
    <h2 class="k">Timeframe</h2><p>${esc(p.timeframe)}</p>
    <h2 class="k">Deliverables</h2><ul class="acts">${p.deliverables.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>
  </aside>
</div>
<div class="wide mini">${arcList(i)}</div>
${last ? close(site.origin + "/services.html") : `<footer class="bottom"><p class="foot" style="margin:0;border:0;padding:0"><span>${site.name} · Independent technology strategist · ${site.origin.replace(/^https:\/\//, "")}</span><span>${i + 2 < 10 ? "0" : ""}${i + 1} / 0${arc.phases.length}</span></p></footer>`}
</div>`;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const fits = () => [...document.querySelectorAll(".sheet")].every((s) => [...s.children].every((c) => c.scrollHeight <= c.clientHeight + 1) && s.scrollHeight <= s.clientHeight + 1);
async function pdf(html, file, pages) {
  for (let s = 1; s >= 0.9; s = Math.round((s - 0.03) * 100) / 100) {
    await page.setContent(html.replace("<body>", `<body style="--s:${s}">`), { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    if (process.env.PDF_DEBUG) console.log(file, s, await page.evaluate(() => [...document.querySelectorAll(".sheet")].flatMap((sh, k) => [[k, "sheet", sh.scrollHeight, sh.clientHeight], ...[...sh.children].map((c) => [k, c.className, c.scrollHeight, c.clientHeight])]).filter((x) => x[2] > x[3] + 1)));
    if (await page.evaluate(fits)) {
      await page.pdf({ path: join(OUT, file), format: "A4", printBackground: true, preferCSSPageSize: true });
      console.log(`  ${file}  ${pages} page${pages > 1 ? "s" : ""}${s < 1 ? `  (type at ${Math.round(s * 100)}%)` : ""}`);
      return;
    }
  }
  throw new Error(`${file}: does not fit. Shorten the source page or the print layout.`);
}

const services = readdirSync(DIST).filter((f) => /^service-.+\.html$/.test(f)).sort();
console.log(`Building ${services.length + 2} PDFs into downloads/`);
for (const f of services) {
  await page.goto(`${BASE}/${f}`, { waitUntil: "domcontentloaded" });
  const d = await page.evaluate(readService);
  for (const k of ["name", "promise", "strap", "proofLabel"]) if (!d[k]) throw new Error(`${f}: no ${k} found. Has the page layout changed?`);
  if (d.facts.length !== 4 || !d.fam.length || !d.changes.length || !d.proofs.length || !(d.steps.length || d.cadence.length)) throw new Error(`${f}: a section is missing.`);
  const slug = f.slice("service-".length, -5);
  await pdf(onePager(d, `${site.origin}/${f}`), `neil-catton-${slug}.pdf`, 1);
}
await pdf(head("How an engagement runs — Neil Catton") + overviewSheet("Practice overview") + "</body></html>", "neil-catton-how-an-engagement-runs.pdf", 1);
await pdf(head("How an engagement runs: the guide — Neil Catton") + overviewSheet("The engagement guide") + arc.phases.map(phaseSheet).join("") + "</body></html>", "neil-catton-engagement-guide.pdf", 1 + arc.phases.length);
await browser.close();
server.close();
