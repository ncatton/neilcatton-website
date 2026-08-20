/* One-shot migration: turns the 33 hand-written HTML files that were
   the site into src/pages/*.html source files for the build.

   It is kept in the repo as the record of exactly what was mechanical
   and what was hand-edited afterwards. It is not part of `npm run build`.

   Transforms applied:
     · strips the shared chrome (skip link, nav, footer, shared scripts)
       — the templates supply those now
     · unwraps <main>, so the detail pages' <h1> ends up inside it
     · rewrites relative hrefs to root-relative, one convention sitewide
     · replaces the hard-coded years-in-technology figure with a token
     · collapses neilcatton.substack.com onto writing.neilcatton.com
     · promotes <div class="section-label"> section headings on the
       detail pages to real <h2> elements
     · drops every CSS rule the shared stylesheet now owns
*/
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const EX = "tools/extract";
const OUT = "src/pages";
mkdirSync(OUT, { recursive: true });

const manifest = JSON.parse(readFileSync(join(EX, "manifest.json"), "utf8"));

/* Selectors the shared stylesheet owns. A page copy of any of these is
   drift, not intent — dropping it is the whole point of the exercise. */
const SHARED_SELECTOR_PATTERNS = [
  /^:root$/, /^html$/, /^body$/, /^\*/, /^:focus/, /^img/, /^\.visually-hidden/,
  /^\.skip-link/, /^\.site-nav/, /^\.nav-/, /^\.dropdown-/, /^\.btn-nav/,
  /^\.site-footer/, /^\.footer-/,
  /^\.btn$/, /^\.btn-primary/, /^\.btn-secondary/, /^\.btn-paper/, /^\.btn-ghost/,
  /^\.search-/, /^li\.nav-search-item/,
  /^\.breadcrumb/, /^\.detail-/, /^\.details-grid/, /^\.faq-/,
  /^\.engagement-cta/, /^\.form-field/, /^\.form-label/, /^\.form-input/,
  /^textarea\.form-input/, /^\.form-success/, /^\.form-error/, /^\.form-hp/,
  /^\.announce-/, /^\.section$/, /^\.section-inner/,
  /^\.marker-numeral/, /^\.related/, /^\.eyebrow/
];
const SHARED_ATRULES = [/^@keyframes (fadeInUp|fadeInDown|fadeIn|photoRise)$/, /^@media \(prefers-reduced-motion/];

function isShared(sel) {
  return sel.split(",").every((part) => {
    const p = part.trim();
    return SHARED_SELECTOR_PATTERNS.some((re) => re.test(p));
  });
}

/* ── CSS: parse, drop shared rules, re-emit ──────────────────────── */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function filterCss(css) {
  const src = stripComments(css);
  let out = "";
  let i = 0;

  function block(text) {
    let j = 0, res = "";
    while (j < text.length) {
      const k = text.indexOf("{", j);
      if (k === -1) break;
      const sel = text.slice(j, k).trim();
      if (sel.startsWith("@")) {
        let depth = 0, p = k;
        for (; p < text.length; p++) {
          if (text[p] === "{") depth++;
          else if (text[p] === "}") { depth--; if (depth === 0) break; }
        }
        const inner = text.slice(k + 1, p);
        if (SHARED_ATRULES.some((re) => re.test(sel))) { j = p + 1; continue; }
        if (/^@(keyframes|font-face|supports)/.test(sel)) {
          res += `${sel} {${inner}}\n`;
        } else {
          const kept = block(inner);
          if (kept.trim()) res += `${sel} {\n${kept}}\n`;
        }
        j = p + 1;
      } else {
        const p = text.indexOf("}", k);
        if (p === -1) break;
        const body = text.slice(k + 1, p).trim();
        if (!isShared(sel)) res += `  ${sel} { ${body.replace(/\s+/g, " ")} }\n`;
        j = p + 1;
      }
    }
    return res;
  }

  out = block(src);
  return out.trim();
}

/* ── HTML transforms ─────────────────────────────────────────────── */

const LOCAL_PAGES = new Set(readdirSync(".").filter((f) => f.endsWith(".html")).map((f) => f));

function rewriteLinks(html) {
  /* One URL convention sitewide. Four pages used root-relative hrefs
     and twenty-eight used relative ones. */
  html = html.replace(/(href|src|srcset|data-src)="([^"#?][^"]*)"/g, (whole, attr, val) => {
    if (/^(https?:|mailto:|tel:|\/|#|data:)/i.test(val)) return whole;
    const [pathPart, hash] = val.split("#");
    if (pathPart === "index.html") return `${attr}="/${hash ? "#" + hash : ""}"`;
    return `${attr}="/${val}"`;
  });
  html = html.replace(/href="index\.html(#[^"]*)?"/g, (whole, hash) => `href="/${hash || ""}"`);
  html = html.replace(/href="\/index\.html(#[^"]*)?"/g, (whole, hash) => `href="/${hash || ""}"`);
  /* One canonical Substack host. */
  html = html.replace(/https:\/\/neilcatton\.substack\.com/g, "https://writing.neilcatton.com");
  /* One skip-link target. */
  html = html.replace(/#main-content/g, "#main");
  return html;
}

function tokeniseFacts(html) {
  html = html.replace(/Thirty-(seven|eight|nine)\s+years/g, "{{years.Words}} years");
  html = html.replace(/thirty-(seven|eight|nine)\s+years/g, "{{years.words}} years");
  return html;
}

function unwrapMain(html) {
  return html.replace(/<main[^>]*>/g, "").replace(/<\/main>/g, "");
}

/* Section headings on the detail pages. These were <div> elements that
   looked like headings and were not: the five sections carrying the
   argument on every service page had no heading at all, so a screen
   reader user navigating by heading jumped from the h1 to the FAQ.
   WCAG 1.3.1 Info and Relationships. */
function promoteSectionLabels(html) {
  return html.replace(
    /<div class="section-label">([^<]{2,80})<\/div>/g,
    (whole, text) => `<h2 class="detail-section-heading">${text}</h2>`
  );
}

/* ── run ─────────────────────────────────────────────────────────── */

const DETAIL_PAGES = /^(service-|briefing-)/;
const report = [];

for (const [file, meta] of Object.entries(manifest)) {
  const slug = file.replace(/\.html$/, "");
  if (slug === "rate-limited") continue;   // rebuilt by hand, no chrome

  let body = readFileSync(join(EX, `${slug}.body.html`), "utf8");
  body = unwrapMain(body);
  body = rewriteLinks(body);
  body = tokeniseFacts(body);
  if (DETAIL_PAGES.test(slug)) body = promoteSectionLabels(body);
  body = body.replace(/\n{3,}/g, "\n\n").trim();

  const rawCss = existsSync(join(EX, `${slug}.css`)) ? readFileSync(join(EX, `${slug}.css`), "utf8") : "";
  const css = filterCss(rawCss);

  const front = {
    title: tokeniseFacts(meta.title || slug),
    description: tokeniseFacts(meta.description || ""),
    slug
  };
  if (meta.robots) front.robots = meta.robots;
  if (meta.og_image && !/og-image\.jpg$/.test(meta.og_image)) {
    front.ogImage = meta.og_image.replace("https://www.neilcatton.com", "");
  }
  if (meta.og_type && meta.og_type !== "website") front.ogType = meta.og_type;
  if (css) front.css = css;

  const out =
    `<!--page\n${JSON.stringify(front, null, 2)}\n-->\n${body}\n`;
  writeFileSync(join(OUT, `${slug}.html`), out);

  report.push({
    slug,
    body: body.length,
    cssBefore: rawCss.split("\n").length,
    cssAfter: css ? css.split("\n").length : 0
  });
}

const before = report.reduce((a, r) => a + r.cssBefore, 0);
const after = report.reduce((a, r) => a + r.cssAfter, 0);
console.log(`migrated ${report.length} pages`);
console.log(`inline CSS lines: ${before} -> ${after} (${Math.round(100 - (after / before) * 100)}% removed)`);
report.sort((a, b) => b.cssAfter - a.cssAfter).slice(0, 12)
  .forEach((r) => console.log(`  ${r.slug.padEnd(44)} ${String(r.cssBefore).padStart(4)} -> ${String(r.cssAfter).padStart(4)}`));
