# neilcatton.com — World-Class Design Specification

**Prepared for:** Neil Catton
**Date:** 23 July 2026
**Scope:** neilcatton.com — the main site (home, about, 12 service pages, writing, practice library, books, press, CTO Grand Rounds, contact, privacy, 404)
**Status:** Reference standard for the current site and for all future page additions

This specification sets the bar neilcatton.com should meet to be considered genuinely best-in-class: standards-compliant, accessible to every visitor, fast, secure, privacy-respecting, and built so that SEO and accessibility requirements are handled by the page templates rather than left to memory each time a page is edited.

It is adapted from a specification originally built for a different site (Global Consortium Group) and reset against neilcatton.com's actual build: a static HTML/CSS/JS site, no CMS, no e-commerce, no build step, roughly 23 pages, hosted on Netlify, with two serverless functions proxying the Substack feed and site search, edited directly in the HTML. Recommendations are chosen to fit that stack.

One deliberate departure from the source document: neilcatton.com describes an independent practice trading under Neil's own name, not an incorporated organisation with staff. Wherever the source spec called for `Organization` schema, this version calls for `Person` schema instead, consistently applied, with each `Service` entry's `provider` pointing back to that Person. Marking the site up as an `Organization` would overstate what it is.

---

## 1. Guiding principles

1. **Standards before shortcuts.** Valid HTML, valid CSS, and semantic markup are the foundation every accessibility tool, search engine, and screen reader depends on.
2. **Accessible by default, not by retrofit.** New pages inherit the accessible patterns already in the shared header/footer/form markup, rather than accessibility being a pass applied afterwards.
3. **One canonical fact, everywhere it appears.** Name, spelling convention, commercial-basis wording, and legal/contact details are written once and copied deliberately, not retyped from memory on every new page — this is how sites drift (a phone number that's right on one page and stale on another, a service description that diverges from its own PDF one-pager).
4. **Minimum viable data collection.** No cookie, script, or form field exists unless it earns its place under Section 9. The site currently has one real tracking script (Google Analytics) and two third-party embeds (TidyCal, Formspree) — keep it that lean.
5. **UK English, consistently.** The site is already consistent in UK spelling (organisation, specialising, etc.) — this is a rule to protect, not a fault to fix, as new pages are added.
6. **No dead ends.** No empty `href="#"` links, no orphaned pages, no forms that quietly go nowhere. This document exists partly because the homepage's own contact form was found submitting to nowhere during the first audit against this spec (Section 18) — the standing example of what not to repeat.

---

## 2. Standards and compliance targets

| Area | Target |
|---|---|
| Markup | Valid HTML5 — check new templates against the [W3C Nu HTML Checker](https://validator.w3.org/nu/) |
| Stylesheets | Valid CSS — check against the [W3C CSS Validator](https://jigsaw.w3.org/css-validator/) |
| Accessibility | WCAG 2.2, Level AA |
| UK accessibility law | Equality Act 2010 (service-provider duty to make reasonable adjustments) — not a public-sector site, so the Public Sector Bodies Accessibility Regulations don't apply directly, but WCAG 2.2 AA is the right bar for a practice whose clients include public-sector and regulated organisations who hold themselves to it |
| EU accessibility law | European Accessibility Act (in force since 28 June 2025) — relevant if any client engagement or product touches EU users; WCAG 2.2 AA satisfies the EN 301 549 mapping |
| Structured data | Schema.org via JSON-LD, validated with Google's [Rich Results Test](https://search.google.com/test/rich-results) and the [Schema Markup Validator](https://validator.schema.org/) |
| Performance | Core Web Vitals — LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1, at the 75th percentile |
| Security | HTTPS everywhere (Netlify default), HSTS, a Content Security Policy, no mixed-content requests |

Treat this table as the acceptance checklist before any new page or template change ships.

---

## 3. Accessibility (WCAG 2.2 AA)

- **Semantic structure.** Real heading levels (`h1`–`h6`) in a single logical order, one `h1` per page, native landmarks (`header`, `nav`, `main`, `footer`). Every current template already does this correctly — protect it in new templates.
- **Colour contrast.** Minimum 4.5:1 for body text, 3:1 for large text and UI components. The site's ink-on-paper palette (`#1a1714` on `#f5f2ee`, and the reverse on dark sections) comfortably clears this; check any new accent colour against both grounds before it's approved.
- **Keyboard operability.** Every interactive element — nav dropdown, the contact form, the TidyCal embed, the search overlay, FAQ accordions — fully usable with keyboard alone, with a visible focus indicator at all times. WCAG 2.2's **Focus Not Obscured** criterion means the fixed nav bar must never cover a focused element lower on the page.
- **Target size.** Minimum 24×24 CSS-pixel touch target (WCAG 2.2 SC 2.5.8) on nav links, buttons, and form controls.
- **Skip link.** "Skip to main content" as the first focusable element — already present on every page; keep it on every new one.
- **Forms.** Every field has a visible, programmatically associated `<label>`, clear error identification in text, and a confirmation message on submit. The contact page already does this well in markup — but see Section 18 for a real gap found in the submit behaviour of both contact forms on the site.
- **Images.** Descriptive alt text for meaningful images; `alt=""` for decorative ones. The site is in good shape here already — every `<img>` found in the audit carries specific, non-redundant alt text.
- **Motion and animation.** Respect `prefers-reduced-motion` — already implemented sitewide. No auto-playing carousels or marquees.
- **Language.** `lang="en-GB"` on the `html` element — already set on every page.
- **Testing.** Automated checks (axe-core or Lighthouse) plus at least one manual screen-reader pass (NVDA or VoiceOver) and one keyboard-only pass before any structural change ships, not just at launch.

---

## 4. Dyslexia-friendly and cognitive accessibility

- **Typography.** The current pairing — Playfair Display for headings, Source Sans 3 for body — keeps body copy in a clean sans-serif, which is the right choice. Avoid italics for anything longer than a pull-quote or standfirst.
- **Line length and spacing.** Cap body text at roughly 60–80 characters per line; line height at least 1.5× (the site's 1.7 body line-height already exceeds this); paragraph spacing generous.
- **Alignment.** Left-align body text everywhere. Never justify.
- **Contrast without glare.** The site's off-white paper (`#f5f2ee`) and near-black ink (`#1a1714`) — not pure white or pure black — is already the right middle ground for light-sensitive and dyslexic readers. Keep it that way; resist the temptation to push to pure `#000`/`#fff` for "more contrast."
- **Plain language.** Short sentences, one idea per paragraph, jargon defined on first use. The service-page copy already does this well ("These are not engineering problems. They are leadership gaps.") — hold new pages to the same bar.
- **Consistent layout.** Nav, footer, and page structure are already identical across every page. Protect this discipline as new pages are added — it's what lets a returning visitor navigate without re-learning the site.
- **Text resizing.** Content must reflow cleanly to 200% browser zoom with no loss of content or function, and ideally remain usable to 400%.
- **No walls of text.** Break long-form pages (privacy policy) into short sections with descriptive subheadings.

---

## 5. Search engine optimisation

### 5.1 On-page fundamentals (every page, no exceptions)

- Unique `<title>` per page, front-loaded with the specific topic — already the case sitewide (e.g. "Fractional CTO / CIO — Neil Catton").
- Unique meta description per page, **120–158 characters**, written to earn the click. The audit (Section 18) found every page has one, but twelve of the twenty-three fall short of 120 characters — the fix, not a missing-entirely problem like the source spec's site had.
- One `h1` per page matching the page's actual topic; logical `h2` hierarchy beneath it — confirmed correct sitewide.
- Clean, human-readable URLs — already the case (`/service-fractional-cto-cio.html`, not a query string or ID).
- Canonical tag on every page — confirmed present on 22 of 23 pages (404.html is the one exception, which is correct practice: error pages shouldn't claim a canonical identity, but should carry a `noindex` directive instead — see Section 18).

### 5.2 Technical SEO

- `sitemap.xml` — present, and should be updated whenever a page is added or removed.
- `robots.txt` — present, permits crawl of everything public, correctly points to the sitemap.
- A custom, on-brand 404 page with links back into the main sections — already exists.
- Mobile-first indexing assumed: the mobile experience is the canonical version Google evaluates. The site's responsive breakpoints already collapse cleanly; keep testing new pages at 375px and 390px widths.
- HTTPS on every URL with no mixed-content warnings (Netlify default).
- Structured data per Section 6, which increasingly determines how a result appears in AI-generated answers as well as classic search results — this is the single biggest gap the audit found (Section 18).

### 5.3 Off-page and authority signals

- Consistent name and practice description across the website, LinkedIn, Substack, and any directory or press listing, so Google's Knowledge Graph and AI answer engines converge on one consistent entity.
- `Person` schema, linked to a LinkedIn profile via `sameAs`, on every page — not just two of them (Section 18). This is the strongest E-E-A-T (experience, expertise, authoritativeness, trust) signal a solo consultancy has, since the practice's credibility *is* the product.

---

## 6. Structured data (schema.org / JSON-LD)

Using `Person`, not `Organization` (see the note under Section 1), add JSON-LD blocks for:

- **Person** on every page (not just index and about): name, jobTitle, description, image, `sameAs` (Substack confirmed; add the LinkedIn profile URL once confirmed — it isn't referenced anywhere on the current site to source it from).
- **WebSite** on the home page. No `SearchAction` — the site's search overlay is a client-side JS component with no query-string URL a search engine could construct a request against, so marking one up would describe a capability the site doesn't actually expose. Add `SearchAction` only if the search is ever rebuilt around a real `?q=` results URL.
- **Service** for each of the twelve service pages: name, description, provider (the Person entity), areaServed.
- **FAQPage** on any page with genuine, visible Q&A content — the twelve service pages, once Section 4 of this audit's action list is complete (Section 19).
- **BreadcrumbList** on every page below the top level, matching the site's actual URL/nav hierarchy (Home → Services → [service name]).
- **Book** for each of the three books and the ebook — already present and correctly scoped to books.html; no change needed.

Validate every new template with the Rich Results Test before treating it as done. Keep structured data honest — never mark up content that isn't visibly present on the page.

---

## 7. Images

- **Formats.** The site currently serves JPEG/PNG only. Convert to WebP with a fallback (or serve WebP directly, since browser support is now near-universal) as a planned follow-up — not urgent, but a real Core Web Vitals lever (Section 19).
- **Compression.** No image should exceed roughly 200KB without a specific reason. The audit found one unused, uncompressed 555KB JPEG sitting in `/images/` (Section 18) — a good example of exactly what this rule exists to prevent, even though it isn't currently costing any page weight since nothing links to it.
- **Lazy loading.** `loading="lazy"` on below-the-fold images; never lazy-load the largest above-the-fold image (the hero photo), since that's the LCP element.
- **Meaningful filenames.** Already good practice sitewide (`neil-catton-headshot.jpg`, not `IMG_4279.jpeg`).
- **Alt text discipline.** Already correct sitewide — every image carries specific, non-generic alt text; nothing decorative is present that would need `alt=""`.
- **Social share image.** A single, properly sized (1200×630px) Open Graph image served over HTTPS — already correct.
- **Favicon set.** A full modern favicon set (`.ico`, 16×16, 32×32, apple-touch-icon, `site.webmanifest`) — already present and correct.
- **Rights.** No image goes live without confirmed usage rights — Neil's own photography and headshots, so not currently a risk area.
- **Rendered/generated graphics (Data Poster figures, framework diagrams, etc.).** Any raster image derived from an HTML artefact must be produced by rendering the source HTML directly to a high-resolution raster — never by screenshotting a browser window and cropping or scaling it. Screenshot-based capture visibly softens text at any zoom or crop step; it produced blurry, barely-legible in-article and social images on the first attempt at the AI-in-UK-insurance-claims briefing (August 2026) and was fully rebuilt as a result. See the `briefing-infographic` skill for the exact pipeline (weasyprint + locally embedded brand fonts + PyMuPDF rasterisation) — it applies to every Data Poster image this site publishes, not just that one.

---

## 8. Meta tags and social sharing

Every page's `<head>` should include, at minimum — all already true sitewide, protect this on new pages:

- `<meta charset>` and a responsive viewport tag
- Title and meta description (Section 5.1)
- Canonical URL
- Open Graph tags: `og:title`, `og:description`, `og:image` (HTTPS, 1200×630), `og:url`, `og:type`
- Twitter Card tags (`summary_large_image`)
- `theme-color` matching the brand ground colour

---

## 9. Cookies, trackers, and privacy

This is the area with the most daylight between the current site and the target — see Section 18 and the follow-up list in Section 19.

- **Consent model.** Under UK GDPR and PECR, non-essential cookies (analytics included) require **prior opt-in consent** — not implied consent from continued browsing. The site currently loads Google Analytics (`gtag.js`) unconditionally on every page with no consent mechanism at all. This is the single highest-priority compliance gap on the site and needs a considered fix, not a quick patch (Section 19).
- **Categorise honestly.** Strictly Necessary (Formspree session, security), Functional (search/cookie-choice memory, if any), Analytics (GA), Marketing (none currently — say so plainly rather than including a boilerplate category that doesn't apply).
- **Prefer cookieless analytics.** Given the site's traffic and goals (contact form submissions, booking clicks, article reads), a privacy-first, cookieless analytics tool (Plausible or Fathom) is a legitimate, genuinely simpler alternative to GA — it removes the need for a consent banner almost entirely, since it doesn't set cookies or process personal data in a way that requires consent. Worth a real decision, not an afterthought, precisely because it would let the site skip building a banner at all rather than build one to gate GA.
- **Third-party embeds.** TidyCal and Formspree both set their own cookies/session state when embedded or submitted to — list them explicitly in the privacy policy (check whether `privacy.html` already does — confirm and update if not).
- **No dark patterns.** If a consent banner is built, reject-all must be exactly as easy and visually equal to accept-all.
- **Data minimisation.** The contact form already collects only what's needed (name, organisation, email, message, enquiry type) — no change needed.

---

## 10. Standard compliance components (build once, reuse everywhere)

- **Cookie consent banner** — doesn't exist yet; needed if GA is kept (see Section 9's cookieless-analytics alternative, which would remove this requirement entirely).
- **Accessibility statement page** — doesn't exist yet. Required in substance for credibility with the site's public-sector and regulated audience even though not legally mandated for a site this size: conformance level (WCAG 2.2 AA target), known limitations, a contact route for accessibility issues, date of last review.
- **Privacy policy** — exists (`privacy.html`); confirm it names every third-party processor (Formspree, TidyCal, Google Analytics) and the legal basis for each.
- **Cookie policy** — should be a clearly separated section of the privacy policy (or its own page) listing every cookie/tracker by name, purpose, and duration, once the Section 9 decision is made.
- **security.txt** (`/.well-known/security.txt`) — doesn't exist yet; trivial to add, gives security researchers a proper reporting channel, and is a real credibility signal given the practice's public-sector and policing-adjacent client base.
- **Human-readable sitemap page** — doesn't exist yet; trivial to generate on a 23-page static site and helps both users and search engines.
- **Consistent footer** — already correct and consistent across every page checked.

---

## 11. Performance and Core Web Vitals

- Targets: LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1 at the 75th percentile.
- Reserve explicit `width`/`height` on every image and embed (including the TidyCal iframe and the Substack embed) to prevent layout shift — already done for the images checked; confirm on the TidyCal and Substack iframes specifically.
- Self-host or subset the two Google Fonts (Playfair Display, Source Sans 3) with `font-display: swap` as a future optimisation — currently loaded from Google's CDN with `preconnect`, which is a reasonable middle ground already in place.
- Plain HTML/CSS/minimal JS sitewide already keeps INP low almost by default — no framework overhead to manage.
- Defer non-critical third-party scripts — the Google Analytics snippet currently loads via `async` in the `<head>` on every page; fine for performance, but see Section 9 for why it shouldn't load unconditionally at all.

---

## 12. Security

- HTTPS enforced everywhere with HSTS (Netlify default at the edge).
- A Content Security Policy restricting script/style sources to known origins (self, Google Fonts, TidyCal, Formspree, Google Analytics, Substack) — not currently set in `netlify.toml`; a real gap, but one that needs careful testing against every embed before going live, since a misconfigured CSP breaks the TidyCal and Substack iframes silently (Section 19).
- Form spam protection on the contact form beyond Formspree's own filtering — a honeypot field is the lower-effort, privacy-respecting option (avoids adding a Google reCAPTCHA tracker for a low-value anti-spam gain).
- No secrets or API keys committed to the repository — the two Netlify functions (`substack-feed.js`, `practice-library-feed.js`, `search-feed.js`) should be checked to confirm they don't hardcode anything sensitive.
- Dependency hygiene — enable Dependabot alerts on the GitHub repo if not already on.

---

## 13. Editorial and content standards

- One spelling convention (UK English) — already consistent sitewide; protect it.
- No emoji in the professional copy — already the case; keep it that way.
- Proofread names and figures before publishing — the site's copy is precise and specific (exact durations, exact formats); keep that discipline as new pages are added.
- No link ever points to an empty destination — confirmed: no `href="#"` found anywhere on the site.
- No thin, padded, or placeholder content — confirmed: every section on every page checked carries genuine, specific copy.
- A lightweight editorial checklist (title, meta description length, alt text, spelling convention, no empty links, schema present) reviewed before publishing any new page.

---

## 14. Mobile, responsive design, and cross-device testing

- Mobile-first layout with defined breakpoints (860px, 580px sitewide) — already in place and consistent.
- Touch targets sized per WCAG 2.2 throughout mobile nav and forms.
- Real-device testing (not just browser resize) on at least one current iOS and one current Android device before any structural change ships.
- Progressive enhancement — core content and navigation already work without JavaScript; the FAQ accordions added under this spec use native `<details>`/`<summary>` for the same reason (Section 19), rather than a JS-dependent accordion pattern.

---

## 15. Analytics and measurement

- Track meaningful outcomes: contact form submissions, TidyCal booking clicks, article read-throughs — not vanity pageview totals.
- Register the site with Google Search Console and Bing Webmaster Tools if not already done — both are free, cookieless, and directly surface crawl errors, mobile usability issues, and Core Web Vitals field data.
- Review analytics and Search Console data on a regular cadence (quarterly is reasonable for a site this size) rather than only when something looks wrong.

---

## 16. Governance and ongoing maintenance

- **Editorial checklist on publish.** Before any new page or service goes live: unique title + meta description in range, single `h1`, alt text on every image, canonical tag, relevant JSON-LD block, no empty links, UK spelling.
- **Accessibility statement review.** Re-date and re-check at the same cadence as general content review, once the page exists (Section 10).
- **Link checking.** A periodic broken-link pass — trivial to script, worth doing every few months as pages are added or PDFs replaced.
- **Annual refresh.** Re-validate against whichever WCAG and schema.org versions are current — these standards evolve, and "compliant today" is not the same as "compliant next year."

---

## 17. Acceptance checklist for any new page

- Unique title + meta description (120–158 characters)
- Single `h1` with logical heading order beneath it
- Every image has correct alt text (or `alt=""` if genuinely decorative) and a meaningful filename
- No empty links
- UK spelling only
- Canonical tag present
- Relevant JSON-LD block(s) present and validated (Person at minimum; Service + FAQPage if it's a service page; BreadcrumbList if it sits below the top level)
- Meets the contrast, keyboard, and touch-target rules in Section 3

---

## 18. Baseline audit — findings against this specification (23 July 2026)

This is the actual state of neilcatton.com checked against every section above, at the point this specification was written. Items marked **Fixed** were corrected as part of adopting this specification; items marked **Open** are logged in Section 19 as prioritised follow-up work, deliberately not rushed into the same pass.

**Already compliant, no action needed:**
Semantic structure and single `h1` per page; `lang="en-GB"` sitewide; skip link sitewide; colour contrast; reduced-motion support; UK spelling consistency; no empty links anywhere on the site; alt text discipline on every image; favicon set; social share image served over HTTPS; canonical tags on 22 of 23 pages, with `404.html` correctly carrying a `noindex` directive instead; meta descriptions present on every page; Open Graph and Twitter Card tags sitewide; responsive breakpoints; form field labelling.

**Fixed as part of this pass:**
- The homepage's own contact form (`index.html`) submitted to `action="#"` with no JavaScript handler — a genuine dead end matching this document's own Section 1, Principle 6. Wired to the same Formspree endpoint and confirmation pattern already working correctly on `contact.html`.
- Neither contact form (home or contact page) actually enforced its `required` fields: both forms carry `novalidate` but the submit handlers never call `checkValidity()`, so empty submissions were possible with no error feedback — a Section 3 forms-accessibility gap. Both now check validity and call `reportValidity()` before submitting.
- Twelve of twenty-three meta descriptions were under the 120-character target (as low as 71 characters on the Data Strategy Review page) — rewritten to fall inside the 120–158 character range without changing their meaning.
- `Person` schema existed on only 2 of 23 pages — added sitewide.
- No `Service` schema existed on any of the twelve service pages — added, each scoped to that page's actual name, description, and commercial basis.
- No `WebSite` schema existed on the home page — added (without `SearchAction`, per Section 6).
- No `BreadcrumbList` schema existed anywhere — added to the twelve service pages, reflecting the real Home → Services → [service] hierarchy already visible in the nav.
- No `FAQPage` content or schema existed anywhere — added to all twelve service pages (Section 19 and the FAQ content itself).
- No `security.txt` existed — added at `/.well-known/security.txt`.
- Two unused, uncompressed image assets (`neil-catton-photo.jpg`, 555KB; `NC-logo.png`, 161KB) sit in `/images/` with no page referencing either — flagged rather than deleted, since deleting files wasn't in scope for this pass; worth a decision on whether to use, compress, or remove them.

**Open after the first pass, since resolved in the second pass (23 July 2026) — see below:**
Cookie consent / Google Analytics, Content Security Policy, accessibility statement page, human-readable sitemap page, and WebP image delivery were all logged as deferred follow-up work in the first pass. Neil asked for all five to be actioned; what changed is recorded below rather than duplicated in Section 19, which now carries only what's still genuinely open.

**Fixed in the second pass (23 July 2026):**
- **Analytics switched from Google Analytics to Plausible**, a cookie-free analytics tool, sitewide across all 23 pages. This removes the PECR/UK GDPR consent gap entirely rather than managing it with a banner — Plausible sets no cookies and stores no data that identifies an individual visitor, so no consent mechanism is required. `privacy.html` has been rewritten to describe this accurately (Plausible and Netlify Web Analytics, both cookie-free; Formspree and TidyCal named as the only services that may set cookies, and only once a visitor actively uses them). **Action needed from Neil:** the Plausible script (`data-domain="neilcatton.com"`) is live in the code, but Plausible only reports data once an account exists and the domain is verified at plausible.io — that account creation step can't be done from here and still needs doing.
- **Content Security Policy and security headers added to `netlify.toml`** — `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, and an explicit `Strict-Transport-Security` header. The CSP allowlist was built from every external origin actually referenced in the codebase (Plausible, Google Fonts, Formspree, the Substack embed and API, and the `corsproxy.io`/`rss2json.com` feed-fallback fetches). It was not possible to test this against the live site from this environment — **test it on the next deploy**: open the browser console on a few pages (especially the homepage feed, the contact forms, and the Substack embed) and confirm nothing is silently blocked. `script-src` and `style-src` both need `'unsafe-inline'` because every page carries inline `<style>`/`<script>` blocks rather than externalised, nonced files — a known, documented limitation, not an oversight.
- **Accessibility statement page added** (`/accessibility.html`), linked from every page's footer. States WCAG 2.2 AA as the conformance target using self-assessed, honest language — explicitly not claiming an independent audit, since none has been done — and lists specific known limitations (no screen-reader testing performed, no automated scan run, formal HTML/CSS validation still outstanding).
- **Human-readable sitemap page added** (`/sitemap.html`), linked from every page's footer, listing every real page on the site grouped by Main / Services / Legal & policies. Both new pages were also added to `sitemap.xml` and `data/search-pages.json` so they're indexable and searchable, consistent with the site's existing conventions.
- **The headshot image (`neil-catton-headshot.jpg`) now serves WebP** with a JPEG fallback via `<picture>`, on the three pages that use it (home, about, contact) — roughly 45% smaller (49KB → 28KB) with no visible quality loss. `loading="eager"` was kept explicit on all three, since this image is above the fold on every page it appears on and is the likely LCP element.

**Still open — see Section 19:**
- Formal validation against the W3C Nu HTML Checker and CSS Validator. Two attempts to run this via the available web-fetch tool against the live site did not return a usable report in this environment (the tool echoed the request URL rather than returning validator output) — this needs to be run manually.
- The two unused, uncompressed image assets (`neil-catton-photo.jpg`, 555KB; `NC-logo.png`, 161KB) are still sitting in `/images/` — still flagged, not actioned, since deleting files wasn't part of this pass.

**Correction to the first pass's contrast finding (23 July 2026):** Section 3's "already compliant, no action needed" verdict on colour contrast was true for the primary ink/paper/accent palette (15.99:1 for body text — nowhere close to a problem) but hadn't been precisely checked against every translucent-white-on-dark-ink combination used for small uppercase labels. Computing the actual contrast ratios (relative luminance formula, not visual estimation) found four failing values in live use as text colour: `rgba(245,242,238,0.3)` (2.55:1 — used on `.footer-copy`, every page), `0.35` (3.02:1), `0.4` (3.55:1, used on `.engagement-label`, `.engagements-label`, `.subscribe-note`, and similar), and `0.45` (4.16:1, used on `.page-label` and `.detail-label` — the kicker tag at the top of nearly every page's dark header). All of these sit on text under 13px, so none qualify for WCAG's relaxed "large text" 3:1 threshold — all needed 4.5:1 and didn't clear it. Fixed: all 68 occurrences of `color: rgba(245,242,238, …)` at those four alpha values, across 25 pages, bumped to `0.55` (5.58:1, a comfortable margin above the 4.5:1 AA minimum). Border and background uses of the same alpha values were left untouched — those fall under the separate 1.4.11 non-text contrast rule (3:1), not 1.4.3, and already clear it. Lesson for future edits: a palette that's excellent at full opacity can still fail once translucency is introduced — check the composited result, not just the base colour.

**Third pass — WAVE and Lighthouse re-audit (23 July 2026):** Neil ran WAVE and Lighthouse against the live site after the second pass and found genuine remaining issues, actioned as follows.

- **Contrast — the second pass's blanket fix missed the accent background case.** The 0.55-alpha fix above was computed against `--ink` (#1a1714) and comfortably clears 4.5:1 there (5.58:1). But several of the same translucent-white labels sit on `--accent` (#2b4a6f) instead — a lighter background that needs alpha ≥ roughly 0.70 for the same text to pass, not 0.55. A proper WCAG relative-luminance script (not hand estimation) was run against every colour/background pair site-wide and found seven real failures still live: `.cluster-nav-label` (services.html, 3.69:1), `.stat-label` (about.html, 4.49:1), `.subscribe-note` (index.html, 3.33:1), `.pub-stat-label` (articles.html, cto-grand-rounds.html, practice-library.html, 4.07:1), and `.framework-download-sub` (books.html, 4.49:1) — all bumped to alpha 0.78 (5.39–5.68:1). Two more used a hardcoded hex rather than the translucent-white pattern and failed worse: `.engagement-item-role` and `.service-card.flagship .service-credential` (both services.html) used `#3d6494` as text on ink background — 2.93:1 — replaced with `#6a94c4` (5.65:1). A related bug was found the same way: `books.html`'s "Book four — in development" kicker had an inline override (`rgba(43,74,111,0.7)`) intended for a light background, mistakenly applied on that section's dark one — 1.55:1, effectively invisible to low-vision readers — corrected to the same `#6a94c4`. A borderline placeholder-text case (`.form-input::placeholder` on `contact.html`, 4.18:1) was also tightened to `#5c5652` (6.47:1) even though placeholder text isn't strictly bound by 1.4.3.
- **Redundant adjacent links (WAVE) — Services/Overview.** Every page's nav dropdown had an "Overview" link as the first item, pointing to the same `services.html` the parent "Services" link already goes to — flagged as adjacent duplicate links. Removed the redundant "Overview" entry and its divider from all 25 pages; the parent "Services" link already covers that destination.
- **Very small text (WAVE).** The site's small-label pattern (`.article-pub`, `.i-card-label`, `.role-tag`, dropdown menu items, and ~30 similarly-named label classes) sat at 0.62–0.68rem (9.9–10.9px). Bumped sitewide: 0.68rem → 0.72rem, 0.66rem → 0.72rem, 0.65rem → 0.7rem, 0.62rem → 0.68rem. The one exception left untouched is the single-glyph dropdown caret (`▾`, 0.55rem, decorative and `aria-hidden`).
- **ARIA hidden content (WAVE) — real content wrongly hidden from screen readers.** A scripted check (parsing every `aria-hidden="true"` element site-wide with BeautifulSoup) found no case of a hidden element trapping a still-focusable link or button, but did find eight `.section-label`/`.selector-label` elements — "Books", "Writing", "Services", "Contact", "Frequently asked", "The collection", "Colleagues & clients", "Not sure where to start?" — marked `aria-hidden="true"` on some pages while identical labels elsewhere on the very same pages (e.g. `service-ai-board-briefing.html`'s other section labels) were correctly exposed. These are genuine section-identifying eyebrow text, not decorative, and the wording doesn't duplicate the heading that follows — removed `aria-hidden="true"` from all instances so screen reader users get the same section context sighted users do.
- **Lighthouse Best Practices (77) — third-party cookies and payload.** The Substack subscribe `<iframe>` on `index.html` and `articles.html` was the only plausible source of the 18 third-party cookies and a meaningful share of the ~1MB "unused JavaScript" the report flagged, since it sits well below the fold on both pages but was loading eagerly. Added `loading="lazy"` to both — functionally identical once a visitor scrolls to it, but no longer loaded (and no longer setting cookies or shipping its JS) during Lighthouse's above-the-fold navigation audit or for visitors who never scroll that far.
- **Lighthouse — cache lifetimes (46 KiB estimated saving).** `netlify.toml` had no explicit `Cache-Control` headers for static assets. Added long-lived, immutable caching for `/images/*` and the favicon files (content only changes by replacing the file), a week for `/downloads/*` (PDFs), and a day for `/search.js`. HTML pages were deliberately left off this list — their content changes without a filename change, so aggressive caching there would risk stale pages.
- **Left open, deliberately:** Lighthouse's "reduce unused CSS/JS" (~20 KiB / remaining JS) is architectural — every page carries its own full inline `<style>` block covering elements that page doesn't use, a direct consequence of the single-file-per-page pattern this site is built on (see the CSP note above about the same pattern). Fixing it properly means externalising shared CSS/JS into common files, which is a build-approach change, not a header or markup fix — flagged for Neil's decision rather than actioned unasked. The "more than 4 preconnect connections" warning couldn't be reduced from the site's own markup either — only two explicit `<link rel="preconnect">` exist per page (Google Fonts); the warning is almost certainly counting connections the Substack embed opens once it loads, which the lazy-load fix above should now defer for most visitors.

---

## 19. Follow-up priority list

What's left, now that cookie consent, CSP, the accessibility statement, the sitemap page, and WebP delivery are done:

1. **Create the Plausible account and verify the domain at plausible.io.** Without this, the analytics script deployed today reports to nowhere — it's wired correctly but inert until the account exists. Five minutes, but only Neil can do it.
2. **Test the new CSP on the next deploy.** Check the browser console on the homepage, a service page, and the contact page for anything blocked — the TidyCal link, the Substack embed, and the feed-fallback fetches are the most likely to be affected by a too-tight policy.
3. **Formal HTML/CSS validation pass.** Run the live site through the W3C Nu HTML Checker and CSS Validator directly once deployed — couldn't be completed from this environment; five minutes once convenient.
4. **Decide on the two orphaned images** (`neil-catton-photo.jpg`, `NC-logo.png`) — use them, compress and keep them, or remove them.
5. **security.txt maintenance.** Already added; the file declares an expiry one year out — revisit it annually.

## 20. Fourth pass — WAVE and Lighthouse re-audit (23 July 2026)

Neil ran WAVE and Lighthouse against the live site again after the third pass and found genuine remaining issues, actioned as follows.

**Contrast — decorative numerals and icons.** WAVE flagged the Roman-numeral and numbered-box markers used as decorative labels across Home, About, Books, and Services. These turned out to be set at full opacity in `#d4cfc9` (the site's rule/border grey) rather than a low-alpha tint, computing to 1.28–1.39:1 against the paper backgrounds — a severe failure even against the relaxed 3:1 large-text threshold. Fixed by introducing a new, darker value, `#7f7c79` (a 0.6-factor darkening of `#d4cfc9`, verified by script), applied to `.book-number` (index.html), `.service-number` (services.html), and `.book-num` (books.html, including one inline override). Related lighter-weight instances — the roman-numeral markers inside `.test-name em` on about.html and Book IV's inline numeral on books.html — were bumped from `rgba(212,207,201,0.2–0.35)` to `rgba(212,207,201,0.45)`, and the `.service-icon` opacity on index.html was raised from 0.7 to 0.85. All values re-verified against the contrast calculator after the change.

**Redundant links.** WAVE flagged adjacent links to the same destination on Home, Articles, and Practice Library, where each content card renders both a linked title and a secondary "Read"/"View" link. The accepted fix is to keep one link exposed to assistive technology and remove the other from both the accessibility tree and the tab order. Applied `aria-hidden="true" tabindex="-1"` to the secondary link in the card-rendering JavaScript on index.html and articles.html (two-link pattern), and to both the secondary image-wrap and link elements on practice-library.html, which had a three-way duplicate per card. The visible title link remains the single accessible route to each piece in every case; mouse behaviour is unchanged.

**Missing H2 headings.** WAVE flagged Articles, Practice Library, and CTO Grand Rounds for skipping from H1 to lower-level text with no H2 in between. The Substack/publication panel name on articles.html and practice-library.html (`<p class="substack-panel-name">The Next Evolution</p>`) and the panel name on cto-grand-rounds.html (`<p class="gr-panel-name">CTO Grand Rounds</p>`) were both promoted to `<h2>`, preserving their existing classes and visual styling.

**Device-dependent event handler.** WAVE flagged the "Follow on Substack" button on books.html for using `onmouseover`/`onmouseout` handlers, which have no keyboard equivalent. Removed both inline handlers and replaced them with a new `.btn-follow-substack` CSS class using `:hover, :focus-visible`, so keyboard users get the same visual feedback as mouse users. Confirmed via a site-wide grep that this was the only instance of a mouse-only handler anywhere on the site.

**Small text — Engagement Details.** WAVE flagged the "Engagement Details" heading and its key/value labels as too small to read comfortably across all twelve individual service pages. `.details-grid .k` was increased from `0.68rem` to `0.8rem`, and the FAQ `.section-label` (the same "Frequently asked" label addressed for `aria-hidden` misuse in the third pass) was increased from `0.7rem` to `0.75rem`, applied consistently across all twelve pages.

**ARIA hidden content.** WAVE reports an "instance count" of every `aria-hidden="true"` usage on every page — Home, About, Articles, Practice Library, Books, Press, Contact, Services, each individual service page, CTO Grand Rounds, Site Map, Accessibility, and Privacy — which is not itself a defect count. Re-ran the focus-trap check (every `aria-hidden="true"` element scanned for focusable descendants lacking `tabindex="-1"`) across the whole site: zero focus traps, including the new redundant-link suppressions added this pass, which correctly pair both attributes. Re-ran the meaningful-hidden-text check at a lower threshold than the third pass: the remaining hits are legitimate decorative markers (Roman numerals, short code labels) already paired with visible accessible text elsewhere in the same component. No further changes required here; the WAVE count reflects volume of decorative markup, not remaining defects.

**Lighthouse — third-party cookies on Articles.** The third pass's `loading="lazy"` fix on the Substack iframe resolved index.html's Best Practices score (now 100) but not articles.html's, which the newly-supplied Lighthouse report still showed at 77 with 17 cookies recorded during the audit — native lazy-loading's preload-distance heuristic was still overlapping the page's shorter above-the-fold layout during Lighthouse's non-scrolling capture. Replaced native lazy-loading with a stricter `IntersectionObserver`-based pattern on both index.html and articles.html for consistency: the iframe's `src` is now held in `data-src` until the element enters the viewport with a `0px` root margin, with a `<noscript>` fallback link preserved for non-JS users.

All fixes re-verified programmatically (contrast calculator, BeautifulSoup focus-trap and hidden-text scans, site-wide grep for the removed handler pattern and for any remaining `loading="lazy"` iframe) rather than by visual inspection alone.

---

This specification should sit alongside the site itself as a living reference — update it when a standard changes (a new WCAG version, a Core Web Vitals metric change, a new page added to the site) rather than treating it as fixed at today's date.

---

## 21. Fifth pass — full rebuild (20 August 2026)

Neil commissioned an independent design and build review (`../Reviews/neilcatton-com-design-review-2026-08-20.md`), then asked for every finding in it to be actioned. This section records what changed and, more usefully, what it means for how the site is edited from now on.

### 21.1 What the review found that four previous passes had not

Two defects, both mobile, both severe, both invisible from a desktop browser.

- **There was no navigation below 580px.** `.nav-links { display: none }` fired and nothing replaced it. No hamburger existed anywhere in the codebase. The search control and the "Book a call" button lived inside that list and disappeared with it.
- **Twenty-six of the thirty-three pages scrolled sideways on a phone.** `.footer-links` was a twelve-item flex row with no `flex-wrap`, measuring 1093px against a 375px viewport. Eight of the twelve links spilled past the footer's dark background and rendered near-white on the paper ground — measured at **1.06:1**. Between the two, a phone visitor could see four destinations on the whole site. Contact was not one of them.

The second is the important one, because of *why* it survived. `flex-wrap: wrap` had been added to that rule on six pages and never reached the other twenty-six. With 33 copies of the stylesheet, a fix is 33 fixes and a partial fix looks exactly like a complete one.

### 21.2 The structural change

The site is now generated. `src/` holds templates and data; `npm run build` produces `dist/`; Netlify runs the build on deploy. `README.md` is the working reference.

| | Before | After |
|---|---|---|
| Inline CSS | 10,122 lines across 33 files | 0 — one shared stylesheet plus per-page files |
| Duplicated CSS rule instances | 69% | none |
| Service pages | 12 documents differing in 47 lines | 1 template + `services.json` |
| `sitemap.xml`, `sitemap.html`, search index | hand-maintained | generated from the page list |
| Years-in-technology figure | "thirty-seven" on 12 pages, "thirty-nine" on 1 | computed from 1987 every build |
| Substack host | two (`writing.` and `.substack.com`) | one |
| Fonts | Google Fonts CDN | self-hosted (both OFL) |
| CSP | `'unsafe-inline'` on script and style | `'self'` on both |
| Accessibility testing | manual passes | axe-core, reflow and target-size gate on every push |

Section 18's note that externalising the CSS "is a build-approach change, not a header or markup fix — flagged for Neil's decision rather than actioned unasked" is now closed. So is Section 19 item 4 (the orphaned images are still there and still worth a decision) and the `security.txt` item — the file existed but sat one directory above the git root and had never been deployed. It returned 404 on the live site until this pass.

### 21.3 Rules this pass adds

These belong in Section 17's acceptance checklist for every new page.

1. **No shared style or script gets written into a page.** If it belongs to the site, it goes in `src/assets/site.css` or `site.js`. This is the whole point.
2. **A fact that appears twice is a token.** `src/data/site.json` plus `{{token}}`. An unknown token fails the build.
3. **A styled `div` is not a heading.** Every service and briefing page had five content sections marked up as `<div class="section-label">` — visually headings, semantically nothing, so a screen reader user navigating by heading went straight from the `h1` to the FAQ. They are `h2` elements now.
4. **The `h1` goes inside `<main>`.** Sixteen pages had it in a second body-level `<header>`, which reads as a second banner landmark and let the skip link jump past the page title.
5. **Menus open on click, not hover.** Hover-only cannot be operated by touch and reports no state. Dropdown parents are `<button aria-expanded>`; the section index is the first item inside the menu rather than a duplicate link beside the parent.
6. **`npm run check` passes before publishing.** Zero axe violations, zero horizontal overflow at 375px, no control under 24×24.

### 21.4 Contrast note, extending Section 18's

Two more failures were found that the earlier alpha sweeps had missed, both because they were computed against the wrong ground:

- `.card-companion-label` on the Pattern Map — `#a8a29b` on paper, **2.26:1** at 10.9px. The Pattern Map was built after the previous sweeps ran.
- Three translucent panel labels (`.substack-panel-label`, `.method-panel-label`, `.gr-panel-label`) at 0.55 alpha. They sit on a 0.06-alpha paper wash over `--ink`, which lightens the ground enough that 0.55 no longer clears 4.5:1. Raised to 0.86.

The lesson is the same one Section 18 drew and worth restating: check the composited result on the ground the text actually sits on, not the base colour and not the ground you assume. The tokens `--on-dark` (0.78), `--accent-lift` and `--marker` now carry the safe values so they do not have to be rederived.

### 21.5 Still open

1. **A manual screen-reader pass.** VoiceOver on Safari, thirty minutes, once. The automated gate reaches roughly a third of the WCAG criteria; `accessibility.html` says so and should keep saying so until this is done.
2. **W3C Nu HTML Checker and CSS Validator** against the deployed site. Still not run.
3. **Verify the tightened CSP on the first deploy preview.** `script-src` and `style-src` are now `'self'`. JSON-LD blocks are data rather than executable script and browsers do not apply `script-src` to them, but confirm in the console and run a service page through the Rich Results Test. If something is blocked, add hashes rather than restoring `'unsafe-inline'`.
4. **The LinkedIn URL** for `Person.sameAs`. The field exists in `site.json` and is empty; nothing on the site sources it. One line, and it is the strongest entity signal a solo practice has.
5. **The two orphaned images** (`neil-catton-photo.jpg`, `NC-logo.png`). Still unreferenced, still uncompressed, still flagged since July.
6. **Print-resolution headshot.** The new press pack offers the 680×680 web file and says a high-resolution one is available on request. Putting one in `/downloads` would close that loop.
7. **"Three decades."** The bare year counts are tokenised, but the phrase "three decades" survives in prose on several pages. At thirty-nine years it understates rather than misleads, so it was left rather than rewritten mechanically — worth an editorial pass.
