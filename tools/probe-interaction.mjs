/* Manual-equivalent interaction checks. Not part of CI: run when the nav,
   search, forms or interactive pages change. Serve dist/ on :8899 first. */
import { chromium } from "playwright";

const U = "http://localhost:8899";
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const ok = (name, pass, note = "") => results.push({ name, pass, note });
const text = (p) => p.locator("main").innerText();

for (const [w, h, tag] of [[1280, 800, "desktop"], [390, 844, "phone"]]) {
  const c = await b.newContext({ viewport: { width: w, height: h } });
  const p = await c.newPage();
  await p.goto(U + "/");
  if (tag === "desktop") {
    await p.click('.nv-main summary:has-text("Read")');
    ok("menu opens", await p.isVisible('.nv-main a:has-text("Briefings")'));
    await p.keyboard.press("Escape");
    ok("Escape closes the menu", !(await p.isVisible('.nv-main a:has-text("Briefings")')));
    await p.click('.nv-main summary:has-text("Use")');
    await p.mouse.click(640, 600);
    ok("click away closes the menu", !(await p.isVisible('.nv-main a:has-text("Practice Library")')));
    await p.click(".nv-main [data-search]");
    ok("search opens over the page", await p.isVisible("#search-input"));
    await p.fill("#search-input", "readiness ai");
    await p.waitForTimeout(500);
    ok("search finds results", (await p.locator(".search-result").count()) > 0);
    await p.keyboard.press("Escape");
    ok("Escape closes search", !(await p.isVisible("#search-input")));
    await p.keyboard.press("Control+k");
    ok("Ctrl+K opens search", await p.isVisible("#search-input"));
    await p.keyboard.press("Escape");
  } else {
    await p.click(".nv-phone summary");
    ok("phone menu opens", await p.isVisible('.nv-phone a:has-text("Practice Library")'));
    await p.keyboard.press("Escape");
  }
  for (const [path, label] of [["/books.html", "Books"], ["/book-the-next-evolution.html", "Book lens"]]) {
    await p.goto(U + path);
    const t = await text(p);
    await p.locator("main button").nth(1).click();
    await p.waitForTimeout(150);
    ok(label + " switches", (await text(p)) !== t);
  }
  await p.goto(U + "/about.html");
  let t = await text(p);
  await p.locator("main button", { hasText: "Nuclear" }).first().click();
  await p.waitForTimeout(150);
  ok("About: career dot", (await text(p)) !== t);
  await p.goto(U + "/services.html");
  t = await text(p);
  await p.locator("main button", { hasText: /independent review/ }).first().click();
  await p.waitForTimeout(150);
  ok("Services: selector", (await text(p)) !== t);
  await p.goto(U + "/articles.html");
  t = await text(p);
  await p.locator("main button", { hasText: "Engineered" }).click();
  await p.waitForTimeout(150);
  ok("Writing: pattern", (await text(p)) !== t);
  await p.goto(U + "/practice-library.html");
  const first = await p.innerText("#deck-title");
  await p.click("#deck-next");
  await p.waitForTimeout(150);
  ok("Library: next card", (await p.innerText("#deck-title")) !== first);
  await p.goto(U + "/pattern-map.html");
  await p.click('.chip:has-text("Health")');
  ok("Map: sector filter", (await p.locator("#pm-some .ess").count()) > 0);
  await p.goto(U + "/briefings.html");
  await p.fill("#find", "FCA");
  await p.waitForTimeout(100);
  ok("Briefings: finder", (await p.locator(".bwall .tile:visible").count()) < 16);
  if (tag === "desktop") {
    await p.addInitScript(() => addEventListener("pagereveal", (e) => { window.__vt = !!e.viewTransition; }));
    await p.goto(U + "/briefings.html");
    await p.locator(".bwall a.tile", { hasText: "Grocery" }).click();
    await p.waitForTimeout(1200);
    ok("number transition runs", await p.evaluate(() => window.__vt === true));
  }
  await c.close();
}
await b.close();
for (const r of results) console.log(`${r.pass ? "ok  " : "FAIL"} ${r.name} ${r.note}`);
process.exit(results.some((r) => !r.pass) ? 1 : 0);
