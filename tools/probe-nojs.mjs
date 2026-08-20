import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
for (const url of ["index.html","articles.html","practice-library.html","briefings.html","pattern-map.html","board-appointments.html","sitemap.html"]) {
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8899/" + url, { waitUntil: "load" });
  const r = await p.evaluate(() => {
    const m = document.querySelector("main");
    const t = (m ? m.innerText : document.body.innerText).replace(/\s+/g, " ").trim();
    return { chars: t.length, links: document.querySelectorAll("main a").length, sw: document.documentElement.scrollWidth };
  });
  console.log(url.padEnd(28), "text:" + String(r.chars).padStart(6), "links:" + String(r.links).padStart(4), "scrollW:" + r.sw);
  await ctx.close();
}
await b.close();
