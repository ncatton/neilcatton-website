/* Accessibility and reflow gate.
   ─────────────────────────────────────────────────────────────────
   Run after a build:  node tools/check-a11y.mjs
   Exits non-zero on any violation, so it can gate a deploy.

   Three checks per page, at a phone width and a desktop width:

     1. axe-core, WCAG 2.0/2.1/2.2 A and AA
     2. horizontal overflow — scrollWidth against clientWidth. This is
        the check that would have caught the missing flex-wrap on
        .footer-links, which left 26 of 33 pages scrolling sideways on
        a phone for months across four manual audit passes.
     3. standalone links and buttons below the 24×24 CSS-pixel target
        minimum (WCAG 2.2 SC 2.5.8). Links inline in a paragraph are
        exempt and are skipped.

   Requires: npm install (playwright, axe-core), and a built dist/.
*/
import { chromium } from "playwright";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PORT = 8123;
const WIDTHS = [375, 1280];

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".xml": "application/xml", ".pdf": "application/pdf",
  ".txt": "text/plain", ".webmanifest": "application/manifest+json"
};

function serve() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let p = decodeURIComponent(req.url.split("?")[0]);
      if (p.endsWith("/")) p += "index.html";
      const file = join(DIST, p);
      if (!existsSync(file) || !file.startsWith(DIST)) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
      res.end(readFileSync(file));
    });
    server.listen(PORT, () => resolve(server));
  });
}

const pages = readdirSync(DIST).filter((f) => extname(f) === ".html").sort();
const axeSrc = readFileSync(join(ROOT, "node_modules/axe-core/axe.min.js"), "utf8");

const server = await serve();
/* CHROMIUM_PATH lets this run against a system Chromium (CI images and
   sandboxes often ship one) instead of Playwright's own download. */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const failures = [];
let checks = 0;

for (const page of pages) {
  for (const width of WIDTHS) {
    /* reducedMotion makes the run deterministic: the site's entrance
       animations start at opacity:0, and axe reads that as a contrast
       failure if it happens to sample mid-animation. The site honours
       prefers-reduced-motion, so this also exercises that path. */
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const p = await ctx.newPage();
    await p.goto(`http://localhost:${PORT}/${page}`, { waitUntil: "load" });
    await p.waitForTimeout(700);
    checks++;

    /* 1 — axe */
    await p.addScriptTag({ content: axeSrc });
    const res = await p.evaluate(async () =>
      await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } }));
    for (const v of res.violations) {
      failures.push({ page, width, kind: `axe:${v.id}`, detail: `${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"}) — ${(v.nodes[0].html || "").slice(0, 110)}` });
    }

    /* 2 — reflow */
    const flow = await p.evaluate(() => {
      const cw = document.documentElement.clientWidth;
      const sw = document.documentElement.scrollWidth;
      if (sw <= cw + 1) return null;
      const offenders = [];
      document.querySelectorAll("*").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && r.right > cw + 1) {
          offenders.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} (right ${Math.round(r.right)}px)`);
        }
      });
      return { sw, cw, offenders: [...new Set(offenders)].slice(0, 5) };
    });
    if (flow) {
      failures.push({ page, width, kind: "reflow", detail: `scrollWidth ${flow.sw}px against clientWidth ${flow.cw}px — ${flow.offenders.join(", ")}` });
    }

    /* 3 — target size */
    const small = await p.evaluate(() => {
      const out = [];
      document.querySelectorAll("a[href], button, summary, input, select, textarea").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        /* Not a target if it is not reachable: honeypots, decorative
           duplicates already removed from the tab order, hidden nodes. */
        if (el.getAttribute("tabindex") === "-1") return;
        if (el.closest('[aria-hidden="true"], [hidden]')) return;
        if (r.height >= 24 && r.width >= 24) return;
        /* SC 2.5.8 exempts links whose target is inline in a sentence. */
        const parent = el.parentElement;
        if (el.tagName === "A" && parent && /^(P|LI|SPAN|EM|STRONG|TD)$/.test(parent.tagName)) {
          const txt = (parent.textContent || "").trim();
          if (txt.length > (el.textContent || "").trim().length + 12) return;
        }
        out.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} "${(el.textContent || "").trim().slice(0, 28)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
      });
      return [...new Set(out)];
    });
    for (const s of small) failures.push({ page, width, kind: "target-size", detail: s });

    await ctx.close();
  }
}

await browser.close();
server.close();

const byKind = {};
for (const f of failures) byKind[f.kind] = (byKind[f.kind] || 0) + 1;

console.log(`checked ${pages.length} pages at ${WIDTHS.join("px and ")}px — ${checks} page loads`);
if (!failures.length) {
  console.log("PASS — no axe violations, no horizontal overflow, no undersized targets");
  process.exit(0);
}
console.log(`\nFAIL — ${failures.length} finding${failures.length === 1 ? "" : "s"}`);
for (const [kind, n] of Object.entries(byKind).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${kind}`);
console.log("");
for (const f of failures.slice(0, 60)) console.log(`  [${f.kind}] ${f.page} @${f.width}px\n        ${f.detail}`);
if (failures.length > 60) console.log(`  … and ${failures.length - 60} more`);
process.exit(1);
