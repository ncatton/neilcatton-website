# tools

Two of these gate the build. The rest are diagnostics — run them by hand
when the thing they look at changes.

| Tool | What it does |
|---|---|
| `check-a11y.mjs` | **CI gate.** axe-core (WCAG 2.2 A/AA), horizontal overflow, and 24×24 target size, on every page at 375px and 1280px. |
| `check-links.mjs` | **CI gate.** Every internal reference and `#fragment` resolves; lists orphan pages. `--external` also checks outbound URLs (monthly in CI). |
| `probe-csp.mjs` | Serves `dist/` with the exact CSP from `netlify.toml` and reports anything the browser blocks. Run after any CSP change — `style-src 'self'` blocks `style=""` attributes too, which is easy to forget. |
| `probe-interaction.mjs` | 25 behaviour checks: search overlay (open, multi-token match, focus trap, announcement, Escape), nav dropdowns, the mobile panel, and the contact form's failure path. |
| `probe-nojs.mjs` | Renders every JavaScript-dependent page with scripting off and reports how much content survives. The Pattern Map went from 1,066 to 12,015 characters when it was moved to build-time rendering; this is how that stays true. |
| `probe-overflow.mjs` | Names the elements causing horizontal overflow on one page at one width, when `check-a11y` says there is some. |
| `probe-contrast.mjs` | axe's colour-contrast data for one page — foreground, background, computed ratio — when a failure needs diagnosing rather than just reporting. |
| `shots.mjs` | Screenshots at the sizes worth looking at, including the mobile menu open. |
| `diff-content.mjs` | One-off. Compares the rebuilt pages against the pre-rebuild site sentence by sentence, to prove nothing was lost. |
| `migrate.mjs` | One-off. The record of exactly what the August 2026 migration did mechanically, kept so the hand edits after it are distinguishable. |

All the Playwright-based tools accept `CHROMIUM_PATH=/path/to/chrome` to
use a system browser instead of Playwright's own download.

Most expect a server on `localhost:8899` (`npm run serve` uses 8080 —
`cd dist && python3 -m http.server 8899` is the quick version).
`check-a11y.mjs` and `probe-csp.mjs` start their own.
