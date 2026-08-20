import { chromium } from "playwright";
const url = process.argv[2] || "index.html";
const width = Number(process.argv[3] || 375);
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const ctx = await b.newContext({ viewport: { width, height: 900 } });
const p = await ctx.newPage();
await p.goto("http://localhost:8899/" + url, { waitUntil: "load" });
await p.waitForTimeout(900);
const r = await p.evaluate(() => {
  const out = [];
  const cw = document.documentElement.clientWidth;
  document.querySelectorAll("*").forEach((el) => {
    const box = el.getBoundingClientRect();
    if (box.right > cw + 1 && box.width > 0) {
      const cs = getComputedStyle(el);
      out.push({
        tag: el.tagName, cls: (el.className || "").toString().slice(0, 40),
        w: Math.round(box.width), right: Math.round(box.right),
        display: cs.display, gtc: cs.gridTemplateColumns, minW: cs.minWidth, width: cs.width
      });
    }
  });
  return { cw, scrollW: document.documentElement.scrollWidth, out: out.slice(0, 12) };
});
console.log(JSON.stringify(r, null, 1));
await b.close();
