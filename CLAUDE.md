# CLAUDE.md — neilcatton.com

Generated static site. Read `README.md` (front-matter keys, canonical-fact tokens, design system) and `website-design-specification.md` (standing reference; §21 covers the August 2026 rebuild) before changing anything.

## How it builds
- `src/` holds templates and data. `npm run build` (`build.mjs`, no dependencies) writes `dist/`; Netlify runs the build on deploy. `dist/` is gitignored: never edit it, and never hand-edit generated HTML.
- Repo remote: `github.com/ncatton/neilcatton-website`. Neil pushes; never push without his say-so each time.
- Sitemap, human sitemap, search index and briefings RSS are generated. Don't maintain them by hand.

## Where to edit
- A page: `src/pages/<slug>.html` (JSON front matter in an HTML comment, then body).
- Shared styling: `src/assets/site.css`, the whole design system. Shared behaviour: `src/assets/site.js`.
- Nav, footer, canonical facts, booking link: `src/data/site.json`.
- Page-family styles: `src/assets/shared.css`, `service.css`, `briefing.css`, `sector.css`, `policy.css`, `book.css`, `errors.css`, chosen with `"sheets"` in front matter.
- Service, briefing, sector and book pages are authored files in `src/pages/`. Tiles and the feed come from `src/data/briefings.json` (`tile`), the map from `patterns.json` and `pattern-groups.json`.
- Practice Library: every card has its own page at `/practice-library/<slug>.html`, generated from `layouts/practice-card.html` (styles `practice-card.css`). `src/data/practice-library.json` (catalogue: deck, list, filters, `/practice-library.xml`) and `src/data/practice-cards.json` (each card's text and release note), and the images in `images/cards/<slug>/`, are written by `OUTPUTS/Practice Library Redesign/tools/import_to_site.py` from the card data. Never edit them by hand: change the card data or `situation-tags-for-review.md` and run `render_cards.py` then `import_to_site.py`. Nothing on Substack feeds the library any more.
- Essays: every essay has its own page at `/writing/<slug>.html` from `layouts/essay.html` (styles `essay.css`); the Writing page (`articles.html`) is `layouts/writing.html`; the homepage's latest essay and `/writing.xml` (full text) come from the same catalogue. `src/data/essays.json` (catalogue) and `src/data/essay-bodies.json` (text), and the covers in `images/essays/<slug>/`, are written by `OUTPUTS/Article Publishing Model/tools/import_essays.py`. Never edit them by hand. A new essay goes on the site first (`--add` its final file and cover), and gets its Substack link the next morning (`--substack`). Site search covers essays as pages; it no longer searches Substack.
- `review.html` is authored for Issue One. When an issue is imported, update that page as well as `review.json`.
- Recordings: `audio/<slug>-human-moment.mp3` plus `src/data/audio.json`. Nothing shows until the file exists.
- Downloadable PDFs: `npm run pdfs` rebuilds the twelve service one-pagers (read from the built service pages, so edit the page, not the PDF) and the engagement overview and guide (words in `print/engagement.json`, styles in `print/print.css`). Commit the PDFs in `downloads/`; Netlify doesn't build them.
- Predictive Purpose self-assessment: `/self-assessment.html`. Statements, key and bands in `src/data/self-assessment.json`, verbatim from the book, never paraphrased. Layout `layouts/self-assessment.html`, behaviour `src/assets/self-assessment.js`, styles `self-assessment.css`. It replaced tool.neilcatton.com.
- Data files are under `src/data/`. A bare `data/` folder at the repo root is ignored by the build; flag it, don't write to it.
- Reviews and audits go in `../Reviews/`, outside the repo, so they're never deployed.

## Rules
1. No shared style or script inside a page; it goes in `site.css` or `site.js`.
2. A fact that appears twice is a token in `site.json` (`{{years.words}}`, `{{substack}}`, `{{booking}}`…). Years are computed from `careerStartYear: 1987`. An unknown token fails the build.
3. No inline `style=""` and no `<style>` blocks: the CSP is `style-src 'self'` and drops them silently.
4. Run `npm run check` before publishing (zero axe violations, no horizontal overflow at 375px, no control under 24×24; it also gates CI). Run `npm run check:csp` after any CSP change in `netlify.toml`.
5. Contrast: translucent paper fails 4.5:1 below 0.55 alpha on `--ink`. Keep to the tokens in `shared.css`.
7. `transition-ready.js` must stay in the head after the stylesheets. Without it Chromium skips the number transition whenever a deferred script is pending.
6. `package.json` is load-bearing for the Netlify Functions. Never add `"type": "module"` (`substack-feed.js` and `search-feed.js` are CommonJS; `contact-form.mjs` is ESM). Breaking this still deploys green and then returns 502s.

## Functions
A green deploy doesn't prove the functions work. After any change to `package.json`, `netlify.toml` or `netlify/functions/`, load each function in a clean clone (`node -e "import('./netlify/functions/contact-form.mjs')"`; `require()` the CommonJS ones), then check the live Netlify function log after the first real request.

**Contact form** (`netlify/functions/contact-form.mjs`, `action="/contact-submit"`, rate-limited in `netlify.toml`): sends through Microsoft Graph app-only `Mail.Send`, as and to nc@neilcatton.com. Needs `MSGRAPH_TENANT_ID`, `MSGRAPH_CLIENT_ID` and `MSGRAPH_CLIENT_SECRET` in Netlify, from the Entra app "neilcatton.com contact form". If mail stops arriving with no visible error, read the `contact-form` function log first:
- `AADSTS7000215: Invalid client secret` means the Secret ID was pasted instead of the Value. A Value can only be read at creation, so make a new secret.
- An Exchange Online Application Access Policy limits the app to nc@neilcatton.com (`Get-ApplicationAccessPolicy` to inspect; `Remove-ApplicationAccessPolicy` reverses it). Check it before assuming the secret is wrong.

**Booking** is Microsoft Bookings, set once at the `booking` token in `site.json`.

## Working on the Mac mount
The folder bridge can't delete files, so git can leave stale `.git/*.lock` files: move them aside, don't delete them. Run git and the build in a normal terminal. There is no `_superseded/` folder; a rollback comes from git history.
