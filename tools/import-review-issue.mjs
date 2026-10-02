/* Import an issue of The Next Evolution Review into the site.
   ─────────────────────────────────────────────────────────────────
   node tools/import-review-issue.mjs "<folder holding the issue>" 01

   The Review is built outside this repo (OUTPUTS/The Next Evolution
   Review/build.py) and its HTML edition is a single self-contained
   file: four inline <style> blocks, style="" attributes, and Lato
   loaded from a file:// path on the machine that built it. Served
   under this site's Content-Security-Policy (style-src 'self') that
   file arrives as unstyled text. This script makes a copy the policy
   allows, without touching the Review's own build:

     1  every <style> block      → review/issue-NN/edition.css
     2  every style="" attribute → a generated class in that file
     3  @font-face file:// URLs  → the self-hosted files in src/assets/fonts
     4  empty page-reference links get a name a screen reader can say
     5  a viewport, canonical and Open Graph tags, the site favicon,
        a bar back to the Review page, and <main>
     6  the PDF and the two CSVs are copied beside it

   Output goes to review/issue-NN/ at the repo root, which build.mjs
   passes through to dist/ untouched. Add the issue to
   src/data/review.json afterwards: that file drives review.html, the
   sitemap and the search index.

   No dependencies. Re-running overwrites the previous import.
*/
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const [srcDir, nn] = process.argv.slice(2);
if (!srcDir || !/^\d\d$/.test(nn || "")) {
  console.error('usage: node tools/import-review-issue.mjs "<issue folder>" 01');
  process.exit(1);
}

const ORIGIN = JSON.parse(readFileSync(join(ROOT, "src/data/site.json"), "utf8")).origin;
const BASE = `/review/issue-${nn}`;
const OUT = join(ROOT, "review", `issue-${nn}`);

const files = readdirSync(srcDir);
const pick = (re, what) => {
  const hit = files.filter((f) => re.test(f));
  if (hit.length !== 1) throw new Error(`expected exactly one ${what} in ${srcDir}, found ${hit.length}`);
  return hit[0];
};
const htmlName = pick(/Issue-\d\d\.html$/, "HTML edition");
const pdfName = pick(/Issue-\d\d\.pdf$/, "PDF");
const ledgerName = pick(/-ledger\.csv$/, "ledger CSV");
const callsName = pick(/-calls\.csv$/, "calls CSV");

let html = readFileSync(join(srcDir, htmlName), "utf8");

/* ── 1. stylesheets out ──────────────────────────────────────────── */
const cssParts = [];
html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>\s*/g, (_, css) => { cssParts.push(css.trim()); return ""; });
if (!cssParts.length) throw new Error("no <style> blocks found; has the Review's build changed?");
let css = cssParts.join("\n\n");

/* ── 3. fonts ────────────────────────────────────────────────────── */
/* The source names files inside a fontsource package under /tmp. The
   same files are committed in src/assets/fonts. */
css = css.replace(/url\('file:\/\/[^']*\/([^/']+\.woff2)'\)/g, (_, file) => {
  if (!existsSync(join(ROOT, "src/assets/fonts", file))) throw new Error(`font ${file} is not in src/assets/fonts`);
  return `url('/assets/fonts/${file}')`;
});
if (/file:\/\//.test(css)) throw new Error("a file:// URL survived in the stylesheet");

/* Lora and Liberation Mono are system fonts where the PDF is built and
   are not on a reader's phone. Lora is self-hosted. Cousine is the
   metric-compatible twin of Liberation Mono, so it is served under that
   name and used only where the real one is not installed. */
const face = (family, file, weight, style, local) =>
  `@font-face{font-family:"${family}";src:${local ? `local("${local}"),` : ""}url('/assets/fonts/${file}') format('woff2');font-weight:${weight};font-style:${style};font-display:swap;}`;
const webFonts = [
  face("Lora", "lora-latin-400-normal.woff2", 400, "normal"),
  face("Lora", "lora-latin-400-italic.woff2", 400, "italic"),
  face("Lora", "lora-latin-700-normal.woff2", 700, "normal"),
  face("Lora", "lora-latin-700-italic.woff2", 700, "italic"),
  face("Liberation Mono", "cousine-latin-400-normal.woff2", 400, "normal", "Liberation Mono"),
  face("Liberation Mono", "cousine-latin-700-normal.woff2", 700, "normal", "Liberation Mono Bold")
].join("\n");

/* ── 2. style attributes → classes ───────────────────────────────── */
/* An inline style outranks every stylesheet rule, so the generated
   class repeats itself to stay on top of anything the issue's own CSS
   says about the same element. */
const styleClass = new Map();
html = html.replace(/<([a-zA-Z][\w-]*)((?:\s+[\w:-]+(?:="[^"]*")?)*?)\s+style="([^"]*)"((?:\s+[\w:-]+(?:="[^"]*")?)*)\s*>/g,
  (_, tag, before, style, after) => {
    const key = style.trim().replace(/;?\s*$/, ";");
    if (!styleClass.has(key)) styleClass.set(key, `st-${styleClass.size + 1}`);
    const cls = styleClass.get(key);
    let attrs = before + after;
    if (/\sclass="/.test(attrs)) attrs = attrs.replace(/\sclass="([^"]*)"/, (m, c) => ` class="${(c.trim() + " " + cls).trim()}"`);
    else attrs = ` class="${cls}"` + attrs;
    return `<${tag}${attrs}>`;
  });
if (/\sstyle="/.test(html)) throw new Error("a style attribute survived the conversion");
const styleRules = [...styleClass].map(([decl, cls]) => `.${cls}.${cls}.${cls}.${cls}{${decl}}`).join("\n");

/* ── 4. page references ──────────────────────────────────────────── */
/* In print these resolve to page numbers through target-counter(). On
   screen they are empty <a> elements showing an arrow from CSS, which a
   screen reader announces as "link" and nothing else. Name each one
   after the heading it points at. */
const text = (s) => s.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const headingFor = (id) => {
  const at = html.search(new RegExp(`\\sid="${id}"`));
  if (at < 0) throw new Error(`page reference to #${id} has no target`);
  const m = html.slice(at).match(/<h2[^>]*>([\s\S]*?)<\/h2>/);
  return m ? text(m[1]) : id;
};
html = html.replace(/<a class="pg" href="#([\w-]+)"><\/a>/g,
  (_, id) => `<a class="pg" href="#${id}" aria-label="Go to: ${headingFor(id).replace(/"/g, "&quot;")}"></a>`);

/* The ledger table gets a scroll container of its own. It is focusable
   and named so a keyboard user can reach and scroll it. */
html = html.replace(/<table class="ledger">[\s\S]*?<\/table>/g,
  (t) => `<div class="tscroll" role="region" aria-label="The ledger, as a table" tabindex="0">${t}</div>`);

/* ── 5. document shell ───────────────────────────────────────────── */
const title = text((html.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || `The Next Evolution Review, Issue ${nn}`);
const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
const url = `${ORIGIN}${BASE}/`;

const head = `
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="canonical" href="${url}">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/images/favicon/favicon-32x32.png">
<meta name="theme-color" content="#1A1C22">
<meta property="og:type" content="article">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title.replace(/"/g, "&quot;")}">
<meta property="og:description" content="${desc}">
<meta property="og:image" content="${ORIGIN}/images/social/og-image.jpg">
<meta property="og:site_name" content="Neil Catton">
<link rel="alternate" type="application/pdf" href="${BASE}/${pdfName}" title="PDF edition">
<link rel="stylesheet" href="${BASE}/edition.css">
<script defer data-domain="neilcatton.com" src="https://plausible.io/js/script.js"></script>
`;
html = html.replace(/<\/head>/, head + "</head>");

const links = `<a href="${BASE}/${pdfName}">PDF</a><a href="${BASE}/${ledgerName}">Ledger (CSV)</a><a href="${BASE}/${callsName}">Calls (CSV)</a>`;
const bar = (label) => `<nav class="webbar" aria-label="${label}"><a class="home" href="/review.html">The Next Evolution Review</a><span class="sp"></span>${links}</nav>`;

html = html
  .replace(/<body>/, `<body>\n<a class="webskip" href="#edition">Skip to the issue</a>\n${bar("This issue")}\n<main id="edition">`)
  .replace(/<\/body>/, `</main>\n${bar("This issue, repeated")}\n</body>`);

/* ── screen additions ────────────────────────────────────────────── */
/* The issue is laid out in millimetres for A4. These rules are only
   what a phone and the site's own checks need on top of that. */
const screen = `
/* ── added by tools/import-review-issue.mjs ── */
*,*::before,*::after{box-sizing:border-box;}
html{-webkit-text-size-adjust:100%;}
body{overflow-wrap:break-word;}
.webskip{position:absolute;left:-999px;top:0;background:#1A1C22;color:#FDFAF5;padding:10px 16px;
  font:700 13px/1 LatoM,sans-serif;z-index:10;}
.webskip:focus{left:8px;top:8px;}
.webbar{display:flex;flex-wrap:wrap;align-items:center;gap:4px 18px;padding:10px 22mm;background:#1A1C22;
  font:400 13px/1.3 LatoM,sans-serif;}
.webbar a{color:#E8B75A;text-decoration:none;min-height:28px;display:inline-flex;align-items:center;}
.webbar a:hover,.webbar a:focus-visible{text-decoration:underline;}
.webbar a.home{font-family:"Lora",serif;font-weight:700;font-size:15px;color:#FDFAF5;}
.webbar .sp{flex:1;}
a:focus-visible{outline:3px solid #C9973A;outline-offset:2px;}
a.pg{display:inline-block;min-width:24px;min-height:24px;text-align:center;text-decoration:none;}
table{max-width:100%;}
/* The cover and back page are a fixed 210mm wide for print. */
.cover,.back{width:auto;max-width:100%;position:relative;overflow:hidden;}
@media (max-width:860px){
  .webbar{padding:10px 8mm;}
  .webbar .sp{flex-basis:100%;height:0;}
  .cover,.back{padding:16mm 8mm 14mm 14mm;}
  .cover .mast h1{font-size:30pt;}
  .cover .theme h2,.back h2{font-size:19pt;}
  .cover .theme p,.back p{max-width:100%;}
  .back .inner{padding:0;}
  /* The glance ladder: name, squares and status stack instead of
     sitting on one line that is wider than a phone. */
  .lrow{flex-wrap:wrap;gap:2mm 4mm;}
  .lname{width:100%;}
  .lgates{flex:0 0 100%;flex-wrap:wrap;}
  .lout{width:100%;text-align:left;}
  .tscroll table.ledger{min-width:640px;}
}
/* The ledger has five columns and does not fold. It scrolls inside its
   own box, so the page itself never scrolls sideways. */
.tscroll{overflow-x:auto;max-width:100%;}
.tscroll:focus-visible{outline:3px solid #C9973A;outline-offset:2px;}
`;

mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "edition.css"), [webFonts, css, "/* former style attributes */", styleRules, screen].join("\n\n") + "\n");
writeFileSync(join(OUT, "index.html"), html);
for (const f of [pdfName, ledgerName, callsName]) copyFileSync(join(srcDir, f), join(OUT, f));

console.log(`issue ${nn}: ${basename(htmlName)} → review/issue-${nn}/  (${cssParts.length} style blocks, ${styleClass.size} distinct style attributes, PDF and 2 CSVs copied)`);
console.log(`title: ${title}`);
