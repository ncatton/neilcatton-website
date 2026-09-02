/* Link and asset check.
   ─────────────────────────────────────────────────────────────────
   Run after a build:  node tools/check-links.mjs
                       node tools/check-links.mjs --external

   Internal by default: every href, src and srcset in dist/ must resolve
   to a file that exists, and every in-page #fragment must match an id on
   the page it points at. Exits non-zero on any miss.

   --external also HEADs every outbound URL. Kept opt-in so the deploy
   gate does not fail because someone else's server had a bad minute; run
   it on a schedule instead.
*/
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const EXTERNAL = process.argv.includes("--external");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(DIST);
const htmlFiles = files.filter((f) => extname(f) === ".html");

/* ids on every page, so cross-page fragments can be checked too */
const idsByPage = new Map();
for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  idsByPage.set("/" + f.slice(DIST.length + 1), new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
}

const problems = [];
const external = new Set();
let internalChecked = 0;

for (const f of htmlFiles) {
  const rel = "/" + f.slice(DIST.length + 1);
  const html = readFileSync(f, "utf8");
  const refs = [];
  for (const m of html.matchAll(/\s(?:href|src|data-src)="([^"]+)"/g)) refs.push(m[1]);
  for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) for (const part of m[1].split(",")) refs.push(part.trim().split(/\s+/)[0]);

  for (const ref of refs) {
    if (!ref || ref.startsWith("data:") || ref.startsWith("mailto:") || ref.startsWith("tel:")) continue;
    if (/^https?:\/\//i.test(ref)) { external.add(ref); continue; }

    if (ref.startsWith("#")) {
      const ids = idsByPage.get(rel);
      internalChecked++;
      if (!ids.has(ref.slice(1))) problems.push(`${rel}: fragment ${ref} has no matching id on this page`);
      continue;
    }
    if (!ref.startsWith("/")) { problems.push(`${rel}: relative reference "${ref}" — the site uses root-relative URLs`); continue; }

    const [pathPart, hash] = ref.split("#");
    const target = pathPart === "/" ? "/index.html" : pathPart;
    const onDisk = join(DIST, target);
    internalChecked++;
    if (!existsSync(onDisk)) { problems.push(`${rel}: ${ref} -> ${target} does not exist in dist/`); continue; }
    if (hash) {
      const ids = idsByPage.get(target);
      if (ids && !ids.has(hash)) problems.push(`${rel}: ${ref} — no id "${hash}" on ${target}`);
    }
  }
}

/* orphan check: every page reachable from somewhere */
const linked = new Set();
for (const f of htmlFiles) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(/\shref="(\/[^"#?]*)/g)) linked.add(m[1] === "/" ? "/index.html" : m[1]);
}
const orphans = htmlFiles
  .map((f) => "/" + f.slice(DIST.length + 1))
  .filter((p) => p !== "/index.html" && !linked.has(p) && !/404|rate-limited/.test(p));

console.log(`checked ${internalChecked} internal references across ${htmlFiles.length} pages`);
if (orphans.length) console.log(`orphan pages (nothing links to them): ${orphans.join(", ")}`);

if (EXTERNAL) {
  console.log(`checking ${external.size} external URLs…`);

  // 2026-09: a plain "6 at once, whatever they are" batch put ~20
  // requests to writing.neilcatton.com in the same few seconds and got
  // every one of them 429'd by Substack, plus a UA-less server-side
  // HEAD tripped Amazon's bot detection (404 instead of a real block).
  // Grouping by host means a burst against one site can no longer look
  // like a flood to that site, a browser UA stops the more naive bot
  // checks, falling back to GET on ANY bad HEAD status (not just
  // 403/405) covers hosts that just handle HEAD badly, and a 429 gets
  // one retry with backoff (honouring Retry-After) before it counts as
  // a real failure.
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const byHost = new Map();
  for (const url of external) {
    let host;
    try { host = new URL(url).host; } catch { host = url; }
    if (!byHost.has(host)) byHost.set(host, []);
    byHost.get(host).push(url);
  }

  async function attempt(url, method) {
    return fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,*/*" },
    });
  }

  async function checkURL(url) {
    const maxTries = 3;
    for (let tries = 1; tries <= maxTries; tries++) {
      try {
        let r = await attempt(url, "HEAD");
        if (!r.ok) r = await attempt(url, "GET");
        if (r.ok) return null;
        if (r.status === 429 && tries < maxTries) {
          const retryAfter = Number(r.headers.get("retry-after"));
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : tries * 2000);
          continue;
        }
        return `external ${url} -> HTTP ${r.status}`;
      } catch (e) {
        if (tries < maxTries) { await sleep(tries * 1500); continue; }
        return `external ${url} -> ${e.name}: ${e.message}`;
      }
    }
  }

  // Up to 6 hosts checked at once (same overall throughput as before),
  // but every host's own URLs run one at a time with a polite gap —
  // the part that actually stops a single site being flooded.
  const hosts = [...byHost.keys()];
  for (let i = 0; i < hosts.length; i += 6) {
    await Promise.all(hosts.slice(i, i + 6).map(async (host) => {
      for (const url of byHost.get(host)) {
        const problem = await checkURL(url);
        if (problem) problems.push(problem);
        await sleep(300);
      }
    }));
  }
} else {
  console.log(`${external.size} external URLs found — run with --external to check them`);
}

if (!problems.length && !orphans.length) {
  console.log("PASS — every reference resolves");
  process.exit(0);
}
if (problems.length) {
  console.log(`\nFAIL — ${problems.length} broken reference${problems.length === 1 ? "" : "s"}`);
  for (const p of problems.slice(0, 80)) console.log("  " + p);
  if (problems.length > 80) console.log(`  … and ${problems.length - 80} more`);
  process.exit(1);
}
process.exit(0);
