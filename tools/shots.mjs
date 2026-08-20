import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
const OUT = process.argv[2] || "/tmp/shots-new";
mkdirSync(OUT, { recursive: true });
const jobs = [
  ["index.html", 390, 900, "mobile-home"],
  ["index.html", 390, 900, "mobile-home-menu", { openMenu: true }],
  ["index.html", 768, 900, "tablet-home"],
  ["index.html", 1280, 900, "desktop-home"],
  ["services.html", 900, 900, "laptop900-services"],
  ["board-appointments.html", 1280, 1000, "desktop-board"],
  ["board-appointments.html", 390, 900, "mobile-board"],
  ["service-ai-board-briefing.html", 1280, 1000, "desktop-service"],
  ["pattern-map.html", 390, 900, "mobile-patternmap"],
  ["contact.html", 390, 900, "mobile-contact"]
];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const [url, w, h, name, opts = {}] of jobs) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8899/" + url, { waitUntil: "load" });
  await p.waitForTimeout(900);
  if (opts.openMenu) { await p.click("#nav-toggle"); await p.waitForTimeout(400); }
  await p.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
  console.log("shot", name);
}
await b.close();
