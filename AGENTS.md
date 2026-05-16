# AGENTS.md

## Project Overview

- Static single-page app for Melissa ISD staff to check whether books are in the Melissa ISD library catalog.
- There is no backend, package manager, bundler, or framework; the app is plain `index.html`, `styles.css`, and `script.js`.

## Commands

- Install: none.
- Dev: `python3 -m http.server 8888`, then open `http://localhost:8888`.
- Stop dev server: `kill $(lsof -ti tcp:8888)`.
- Regenerate catalog: `python3 generate-catalog.py` (takes ~30 min; overwrites `catalog.json`).
- Test: no automated test suite; verify manually in a browser.
- Lint/typecheck: none configured.
- Deploy: push `main`; GitHub Pages serves from `main` when enabled in repo settings.

## Working Rules

- Keep changes scoped to the three app files unless updating docs:
  - `index.html` for structure, tabs, and external script/style links.
  - `styles.css` for all visual, responsive, and print styling.
  - `script.js` for all state, fetching, parsing, search, cache, and UI behavior.
- Do not introduce npm, build tooling, modules, transpilation, or a framework without an explicit request.
- Test through a local HTTP server; opening `index.html` via `file://` causes CORS failures when fetching `catalog.json`.
- Escape user-controlled text before inserting HTML; use `esc()` unless deliberately setting trusted markup.
- `setStatusHTML()` accepts HTML by design. Only pass known-safe strings or explicitly escaped dynamic values.

## Codebase Structure

- `generate-catalog.py`
  - Scrapes the full Follett Destiny ESC11 consortium catalog via the title browse endpoint and writes `catalog.json` (a sorted JSON array of title strings).
  - Runs a single browse pass starting at `searchText=a`; no site loop needed — the browse endpoint ignores `siteTypeID`/`siteID` and always returns consortium-wide data.
  - Uses content-based loop detection: stops when a full page returns zero new unique titles.
  - Requires no login; uses `contextCookie=melissa; siteIDCookie=403` and a browser User-Agent.
- `catalog.json`
  - Pre-generated title list (~13,801 entries). Fetched at runtime by `loadBooks()`.
- `index.html`
  - Loads Montserrat CSS through `styles.css`, Fuse.js from cdnjs, then `script.js`.
  - Defines the Melissa ISD header, One Book tab, A Whole List tab, paste input, CSV upload, and status/result containers.
- `styles.css`
  - Contains all theme variables, layout, cards, tabs, result states, bulk table, print styles, and mobile rules.
  - Includes `@media print` for printable bulk results and `@media (max-width: 480px)` for small screens.
- `script.js`
  - Top-level constants configure Fuse thresholds:

    | Constant | Purpose |
    |---|---|
    | `FUSE_THRESHOLD` | Fuzzy match tolerance for single search (0.35) |
    | `BULK_SCORE_LIMIT` | Stricter tolerance for bulk lookup (0.3) |

  - `loadBooks()` fetches `catalog.json` and builds the Fuse index.
  - `parseCSV()` handles uploaded bulk CSV files.
  - `doSearch()` renders single-book fuzzy matches.
  - `lookupBook()` and `renderBulkResults()` power paste/CSV bulk checking.

## Code Style & Conventions

- Plain browser JavaScript only; no imports, modules, classes, or generated assets.
- Existing style uses `const`/`let`, small named functions, and top-to-bottom initialization.
- Use double quotes in JavaScript strings unless template literals are needed.
- Keep UI copy plain and direct for teachers/non-technical volunteers.
- Result language should answer "can I use this book?" rather than expose implementation details.
- Match existing CSS patterns:
  - Theme colors live in `:root`.
  - Components use compact comments such as `/* -- Bulk upload -- */`.
  - Mobile and print rules stay at the bottom.

## Testing Expectations

- After changes, run `python3 -m http.server 8888` and verify in a browser.
- Check at minimum:
  - Initial load fetches `catalog.json` and shows the title count and generation date.
  - Single search returns Found matches and shows Not Found for misses.
  - One-character queries do not show stale results.
  - Bulk paste supports tab-separated lines and `Title > Author` (author is ignored).
  - CSV upload parses the title column and renders Found/Not Found statuses.
  - Tab switching clears the opposite workflow's transient state.
  - Mobile width around 480px still fits inputs, buttons, and bulk table.
  - Print from bulk results hides normal page chrome and preserves the table.

## Destiny Catalog Notes

- The browse endpoint (`presentbrowsesearchresultsform.do`) ignores `siteTypeID` and `siteID` — per-school scoping is not possible via browse. All parameter combinations return the same full ESC11 consortium catalog. Do not re-investigate this.
- Author and reading grade level are available but require a second request per title to `presentbrowseheadingdetailform.do` (~33K additional requests, ~4.5 hours at 2 req/sec). That endpoint requires a `JSESSIONID` cookie; establish a session first by fetching the browse page using `http.cookiejar.CookieJar`.
- The script guards against overwriting `catalog.json` on a failed run (exits with code 1 if zero titles were collected).

## Project-Specific Pitfalls

- `parseCSV()` is still used for CSV upload (bulk check); do not remove it.
- Fuse single search is intentionally looser (`FUSE_THRESHOLD = 0.35`) than bulk lookup (`BULK_SCORE_LIMIT = 0.3`); do not tighten casually.
- `BULK_SCORE_LIMIT = 0.3` allows small title typos to match but risks false positives on very short queries (e.g. "ca" → "Caddo"). No minimum length guard is implemented yet.
- `parsePaste()` still extracts author from tab/`>` delimited input, but author is silently ignored by `lookupBook()` — catalog entries are title strings only.
- Empty paste currently does nothing; preserve or intentionally improve that behavior with UI feedback.
- Paste auto-runs once on paste via `setTimeout(runPasteCheck, 0)`; later edits require clicking Check List.
- Fuse.js is loaded from cdnjs without an SRI hash; add `integrity` plus `crossorigin` if hardening the CDN dependency.
