# AGENTS.md

## Project Overview

- Static single-page app for Melissa ISD staff to check whether books are in the Melissa ISD library catalog.
- There is no backend, package manager, bundler, or framework; the app is plain `index.html`, `styles.css`, `script.js`, and `lib.js`.

## Commands

- Install: none.
- Dev: `python3 -m http.server 8888`, then open `http://localhost:8888`.
- Stop dev server: `kill $(lsof -ti tcp:8888)`.
- Regenerate catalog: `python3 generate-catalog.py` (takes ~30 min; overwrites `catalog.json`).
- Test: `node --test test.js` (requires Node 18+). Then verify in a browser manually.
- Lint/typecheck: none configured.
- Deploy: push `main`; GitHub Pages serves from `main` when enabled in repo settings.

## Working Rules

- Keep changes scoped to the app files unless updating docs:
  - `index.html` for structure, tabs, and external script/style links.
  - `styles.css` for all visual, responsive, and print styling.
  - `lib.js` for pure utility functions (parsing, filtering) — no DOM, no Fuse.
  - `script.js` for all state, fetching, search, and UI behavior.
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
  - Loads Montserrat CSS through `styles.css`, Fuse.js from cdnjs, then `lib.js`, then `script.js`.
  - Defines the Melissa ISD header, One Book tab, A Whole List tab, paste input, CSV upload, and status/result containers.
- `styles.css`
  - Contains all theme variables, layout, cards, tabs, result states, bulk table, print styles, and mobile rules.
  - Includes `@media print` for printable bulk results and `@media (max-width: 480px)` for small screens.
- `lib.js`
  - Pure functions with no DOM or Fuse dependency. Loaded as a plain `<script>` in the browser (globals) and `require()`-able in Node for testing.
  - `esc()` — HTML-escapes user-controlled strings before insertion.
  - `splitCSVLine()` / `parseCSV()` — RFC-ish CSV parser for bulk upload.
  - `parsePaste()` — splits paste input into `{ title, author }` objects; handles tab-separated and `Title > Author` formats.
  - `filterCatalog(catalog, query)` — filters the catalog array with word-boundary regex; returns `null` when query is all stop words (signals caller to fall back to Fuse).
- `script.js`
  - Top-level constants configure Fuse thresholds:

    | Constant | Purpose |
    |---|---|
    | `FUSE_THRESHOLD` | Fuzzy match tolerance for single search (0.35) |
    | `BULK_SCORE_LIMIT` | Stricter tolerance for bulk lookup (0.3) |

  - `loadBooks()` fetches `catalog.json`, populates `catalog[]`, and builds the Fuse index.
  - `doSearch()` calls `filterCatalog()` from `lib.js`; falls back to Fuse for stop-word-only queries.
  - `lookupBook()` and `renderBulkResults()` power paste/CSV bulk checking via Fuse fuzzy match.
- `test.js`
  - Node.js unit tests using `node:test` + `assert`. Covers `filterCatalog`, `parseCSV`, `parsePaste`, `esc`, and `splitCSVLine`. Run with `node --test test.js`.

## Code Style & Conventions

- Plain browser JavaScript only; no ES modules, classes, or generated assets. `lib.js` uses a conditional `module.exports` guard so it works in both browser (global script) and Node (require).
- Existing style uses `const`/`let`, small named functions, and top-to-bottom initialization.
- Use double quotes in JavaScript strings unless template literals are needed.
- Keep UI copy plain and direct for teachers/non-technical volunteers.
- Result language should answer "can I use this book?" rather than expose implementation details.
- Match existing CSS patterns:
  - Theme colors live in `:root`.
  - Components use compact comments such as `/* -- Bulk upload -- */`.
  - Mobile and print rules stay at the bottom.

## Testing Expectations

Run `python3 -m http.server 8888` and verify in a browser after any change.

**App load**
- TC1: Status bar shows title count (13,801) and generation date.
- TC2: Tab switching clears the other tab's state.

**Single search**
- TC3: Exact title in catalog: "Dog Man" → Found, shows Dog Man series entries.
- TC4: Partial title: "frog and toad" → Found, shows Frog and Toad series.
- TC5: Multi-word precision: "harry potter" → Found, no garbage results.
- TC6: Word-boundary check: "man" → includes "Dog Man" and "Iron Man"; excludes "Batman", "human", "Germany".
- TC7: Not in catalog: "Charlotte's Web" → Not Found, guidance text shows.
- TC8: One-character query: "d" → no search fires, empty state stays visible.
- TC9: Stop-word-only query: "the" → falls back to Fuse fuzzy, no crash.

**Bulk — paste**
- TC10: Single full title: "Diary of a Wimpy Kid : dog days" → Found.
- TC11: Multiple titles: "Hatchet" + "Charlotte's Web" (one per line) → Found + Not Found, summary counts correct.
- TC12: Tab-separated from Excel: copy two cells (title + author) from a spreadsheet and paste — author ignored, title matched. Cannot be tested by typing; requires an actual paste from Excel or Sheets. To simulate without a spreadsheet, run in the browser console: `document.getElementById('pasteInput').value = "Bridge to Terabithia\tKatherine Paterson";` then click Check List.
- TC13: `Title > Author` format: "Matilda > Roald Dahl" → title matched, author ignored, Found.
- TC14: Mixed found/not found → guidance text appears below table.

**Bulk — CSV upload**
- TC15: CSV with title column → parses and renders Found/Not Found.
- TC16: Empty file or no title column → error message, no crash.

**Visual / responsive**
- TC17: Mobile width (~480px) fits inputs, buttons, and bulk table.
- TC18: Print from bulk results hides page chrome and preserves the table.

## Destiny Catalog Notes

- The browse endpoint (`presentbrowsesearchresultsform.do`) ignores `siteTypeID` and `siteID` — per-school scoping is not possible via browse. All parameter combinations return the same full ESC11 consortium catalog. Do not re-investigate this.
- Author and reading grade level are available but require a second request per title to `presentbrowseheadingdetailform.do` (~33K additional requests, ~4.5 hours at 2 req/sec). That endpoint requires a `JSESSIONID` cookie; establish a session first by fetching the browse page using `http.cookiejar.CookieJar`.
- The script guards against overwriting `catalog.json` on a failed run (exits with code 1 if zero titles were collected).

## Project-Specific Pitfalls

- `parseCSV()` lives in `lib.js` and is used for CSV upload (bulk check); do not remove it.
- Single search uses word-boundary regex (`\bword\b`), not Fuse — `FUSE_THRESHOLD` only applies to the bulk path and the stop-word fallback in `doSearch()`.
- `BULK_SCORE_LIMIT = 0.3` is intentionally stricter than `FUSE_THRESHOLD = 0.35`; do not tighten casually.
- `BULK_SCORE_LIMIT = 0.3` allows small title typos to match but risks false positives on very short queries (e.g. "ca" → "Caddo"). No minimum length guard is implemented yet.
- `parsePaste()` (in `lib.js`) still extracts author from tab/`>` delimited input, but author is silently ignored by `lookupBook()` — catalog entries are title strings only.
- Empty paste currently does nothing; preserve or intentionally improve that behavior with UI feedback.
- Paste auto-runs once on paste via `setTimeout(runPasteCheck, 0)`; later edits require clicking Check List.
- Fuse.js is loaded from cdnjs without an SRI hash; add `integrity` plus `crossorigin` if hardening the CDN dependency.
