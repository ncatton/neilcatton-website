/* Manual-equivalent interaction checks. Not part of CI — run when the
   nav, search or forms change. */
import { chromium } from "playwright";

const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const results = [];
const ok = (name, pass, note = "") => { results.push({ name, pass, note }); };

/* ── search overlay ─────────────────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8899/index.html", { waitUntil: "load" });
  await p.waitForTimeout(600);

  await p.keyboard.press("/");
  await p.waitForTimeout(300);
  ok("search: '/' opens the overlay", await p.isVisible("#search-overlay.open"));
  ok("search: focus lands in the input", await p.evaluate(() => document.activeElement.id === "search-input"));

  /* multi-token, out of order — the old scoring returned nothing for this */
  await p.fill("#search-input", "readiness ai");
  await p.waitForTimeout(400);
  const n1 = await p.locator(".search-result").count();
  ok("search: out-of-order tokens match", n1 > 0, `${n1} results for "readiness ai"`);

  const status = await p.textContent("#search-status");
  ok("search: result count announced", /result/.test(status || ""), (status || "").slice(0, 60));

  await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(150);
  ok("search: arrow key sets aria-activedescendant",
     await p.evaluate(() => !!document.getElementById("search-input").getAttribute("aria-activedescendant")));

  /* focus trap: tab round the dialog and confirm focus never leaves it */
  let escaped = false;
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press("Tab");
    const inside = await p.evaluate(() => !!document.activeElement.closest("#search-overlay"));
    if (!inside) { escaped = true; break; }
  }
  ok("search: focus stays inside the dialog", !escaped);

  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  ok("search: Escape closes", !(await p.isVisible("#search-overlay.open")));
  ok("search: focus returns to the trigger",
     await p.evaluate(() => document.activeElement.id === "search-trigger"));
  await ctx.close();
}

/* ── nav dropdowns, desktop ─────────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8899/index.html", { waitUntil: "load" });
  await p.waitForTimeout(600);

  ok("nav: menus start closed", await p.evaluate(() =>
    [...document.querySelectorAll(".nav-dropdown-toggle")].every((t) => t.getAttribute("aria-expanded") === "false")));

  await p.click("#navbtn-services");
  await p.waitForTimeout(200);
  ok("nav: click opens the menu", await p.isVisible("#navmenu-services a"));
  ok("nav: aria-expanded reports open",
     (await p.getAttribute("#navbtn-services", "aria-expanded")) === "true");

  await p.click("#navbtn-writing");
  await p.waitForTimeout(200);
  ok("nav: opening one closes the other",
     (await p.getAttribute("#navbtn-services", "aria-expanded")) === "false");

  await p.keyboard.press("Escape");
  await p.waitForTimeout(200);
  ok("nav: Escape closes the menu",
     (await p.getAttribute("#navbtn-writing", "aria-expanded")) === "false");

  ok("nav: exactly one aria-current on a service page", await (async () => {
    await p.goto("http://localhost:8899/service-ai-board-briefing.html", { waitUntil: "load" });
    await p.waitForTimeout(400);
    return await p.evaluate(() => document.querySelectorAll('.site-nav [aria-current="page"]').length) === 1;
  })());
  await ctx.close();
}

/* ── mobile panel ───────────────────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8899/index.html", { waitUntil: "load" });
  await p.waitForTimeout(600);

  ok("mobile: a menu button exists", await p.isVisible("#nav-toggle"));
  await p.click("#nav-toggle");
  await p.waitForTimeout(300);
  ok("mobile: panel opens and fills the viewport", await p.evaluate(() => {
    const el = document.getElementById("nav-panel");
    return el.getBoundingClientRect().height > window.innerHeight * 0.7;
  }));
  ok("mobile: Contact is reachable", await p.isVisible('#nav-panel a[href="/contact.html"]'));
  ok("mobile: Book a call is reachable", await p.isVisible("#nav-panel .btn-nav"));
  ok("mobile: search is reachable", await p.isVisible("#nav-panel #search-trigger"));

  await p.click("#navbtn-services");
  await p.waitForTimeout(250);
  ok("mobile: a group expands in place", await p.isVisible('#navmenu-services a[href="/services.html"]'));

  await p.keyboard.press("Escape");
  await p.waitForTimeout(150);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(250);
  ok("mobile: Escape closes the panel",
     (await p.getAttribute("#site-nav", "data-nav-open")) === "false");
  await ctx.close();
}

/* ── contact form ───────────────────────────────────────────────── */
{
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  await p.goto("http://localhost:8899/contact.html", { waitUntil: "load" });
  await p.waitForTimeout(500);

  ok("form: posts to a same-origin endpoint",
     (await p.getAttribute("#contact-form", "action") || "").endsWith("/contact-submit"));
  ok("form: honeypot present and out of the tab order", await p.evaluate(() => {
    const hp = document.querySelector('input[name="_gotcha"]');
    return !!hp && hp.tabIndex === -1 && !!hp.closest('[aria-hidden="true"]');
  }));
  ok("form: error panel exists and starts hidden", await p.evaluate(() => {
    const e = document.getElementById("form-error");
    return !!e && e.hidden;
  }));

  /* Intercept the submit so nothing is actually sent, and confirm the
     failure path renders in the page rather than through alert(). */
  let alerted = false;
  p.on("dialog", async (d) => { alerted = true; await d.dismiss(); });
  await p.route("**/contact-submit", (route) => route.fulfill({ status: 500, body: "{}" }));
  await p.fill("#contact-name", "Test Person");
  await p.fill("#contact-email", "test@example.com");
  await p.fill("#contact-message", "This is a test message long enough to be realistic.");
  await p.click("#contact-form button[type=submit]");
  await p.waitForTimeout(900);
  ok("form: failure shows an inline error, not alert()",
     (await p.isVisible("#form-error")) && !alerted);
  await ctx.close();
}

await b.close();

const failed = results.filter((r) => !r.pass);
for (const r of results) console.log(`${r.pass ? "  ok  " : "FAIL  "}${r.name}${r.note ? "  — " + r.note : ""}`);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
