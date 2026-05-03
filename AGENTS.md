# AGENTS.md

## Project Overview

- Static single-page app for Melissa ISD staff to check whether books appear on the district approved reading list.
- There is no backend, package manager, bundler, or framework; the app is plain `index.html`, `styles.css`, and `script.js`.

## Commands

- Install: none.
- Dev: `python3 -m http.server 8888`, then open `http://localhost:8888`.
- Stop dev server: `kill $(lsof -ti tcp:8888)`.
- Test: no automated test suite; verify manually in a browser.
- Lint/typecheck: none configured.
- Deploy: push `main`; GitHub Pages serves from `main` when enabled in repo settings.

## Working Rules

- Keep changes scoped to the three app files unless updating docs:
  - `index.html` for structure, tabs, and external script/style links.
  - `styles.css` for all visual, responsive, and print styling.
  - `script.js` for all state, fetching, parsing, search, cache, and UI behavior.
- Do not introduce npm, build tooling, modules, transpilation, or a framework without an explicit request.
- Test through a local HTTP server; opening `index.html` via `file://` causes CORS failures for the Google Sheet fetch.
- Preserve production settings before deploy:
  - `DEV_MODE = false`.
  - `SHEET_CSV_URL` points to the published Google Sheet CSV export.
- Treat the sheet as an approved list:
  - Presence in the fetched list means approved.
  - There is no `approved`/`rejected` field in the app model.
  - "Not Found" means the book is not on the approved list.
- Keep `SAMPLE_BOOKS` in `script.js`; it is intentional demo/local fallback data when the sheet URL is unconfigured.
- Escape user-controlled or sheet-controlled text before inserting HTML; use `esc()` unless deliberately setting trusted markup.
- `setStatusHTML()` accepts HTML by design. Only pass known-safe strings or explicitly escaped dynamic values.

## Codebase Structure

- `index.html`
  - Loads Montserrat CSS through `styles.css`, Fuse.js from cdnjs, then `script.js`.
  - Defines the Melissa ISD header, One Book tab, A Whole List tab, paste input, CSV upload, and status/result containers.
- `styles.css`
  - Contains all theme variables, layout, cards, tabs, result states, bulk table, print styles, and mobile rules.
  - Includes `@media print` for printable bulk results and `@media (max-width: 480px)` for small screens.
- `script.js`
  - Top-level constants configure mode, sheet URL, cache TTL, and Fuse thresholds:

    | Constant | Purpose |
    |---|---|
    | `DEV_MODE` | Shows/hides Refresh + Clear Cache buttons |
    | `SHEET_CSV_URL` | Published Google Sheet CSV URL |
    | `CACHE_HOURS` | How long before re-fetching (default: 24) |
    | `FUSE_THRESHOLD` | Fuzzy match tolerance for single search (0.35) |
    | `BULK_SCORE_LIMIT` | Stricter tolerance for bulk lookup (0.3) |

  - `loadBooks()` fetches/parses/cache-loads book data and builds the Fuse index.
  - `parseCSV()` handles both source sheet CSV and uploaded bulk CSV.
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
  - Initial load fetches the sheet or uses cache/demo fallback with the right status text.
  - Single search returns approved matches and shows Not Found for misses.
  - One-character queries do not show stale results.
  - Bulk paste supports tab-separated lines and `Title > Author`.
  - CSV upload parses title/author/grade-level columns and renders statuses.
  - Tab switching clears the opposite workflow's transient state.
  - Mobile width around 480px still fits inputs, buttons, and bulk table.
  - Print from bulk results hides normal page chrome and preserves the table.

## Project-Specific Pitfalls

- The Google Sheet must be published to web as CSV for a specific tab; merely sharing the sheet is not enough.
- Required source columns are `Title`, `Author`, and `Intended Grade Level`.
- `parseCSV()` finds the grade column with `h.includes("intended grade level")`; renaming the sheet header silently produces blank grade levels.
- Google may cache published CSV output for a few minutes after sheet edits.
- `CACHE_HOURS = 24`; users can see cached data until the TTL expires unless refresh/cache clearing is available in dev mode.
- In production, Refresh List and Clear Cache buttons are hidden by `DEV_MODE = false`.
- Fuse single search is intentionally looser (`FUSE_THRESHOLD = 0.35`) than bulk lookup (`BULK_SCORE_LIMIT = 0.3`).
- Bulk lookup first searches title+author with Fuse `$and`; if that misses or scores too poorly, it falls back to title-only.
- `BULK_SCORE_LIMIT = 0.3` intentionally allows small title typos to match; do not tighten casually.
- Empty paste currently does nothing; preserve or intentionally improve that behavior with UI feedback.
- Paste auto-runs once on paste via `setTimeout(runPasteCheck, 0)`; later edits require clicking Check List.
- Fuse.js is loaded from cdnjs without an SRI hash; add `integrity` plus `crossorigin` if hardening the CDN dependency.
