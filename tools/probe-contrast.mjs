import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const axeSrc = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const url = process.argv[2] || "index.html";
const width = Number(process.argv[3] || 1280);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await b.newContext({ viewport: { width, height: 900 } });
const p = await ctx.newPage();
await p.goto("http://localhost:8899/" + url, { waitUntil: "domcontentloaded" });
await p.waitForTimeout(800);
await p.addScriptTag({ content: axeSrc });
const r = await p.evaluate(async () => await axe.run(document, { runOnly: ["color-contrast"] }));
for (const v of r.violations) for (const n of v.nodes) {
  console.log(JSON.stringify({ target: n.target, data: n.any[0]?.data, html: n.html.slice(0, 200) }, null, 1));
}
if (!r.violations.length) console.log("no contrast violations at", width);
await b.close();
