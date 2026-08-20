/* ═══════════════════════════════════════════════════════════════════
   neilcatton.com — static site build

   Why this exists
   ---------------
   The site used to be 33 hand-edited HTML files, each carrying its own
   full copy of the shared CSS and JavaScript: 10,122 lines of inline
   CSS, 69% of it duplicated. Every shared fix was 33 fixes, and the
   failure mode was silent — `flex-wrap: wrap` reached six pages and
   not the other twenty-six, so most of the site scrolled sideways on
   a phone for months without anyone noticing.

   Everything shared now lives in exactly one place:
     src/assets/site.css        the design system
     src/assets/site.js         shared behaviour
     src/templates/             the document shell, nav and footer
     src/data/site.json         canonical facts and the nav definition
     src/data/services.json     the twelve service pages, as data

   Run
     npm run build     build once into dist/
     npm run serve     build, then serve dist/ on :8080
     npm run check     build, then run the accessibility and link checks

   No framework, no bundler, no dependencies at runtime. Templates are
   plain HTML files with ${...} JavaScript expressions in them, compiled
   with new Function. If you can read HTML you can edit them.
   ═══════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync, copyFileSync, lstatSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const DIST = join(ROOT, "dist");

const read = (p) => readFileSync(p, "utf8");
const readJSON = (p) => JSON.parse(read(p));

/* ── canonical facts ─────────────────────────────────────────────── */

const site = readJSON(join(SRC, "data/site.json"));

const NOW = new Date();
const BUILD_DATE = NOW.toISOString().slice(0, 10);

/* Years in technology, recalculated every build. Before this the site
   said "thirty-seven years" on twelve pages and "thirty-nine years" on
   one, and would have gone stale on 1 January regardless. */
const YEARS_NUM = NOW.getFullYear() - site.careerStartYear;
const WORDS = {
  20: "twenty", 30: "thirty", 40: "forty", 50: "fifty",
  1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
  6: "six", 7: "seven", 8: "eight", 9: "nine"
};
function numberToWords(n) {
  if (n < 20) return WORDS[n] || String(n);
  const tens = Math.floor(n / 10) * 10;
  const ones = n % 10;
  return ones ? `${WORDS[tens]}-${WORDS[ones]}` : WORDS[tens];
}
const YEARS_WORDS = numberToWords(YEARS_NUM);
const YEARS_WORDS_CAP = YEARS_WORDS.charAt(0).toUpperCase() + YEARS_WORDS.slice(1);
const DECADES_WORDS = numberToWords(Math.floor(YEARS_NUM / 10));

const FACTS = {
  "years": String(YEARS_NUM),
  "years.words": YEARS_WORDS,
  "years.Words": YEARS_WORDS_CAP,
  "decades.words": DECADES_WORDS,
  "sectors": site.sectorCount,
  "substack": site.substack,
  "substackName": site.substackName,
  "booking": site.booking,
  "formspree": site.formspree,
  "email": site.email,
  "origin": site.origin,
  "year": String(NOW.getFullYear()),
  "buildDate": BUILD_DATE
};

/** Resolve {{token}} references in page content and site strings. */
function resolveFacts(html) {
  return String(html).replace(/\{\{\s*([a-zA-Z.]+)\s*\}\}/g, (whole, key) => {
    if (key in FACTS) return FACTS[key];
    throw new Error(`Unknown fact token {{${key}}}`);
  });
}

/* jsonld is a JS object, not a rendered string, so resolveFacts never saw
   it — a token in a description feeding structured data (a service's
   schema.org Service.description, for one) was shipping as the literal
   text "{{years.words}}" rather than resolving. Walk it and resolve every
   string leaf. */
function resolveFactsDeep(value) {
  if (typeof value === "string") return resolveFacts(value);
  if (Array.isArray(value)) return value.map(resolveFactsDeep);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = resolveFactsDeep(v);
    return out;
  }
  return value;
}

/* site.json may use the same tokens — the Person description, for one. */
for (const key of ["description", "jobTitle"]) {
  if (site[key]) site[key] = resolveFacts(site[key]);
}

/* ── tiny template engine ────────────────────────────────────────── */
/* Templates are HTML with ${...} expressions. `d` is the page data,
   `s` the site data, `f` the resolved facts, `h` the helpers. */

const helpers = {
  esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  },
  /* Attributes for an outbound link. Every target="_blank" carries
     rel="noopener noreferrer" by construction, not by discipline. */
  ext(href) {
    return /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
  },
  abs(path) {
    if (!path) return site.origin + "/";
    if (/^https?:\/\//i.test(path)) return path;
    return site.origin + (path.startsWith("/") ? path : "/" + path);
  },
  json(obj) { return JSON.stringify(obj, null, 2); }
};

const templateCache = new Map();
function compile(name) {
  if (templateCache.has(name)) return templateCache.get(name);
  const src = read(join(SRC, "templates", name));
  let fn;
  try {
    /* A template is the body of a JavaScript template literal, so it
       supports ${...} expressions — including nested template literals,
       which is how the loops below are written. The consequence is that
       a template may not contain a stray backtick or backslash outside
       an expression. Neither appears in any template here; if you need
       one, use ${"\\"} or ${"`"}. */
    fn = new Function("d", "s", "f", "h", "partial", "return `" + src + "`;");
  } catch (err) {
    throw new Error(`Template ${name} failed to compile: ${err.message}`);
  }
  templateCache.set(name, fn);
  return fn;
}
function render(name, d) {
  return compile(name)(d, site, FACTS, helpers, (p, dd) => render(p, dd || d));
}

/* ── page sources ────────────────────────────────────────────────── */
/* Each file in src/pages is HTML preceded by a JSON front-matter block
   inside an HTML comment. Keeping it as a comment means the file is
   still openable in a browser and still highlights as HTML. */

function parsePage(file) {
  const raw = read(file);
  const m = raw.match(/^<!--\s*page\s*([\s\S]*?)-->\s*/);
  if (!m) throw new Error(`${basename(file)} has no <!--page ...--> front matter`);
  let meta;
  try { meta = JSON.parse(m[1]); }
  catch (err) { throw new Error(`${basename(file)} front matter is not valid JSON: ${err.message}`); }
  meta.content = raw.slice(m[0].length);
  meta.slug = meta.slug || basename(file, ".html");
  return meta;
}

/* ── build ───────────────────────────────────────────────────────── */

/* Copy a file or a directory tree, bytes only. fs.cpSync reproduces
   directory permissions, which fails outright on some network and FUSE
   mounts — including the one the Cowork desktop bridge uses. Nothing
   here needs the modes. */
function copyFile(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  try {
    copyFileSync(from, to);
  } catch (err) {
    /* copyFileSync uses kernel fast paths (copy_file_range, fcopyfile)
       that some FUSE mounts do not implement, and the failure surfaces
       as a misleading ENOENT on a file that reads perfectly well. Read
       and write the bytes instead. */
    writeFileSync(to, readFileSync(from));
  }
}

function copyInto(from, to) {
  const st = lstatSync(from);
  if (st.isDirectory()) {
    mkdirSync(to, { recursive: true });
    for (const entry of readdirSync(from)) copyInto(join(from, entry), join(to, entry));
  } else if (st.isFile()) {
    copyFile(from, to);
  }
}

function clean() {
  /* Deleting is not permitted everywhere this might run, and a stale
     dist/ is not fatal — the build overwrites everything it emits. */
  if (existsSync(DIST)) {
    try { rmSync(DIST, { recursive: true, force: true }); }
    catch (err) { console.warn(`could not clear dist/ (${err.code}) — overwriting in place`); }
  }
  mkdirSync(DIST, { recursive: true });
}

function copyStatic() {
  const passthrough = [
    "images", "downloads", ".well-known",
    "robots.txt", "favicon.ico", "apple-touch-icon.png"
  ];
  for (const item of passthrough) {
    const from = join(ROOT, item);
    if (!existsSync(from)) continue;
    copyInto(from, join(DIST, item));
  }

  /* Runtime JSON the browser fetches. site.json and services.json are
     build-time only and deliberately not published. */
  mkdirSync(join(DIST, "data"), { recursive: true });
  for (const f of ["announcements.json", "briefings.json", "practice-library.json"]) {
    copyFile(join(SRC, "data", f), join(DIST, "data", f));
  }
  /* Assets: stylesheets, scripts and fonts. */
  mkdirSync(join(DIST, "assets"), { recursive: true });
  for (const f of readdirSync(join(SRC, "assets"))) {
    copyInto(join(SRC, "assets", f), join(DIST, "assets", f));
  }
}

/** Which sitemap section a page belongs to, when it does not say. */
function groupFor(slug) {
  if (slug.startsWith("service-")) return "Services";
  if (slug.startsWith("briefing-")) return "Briefings";
  if (["privacy", "accessibility", "sitemap"].includes(slug)) return "This site";
  return "Main";
}

/** Which nav group, if any, is the current page inside. */
function sectionFor(slug) {
  for (const group of site.nav) {
    if (group.href && group.href === `/${slug}.html`) return group.id;
    if (group.items && group.items.some((i) => i.href === `/${slug}.html`)) return group.id;
  }
  if (slug.startsWith("service-")) return "services";
  if (slug.startsWith("briefing-")) return "writing";
  return null;
}

function buildPage(meta) {
  const slug = meta.slug;
  const path = slug === "index" ? "/" : `/${slug}.html`;

  /* A page may declare a layout and the data files it needs. That is
     how the Pattern Map, the Practice Library and the Briefings index
     get server-rendered: their card content used to be built in the
     browser from a JSON fetch, so with JavaScript off — and for any
     crawler that does not execute it — the pages were empty frames. */
  if (meta.layout) {
    const data = {};
    for (const name of meta.data || []) data[name] = readJSON(join(SRC, "data", `${name}.json`));
    meta = { ...meta, content: render(meta.layout, { ...meta, path, data, body: meta.content, allPages: meta.allPages || [] }) };
  }

  /* Page-specific CSS and JS go to their own files rather than inline
     <style>/<script> blocks. Two reasons: the CSP can then drop
     'unsafe-inline' from both script-src and style-src, and an external
     file gets cached instead of being re-sent with every page view. */
  const pageCss = (meta.css || "").trim();
  /* Page JS is written straight to a file rather than rendered through
     the ${...} template engine, so it needs its own resolveFacts pass —
     without it, a token used in page-level JS (the service selector's
     hardcoded descriptions, for one) shipped as literal "{{...}}" text. */
  const pageJs = resolveFacts((meta.js || "").trim());
  if (pageCss || pageJs) mkdirSync(join(DIST, "assets/pages"), { recursive: true });
  if (pageCss) writeFileSync(join(DIST, `assets/pages/${slug}.css`), pageCss + "\n");
  if (pageJs) writeFileSync(join(DIST, `assets/pages/${slug}.js`), pageJs + "\n");

  const page = {
    ...meta,
    path,
    canonical: meta.canonical === false ? null : helpers.abs(path),
    section: meta.section !== undefined ? meta.section : sectionFor(slug),
    ogType: meta.ogType || "website",
    ogImage: helpers.abs(meta.ogImage || site.ogImage),
    jsonld: resolveFactsDeep(meta.jsonld || []),
    hasPageCss: !!pageCss,
    hasPageJs: !!pageJs,
    content: resolveFacts(meta.content),
    bodyClass: meta.bodyClass || ""
  };
  if (page.description) page.description = resolveFacts(page.description);
  if (page.title) page.title = resolveFacts(page.title);

  const html = render("base.html", page);
  writeFileSync(join(DIST, `${slug}.html`), html);
  return page;
}

/* ── service pages, generated from data ──────────────────────────── */
/* Twelve near-identical documents differing in 47 lines out of 571.
   One template and one data file instead. */

function servicePages() {
  const services = readJSON(join(SRC, "data/services.json"));
  return services.map((svc) => {
    const slug = `service-${svc.id}`;
    const path = `/${slug}.html`;
    const content = render("layouts/service.html", { svc, slug, path });

    return {
      slug,
      title: `${svc.name} — ${site.name}`,
      searchTitle: svc.shortName || svc.name,
      description: svc.description,
      section: "services",
      ogType: "website",
      content,
      jsonld: [
        {
          "@context": "https://schema.org",
          "@type": "Service",
          name: svc.name,
          description: svc.description,
          serviceType: svc.serviceType || svc.name,
          areaServed: svc.areaServed || { "@type": "Country", name: "United Kingdom" },
          provider: { "@type": "Person", name: site.name, url: site.origin + "/" }
        },
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: site.origin + "/" },
            { "@type": "ListItem", position: 2, name: "Services", item: site.origin + "/services.html" },
            { "@type": "ListItem", position: 3, name: svc.name, item: site.origin + path }
          ]
        },
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: svc.faq.map((q) => ({
            "@type": "Question",
            name: q.q,
            acceptedAnswer: { "@type": "Answer", text: q.a }
          }))
        }
      ]
    };
  });
}

/* ── generated artefacts ─────────────────────────────────────────── */

function writeSitemapXml(pages) {
  const entries = pages
    .filter((p) => p.canonical && p.robots !== "noindex" && !String(p.robots || "").includes("noindex"))
    .map((p) => {
      const priority = p.path === "/" ? "1.0" : p.priority || "0.7";
      const freq = p.changefreq || (p.path === "/" ? "weekly" : "monthly");
      return `  <url>\n    <loc>${p.canonical}</loc>\n    <lastmod>${BUILD_DATE}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
    });
  writeFileSync(join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>\n`);
  return entries.length;
}

/* The search index used to be hand-maintained, so it drifted every
   time a page was added. It is now derived from the pages that exist. */
function writeSearchIndex(pages) {
  const list = pages
    .filter((p) => p.canonical && !String(p.robots || "").includes("noindex") && p.searchable !== false)
    .map((p) => ({
      title: (p.searchTitle || p.title || "").replace(/\s+—\s+Neil Catton$/, ""),
      url: p.path,
      description: p.description || ""
    }));
  mkdirSync(join(DIST, "data"), { recursive: true });
  writeFileSync(join(DIST, "data/search-pages.json"), JSON.stringify({ pages: list }, null, 2));
  return list.length;
}

/* An RSS feed for the sector briefings. They are the strongest
   proof-of-work asset on the site and there was previously no way to
   follow them, and nothing for an aggregator to read. */
function writeBriefingsFeed() {
  const f = join(SRC, "data/briefings.json");
  if (!existsSync(f)) return 0;
  const data = readJSON(f);
  const items = [].concat(data.briefings || [], data.collaborations || [])
    .filter((b) => b.page)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

  const xmlEsc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const body = items.map((b) => {
    const url = helpers.abs(b.page.startsWith("/") ? b.page : "/" + b.page);
    const date = b.date ? new Date(b.date + "T09:00:00Z").toUTCString() : NOW.toUTCString();
    return `    <item>\n      <title>${xmlEsc(b.title)}</title>\n      <link>${url}</link>\n      <guid isPermaLink="true">${url}</guid>\n      <pubDate>${date}</pubDate>\n      <description>${xmlEsc(b.standfirst || b.summary || "")}</description>\n    </item>`;
  }).join("\n");

  writeFileSync(join(DIST, "briefings.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">\n  <channel>\n    <title>Sector Briefings — ${xmlEsc(site.name)}</title>\n    <link>${site.origin}/briefings.html</link>\n    <atom:link href="${site.origin}/briefings.xml" rel="self" type="application/rss+xml" />\n    <description>One technology, one sector, one report. Built only on sources that can be checked.</description>\n    <language>en-GB</language>\n    <lastBuildDate>${NOW.toUTCString()}</lastBuildDate>\n${body}\n  </channel>\n</rss>\n`);
  return items.length;
}

/* ── run ─────────────────────────────────────────────────────────── */

function main() {
  const t0 = Date.now();
  clean();
  copyStatic();

  const pageFiles = readdirSync(join(SRC, "pages")).filter((f) => extname(f) === ".html").sort();
  const metas = pageFiles.map((f) => parsePage(join(SRC, "pages", f)));
  const generated = servicePages();
  const all = [...metas, ...generated];

  let built = all.map(buildPage);

  /* Second pass. The human-readable sitemap needs the finished page list,
     which does not exist until every page is built. Generating it removes
     the drift that a hand-maintained list guarantees. */
  const needsList = all.filter((m) => m.needsPageList);
  if (needsList.length) {
    const index = built.map((p) => ({
      slug: p.slug, path: p.path, title: p.searchTitle || (p.title || "").replace(/\s+—\s+Neil Catton$/, ""),
      description: p.description || "", robots: p.robots || "", group: p.sitemapGroup || groupFor(p.slug)
    })).filter((p) => !String(p.robots).includes("noindex"));
    for (const m of needsList) buildPage({ ...m, allPages: index });
  }

  const nSitemap = writeSitemapXml(built);
  const nSearch = writeSearchIndex(built);
  const nFeed = writeBriefingsFeed();

  const ms = Date.now() - t0;
  console.log(
    `built ${built.length} pages ` +
    `(${metas.length} authored + ${generated.length} generated) · ` +
    `sitemap ${nSitemap} · search index ${nSearch} · briefings feed ${nFeed} · ` +
    `${YEARS_NUM} years since ${site.careerStartYear} · ${ms}ms`
  );
}

main();
