# Accessibility findings — closed 20 August 2026

This was a running list from a WAVE pass. Every item on it has now been
actioned or assessed, in the rebuild recorded in Section 21 of
`website-design-specification.md`. Kept as a record rather than deleted.

| Original item | Outcome |
|---|---|
| Contrast: Roman numerals on the book and service cards | Already fixed in the fourth pass (`--marker`, `#7f7c79`). Verified: no contrast violations anywhere at 375px or 1280px. |
| Contrast: numbered service boxes | As above. |
| Redundant links: title and "Read" / "View on Substack" on Home, Articles, Practice Library | Already handled with `aria-hidden` plus `tabindex="-1"` on the secondary link, which is the correct treatment. Retained. |
| Missing H2: "The Next Evolution" publication panel on Articles and the Practice Library | Fixed in the fourth pass; still correct after the rebuild. |
| Missing H2: "Curated By" on CTO Grand Rounds | As above. |
| Very small text: "Engagement details" headings on the service pages | Fixed. Every page-level label below 0.75rem was raised to 0.75rem sitewide — 111 declarations. |
| Device-dependent event handler: "Follow on Substack" on Books | Fixed in the fourth pass. A site-wide check confirms no `onmouseover`/`onmouseout` remains. |
| ARIA hidden: instance counts across every page | Not defects. WAVE reports every `aria-hidden="true"` as an item to review, not an error. A scripted check for focusable descendants inside hidden elements returns zero across the whole site. Stop tracking this number. |

## What the same review found that this list did not

- No navigation at all below 580px, and no hamburger anywhere in the codebase.
- Twenty-six of thirty-three pages scrolling sideways on a phone, with eight
  footer links rendering off-canvas at 1.06:1.
- Five content sections per service page marked up as `div` rather than headings.
- Every in-page anchor, including the skip link, landing underneath the fixed nav.
- `security.txt` returning 404 on the live site.
- The contact page's form posting to `action="#"` with the real endpoint only in
  JavaScript — a dead end with JavaScript disabled.

All actioned. An automated check now runs on every change so that the first two
categories cannot recur silently: `node tools/check-a11y.mjs`.
