/* Content-loss check for the rebuild.
   Compares the visible text of every original page against the rebuilt
   one, after stripping the nav and footer (both were deliberately
   rewritten). Reports any sentence that existed before and does not
   exist now. Run once, from the migration; not part of the build.

     node tools/diff-content.mjs /path/to/old-site
*/
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const OLD = process.argv[2];
const NEW = "dist";
if (!OLD) { console.error("usage: node tools/diff-content.mjs <old-site-dir>"); process.exit(2); }

function visibleText(html, { dropChrome }) {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<head[\s\S]*?<\/head>/gi, " ");
  if (dropChrome) {
    s = s.replace(/<nav class="site-nav"[\s\S]*?<\/nav>/gi, " ");
    s = s.replace(/<footer[\s\S]*?<\/footer>/gi, " ");
    s = s.replace(/<a class="skip-link"[\s\S]*?<\/a>/gi, " ");
    s = s.replace(/<a href="#main[^"]*" class="skip-link"[\s\S]*?<\/a>/gi, " ");
  }
  s = s.replace(/<[^>]+>/g, " ");
  s = s.replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–")
       .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&rarr;/g, "→")
       .replace(/&pound;/g, "£").replace(/&middot;/g, "·").replace(/&copy;/g, "©")
       .replace(/&ldquo;|&rdquo;/g, '"').replace(/&hellip;/g, "…").replace(/&times;/g, "×")
       .replace(/&#\d+;/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

/* Normalise the things the rebuild deliberately changed. */
function normalise(t) {
  return t
    .replace(/Thirty-(seven|eight|nine)/g, "NYEARS")
    .replace(/thirty-(seven|eight|nine)/g, "nyears")
    .replace(/\b37\+/g, "NPLUS").replace(/\b39\+/g, "NPLUS")
    .replace(/for thirty years/g, "for nyears years")
    .replace(/(over |more than )?three decades/g, "nyears years")
    .replace(/neilcatton\.substack\.com/g, "writing.neilcatton.com")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function sentences(t) {
  return normalise(t)
    .split(/(?<=[.!?])\s+|\s+—\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 40);
}

const oldPages = readdirSync(OLD).filter((f) => f.endsWith(".html"));
let missingTotal = 0, checked = 0;
const report = [];

for (const f of oldPages) {
  const newPath = join(NEW, f);
  if (!existsSync(newPath)) { report.push({ f, note: "PAGE MISSING FROM BUILD" }); continue; }
  const before = sentences(visibleText(readFileSync(join(OLD, f), "utf8"), { dropChrome: true }));
  const afterText = normalise(visibleText(readFileSync(newPath, "utf8"), { dropChrome: true }));
  const missing = before.filter((s) => !afterText.includes(s));
  checked += before.length;
  missingTotal += missing.length;
  if (missing.length) report.push({ f, missing });
}

console.log(`compared ${oldPages.length} pages, ${checked} sentences of 40+ characters`);
console.log(`missing after rebuild: ${missingTotal}`);
for (const r of report) {
  console.log(`\n--- ${r.f}${r.note ? " — " + r.note : ""}`);
  for (const m of (r.missing || []).slice(0, 8)) console.log(`    ${m.slice(0, 150)}`);
  if ((r.missing || []).length > 8) console.log(`    … and ${r.missing.length - 8} more`);
}
