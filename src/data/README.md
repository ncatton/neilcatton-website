# data/practice-library.json and data/practice-cards.json — the Practice Library

Generated, never edited by hand. Both files, and every image under `images/cards/<slug>/`, are written by `OUTPUTS/Practice Library Redesign/tools/import_to_site.py` from the card data in `OUTPUTS/Practice Library App/data/` (cards.json, items.json), each card's release note, and the situation tags in `OUTPUTS/Practice Library Redesign/situation-tags-for-review.md`.

- `practice-library.json` is the catalogue: books, the situations shown as filters (any with at least three cards), and one entry per card (slot, slug, title, book, form, "For when…" line, page URL, list image, situations, date). The library page, its deck, the card feed `/practice-library.xml` and the build all read it. It is also copied to `dist/data/`.
- `practice-cards.json` holds each card's full text, closing panel and release note for its page. Build-time only.

## Adding or changing a card

1. Build or correct the card's data (the practice-card skill).
2. `python3 render_cards.py <slot>` in the tools folder: draws the A4 card in the website design.
3. `python3 import_to_site.py`: rewrites both JSON files and the card's images in this repo.
4. Build, check, commit, push. The card's page, its place in the deck and list, the feed, the sitemap and site search all follow from the catalogue.

Substack no longer feeds the library. The `practice-library-feed` function was retired on 9 November 2026.

# data/essays.json and data/essay-bodies.json — the essays

Generated, never edited by hand, by `OUTPUTS/Article Publishing Model/tools/import_essays.py`, with the covers in `images/essays/<slug>/` (cover-480/800/1600.webp, share.jpg). The back catalogue came from the published Substack posts (the archive in `OUTPUTS/Article Publishing Model/import/`); new essays come from their final markdown file and cover, website first.

## Publishing an essay

1. Day 1: `python3 import_essays.py --add "<final essay>.md"` (cover image beside the file, or `--cover`). The essay needs its row in the published-articles index first. Build, check, commit, push: the essay page, Writing page, homepage, feed, sitemap and search all follow.
2. Day 2, after Substack sends it: `python3 import_essays.py --substack <slug> <Substack post URL>`. Build, commit, push: the page's "Talk about it" panel now points to the Substack post.

# data/announcements.json — the homepage signpost

Short announcements shown as a slim bar at the top of the homepage (index.html), above the hero. Used to signpost current activity — a new CTO Grand Rounds session, a talk, a launch — with a link through to wherever the detail lives.

## Publishing ritual

Add one entry to the `announcements` array:

```json
{
  "id": "short-unique-slug",
  "text": "One sentence, plain, no more than ~120 characters.",
  "link": "cto-grand-rounds.html",
  "linkText": "View sessions",
  "date": "2026-07-11",
  "expires": null
}
```

Field notes:

- `id` — a short unique slug. Not displayed; just needs to be unique in the file.
- `text` — the announcement copy. Keep it to one sentence.
- `link` — where the "read more" link goes. Relative (`cto-grand-rounds.html`) or absolute (`https://…`).
- `linkText` — the link label, e.g. "View sessions", "Read more", "Register".
- `date` — ISO format. Announcements are shown newest first. An entry dated in the future stays hidden until that date, so a launch-day announcement can be committed in advance.
- `expires` — ISO date, or `null` for no expiry. Once today's date passes `expires`, the entry stops showing automatically — no need to remove it manually, though tidying the file occasionally is still good practice.

The homepage shows the three most recent announcements that have reached their `date` and not passed their `expires`. If the array is empty (or every entry has expired), the bar does not render at all.

---

# data/search-pages.json — the site search index

Powers the site-wide search overlay (`search.js`, loaded on every page). This file is the static half of the search dataset — one entry per page in the Website folder. The dynamic half (Substack articles) comes live from `/.netlify/functions/search-feed`, which pulls the full archive across every section, so no publishing ritual is needed on that side.

## Publishing ritual

When a new page is added to the site, add one entry to the `pages` array:

```json
{
  "title": "Page Title",
  "url": "/new-page.html",
  "section": "Services",
  "description": "The same one- or two-sentence description used in the page's <meta name=\"description\">."
}
```

Field notes:

- `title` — shown as the result heading. Match the page's `<title>` (minus the "— Neil Catton" suffix reads better in results).
- `url` — root-relative, leading slash, matching the file name exactly.
- `section` — a rough category (Home, Company, Services, Writing, Books, Press, Programmes). Not currently shown in the UI but kept for future grouping.
- `description` — reuse the page's meta description; keeps this file and the page itself from drifting apart.

`404.html` is deliberately excluded — it isn't a real destination. Everything else in the folder should have an entry.
