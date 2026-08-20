/* Serves dist/ with the exact Content-Security-Policy from netlify.toml
   and reports anything the browser blocks. Run before trusting a CSP
   change; the previous policy carried 'unsafe-inline' on script-src and
   style-src, and this pass removed both. */
import { chromium } from "playwright";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const PORT = 8124;

const toml = readFileSync(join(ROOT, "netlify.toml"), "utf8");
const CSP = (toml.match(/Content-Security-Policy = "([^"]+)"/) || [])[1];
if (!CSP) { console.error("no CSP found in netlify.toml"); process.exit(2); }
console.log("policy under test:\n  " + CSP.replace(/; /g, ";\n  ") + "\n");

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png",
  ".jpg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".xml": "application/xml", ".pdf": "application/pdf",
  ".txt": "text/plain", ".webmanifest": "application/manifest+json"
};

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p.endsWith("/")) p += "index.html";
  const file = join(DIST, p);
  if (!existsSync(file) || !file.startsWith(DIST)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream", "Content-Security-Policy": CSP });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const pages = readdirSync(DIST).filter((f) => extname(f) === ".html").sort();
const violations = [];
let ldTotal = 0;

for (const page of pages) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const msgs = [];
  p.on("console", (m) => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) msgs.push(t); });
  p.on("pageerror", (e) => msgs.push("pageerror: " + e.message));
  await p.goto(`http://localhost:${PORT}/${page}`, { waitUntil: "load" });
  await p.waitForTimeout(700);

  /* Structured data must still parse — that is the risk with a
     script-src that no longer allows inline. */
  const ld = await p.evaluate(() => {
    const out = [];
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { out.push(JSON.parse(s.textContent)["@type"] || "?"); } catch (e) { out.push("PARSE-ERROR"); }
    });
    return out;
  });
  ldTotal += ld.length;
  if (ld.includes("PARSE-ERROR")) violations.push(`${page}: JSON-LD failed to parse`);

  /* Behaviour that depends on the external scripts actually running. */
  const alive = await p.evaluate(() => ({
    navJs: !!document.getElementById("nav-toggle") && document.getElementById("site-nav").hasAttribute("data-nav-open"),
    searchJs: !!document.getElementById("search-overlay"),
    fontLoaded: document.fonts ? document.fonts.check('16px "Source Sans 3"') : true,
    styled: getComputedStyle(document.body).backgroundColor === "rgb(245, 242, 238)"
  }));
  if (!alive.navJs) violations.push(`${page}: site.js did not run`);
  if (!alive.searchJs) violations.push(`${page}: search.js did not run`);
  if (!alive.styled) violations.push(`${page}: stylesheet did not apply`);
  if (!alive.fontLoaded) violations.push(`${page}: self-hosted font did not load`);
  for (const m of msgs) violations.push(`${page}: ${m.slice(0, 160)}`);

  await ctx.close();
}

await browser.close();
server.close();

console.log(`checked ${pages.length} pages under the live policy — ${ldTotal} JSON-LD blocks parsed`);
if (!violations.length) { console.log("PASS — nothing blocked, scripts ran, styles and fonts applied"); process.exit(0); }
console.log(`\nFAIL — ${violations.length}`);
for (const v of violations.slice(0, 40)) console.log("  " + v);
process.exit(1);
