# neilcatton.com

Static site. Templates and data live in `src/`; `npm run build` turns them
into `dist/`, which is what Netlify publishes. No framework, no bundler,
no runtime dependencies.

```bash
npm install
npm run build     # src/ -> dist/
npm run serve     # build, then serve dist/ on :8080
npm run check     # build, then run the accessibility and link checks
```

Netlify runs `npm run build` on every deploy, so `dist/` is not committed.

---

## Why there is a build step now

The site used to be 33 hand-edited HTML files, each carrying its own full
copy of the shared CSS and JavaScript. That came to 10,122 lines of inline
CSS across the site, 69% of it a duplicate of a rule on another page.

The cost was not page weight. It was that every shared fix had to be made
33 times, and the failure mode was silent. `flex-wrap: wrap` was added to
`.footer-links` on six pages and never reached the other twenty-six, so
most of the site scrolled sideways on a phone — with eight of the twelve
footer links rendering off-canvas at 1.06:1 contrast, which is invisible.
Four documented manual audit passes went by without catching it.

Everything shared now exists once, and a check runs on every change.

---

## Layout

```
build.mjs               the whole build, ~360 lines, commented
netlify.toml            build command, redirects, security headers, caching

src/
  assets/
    site.css            the design system — tokens, nav, footer, components
    site.js             shared behaviour — nav, feed, forms, lazy embeds
    search.js           the search overlay
    fonts.css           self-hosted @font-face declarations
    fonts/              woff2 files (Playfair Display, Source Sans 3; OFL)
  data/
    site.json           canonical facts, the nav, the footer
    services.json       the twelve service pages, as data
    briefings.json      the sector briefings register
    practice-library.json  the Practice Library card register
    patterns.json       the Pattern Map
    announcements.json  the homepage announcement bar
  pages/                one file per authored page: JSON front matter + body
  templates/
    base.html           the document shell
    partials/           nav, footer, briefing card
    layouts/            service, briefings, practice-library, pattern-map, sitemap

tools/
  check-a11y.mjs        axe-core + reflow + target size, 375px and 1280px
  check-links.mjs       every internal reference and fragment resolves
  diff-content.mjs      one-off: compares rebuilt pages against the old ones
  migrate.mjs           one-off: the record of what the migration did

netlify/functions/      Substack feed, search feed, practice library feed,
                        and the Claude-backed plan generator
```

`dist/`, `node_modules/` and `.DS_Store` are gitignored.

---

## Adding a page

Create `src/pages/whatever.html`:

```html
<!--page
{
  "title": "Page title — Neil Catton",
  "description": "120–158 characters, written to earn the click.",
  "searchTitle": "Short label for the sitemap and search"
}
-->
<header class="page-header">
  <div class="page-header-inner">
    <p class="page-label">Section</p>
    <h1 class="page-title">The heading</h1>
    <p class="page-standfirst">One paragraph.</p>
  </div>
</header>

<section class="section">
  <div class="section-inner">…</div>
</section>
```

That is all. The build supplies the doctype, head, canonical, Open Graph,
Person schema, skip link, nav, `<main>`, footer, and the script tags. The
page appears in `sitemap.xml`, `sitemap.html` and the search index without
being added to any list by hand.

Optional front-matter keys:

| Key | Effect |
|---|---|
| `slug` | Output filename. Defaults to the source filename. |
| `css` | Page-specific CSS. Written to `/assets/pages/<slug>.css`, never inlined. |
| `js` | Page-specific JavaScript. Written to `/assets/pages/<slug>.js`, never inlined. |
| `jsonld` | Array of JSON-LD objects, emitted after the sitewide Person block. |
| `layout` | Render the body through `src/templates/<layout>` first. |
| `data` | Data files the layout needs, by filename stem. |
| `robots` | e.g. `"noindex, follow"`. Excludes the page from the sitemap and search index. |
| `canonical` | `false` to omit the canonical tag (error pages). |
| `section` | Which nav group to mark as current. Usually inferred from the slug. |
| `ogImage`, `ogTitle`, `ogDescription` | Override the defaults. |
| `sitemapGroup` | Which sitemap heading the page sits under. |

---

## Canonical facts

Anything appearing on more than one page belongs in `src/data/site.json`,
not retyped into the page. Reference it with `{{token}}` in page content,
front matter, or `site.json` itself.

| Token | Value today |
|---|---|
| `{{years}}` / `{{years.words}}` / `{{years.Words}}` | `39` / `thirty-nine` / `Thirty-nine` |
| `{{sectors}}` | `20+` |
| `{{substack}}` / `{{substackName}}` | the Substack URL and title |
| `{{booking}}` / `{{formspree}}` / `{{email}}` | the third-party endpoints |
| `{{year}}` / `{{buildDate}}` | build time |

The years figure is computed as `currentYear − careerStartYear` (1987), so
it recalculates on every deploy. Before this the site said "thirty-seven
years" on twelve pages and "thirty-nine years" on one, and would have gone
stale on 1 January regardless.

An unknown token fails the build rather than rendering as `{{typo}}`.

---

## The design system

`src/assets/site.css` is the whole of it, and it is commented. The rule is
simple: **if a style belongs to the site rather than to one page, it goes
there.** Page-specific CSS stays in that page's `css` front matter.

Components: `.site-nav` (desktop bar and mobile panel from one `<ul>`),
`.site-footer`, `.btn` / `.btn-primary` / `.btn-secondary` / `.btn-paper` /
`.btn-ghost-light` / `.link-cta`, `.section` / `.section-inner` /
`.section-label` / `.eyebrow` / `.section-heading` / `.section-rule`,
`.page-header` (plus `--light`), `.detail-header` / `.detail-section` /
`.detail-section-heading`, `.details-grid`, `.faq-item`, `.engagement-cta`,
`.form-field` / `.form-input` / `.form-success` / `.form-error` / `.form-hp`,
`.related`, `.announce-bar`, `.breadcrumb`, `.search-overlay`.

Two things not to undo:

- **Contrast.** Translucent paper on `--ink` stops clearing 4.5:1 below
  0.55 alpha, and on `--accent` below about 0.78. The tokens `--on-dark`,
  `--accent-lift` and `--marker` exist so this does not have to be
  rediscovered. Check the composited result, not the base colour.
- **`flex-wrap`.** See above.

---

## Checks

`node tools/check-a11y.mjs` loads every page at 375px and 1280px and fails on:

1. any axe-core violation at WCAG 2.0/2.1/2.2 level A or AA
2. any horizontal overflow (`scrollWidth` beyond `clientWidth`)
3. any standalone link or control below 24×24 CSS pixels (SC 2.5.8)

`node tools/check-links.mjs` fails on any internal reference or `#fragment`
that does not resolve, and lists orphan pages. `--external` also checks
outbound URLs; that runs monthly in CI rather than on every push, so
someone else's outage cannot block a deploy.

Both run in GitHub Actions on push and pull request
(`.github/workflows/checks.yml`).

`CHROMIUM_PATH=/path/to/chrome` makes the accessibility check use a system
Chromium instead of Playwright's own download.

What the checks do **not** cover: a real screen-reader pass, and formal
W3C HTML/CSS validation. Automated testing reaches roughly a third of the
WCAG criteria. `accessibility.html` says so on the site, and should keep
saying so until someone does the manual pass.

---

## Before publishing a page

- Unique title and a 120–158 character description
- One `h1`, and real `h2`/`h3` elements rather than styled `div`s
- Alt text on every meaningful image, `alt=""` on decorative ones
- UK spelling
- Relevant JSON-LD (Person is automatic; add Service, FAQPage,
  BreadcrumbList, CollectionPage as they apply)
- `npm run check` passes
