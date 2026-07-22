# data/practice-library.json — the card register

The permanent record of every published Practice Library card. `practice-library.html` merges this file with the live Substack section feed: the feed surfaces new cards automatically, the register keeps every card on the page after it drops off the RSS window (Substack feeds only carry the most recent ~20 posts). It is also the provenance record — one dated, version-controlled entry per card.

## Publishing ritual

When a card goes out on the Substack section, add one entry to the `cards` array:

```json
{
  "title": "How to Address the Ghost in the Machine",
  "link": "https://writing.neilcatton.com/p/the-post-slug",
  "date": "2026-07-13",
  "book": "I",
  "image": "https://substackcdn.com/...card image URL from the post..."
}
```

Field notes:

- `link` — the canonical Substack post URL. Used to de-duplicate against the live feed, so it must match what the feed reports (no tracking parameters).
- `date` — the publication date, ISO format. This should match the provenance line printed on the card itself.
- `book` — `"I"` (The Next Evolution), `"II"` (The Cognitive Crucible), `"III"` (The Shadow System). Drives the book filter on the page.
- `image` — the card PNG's URL. Easiest source: publish the post, open the card image in the browser, copy the substackcdn URL. The page shows a plain placeholder if it's missing, so a card is never invisible just because the image URL hasn't been added yet.

Newest entries can go anywhere in the array — the page sorts by date. Keeping them in publication order (newest last) makes the file read as the record it is.

---

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
- `date` — ISO format. Announcements are shown newest first.
- `expires` — ISO date, or `null` for no expiry. Once today's date passes `expires`, the entry stops showing automatically — no need to remove it manually, though tidying the file occasionally is still good practice.

The homepage shows the three most recent non-expired announcements. If the array is empty (or every entry has expired), the bar does not render at all.

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
