# AGENTS.md

## Project Overview

- Static single-page app for Melissa ISD staff to check whether books are in the Melissa ISD library catalog.
- There is no backend, package manager, bundler, or framework; the app is plain `index.html`, `styles.css`, `script.js`, and `lib.js`.

## Commands

- Install: none.
- Dev: `python3 -m http.server 8888`, then open `http://localhost:8888`.
- Stop dev server: `kill $(lsof -ti tcp:8888)`.
- Regenerate catalog: `python3 generate-catalog.py` (browse crawl ~30 min + detail enrichment ~1.9h on first run; incremental runs short-circuit if no new entries are found). Use `--skip-crawl` to skip the browse crawl if `crawl-entries.json` is current. Overwrites `crawl-entries.json`, `enrichment-cache.json`, and `catalog.json`.
- Test: `node --test test.js` (requires Node 18+). Then verify in a browser manually.
- Lint/typecheck: none configured.
- Deploy: push `main`; GitHub Pages serves from `main` when enabled in repo settings. Catalog is also refreshed automatically every Monday at 8am UTC via `.github/workflows/refresh-catalog.yml`.

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
  - Two-phase: (1) browse crawl — scrapes ~13,807 titles from the Destiny title browse endpoint; (2) enrichment — fetches a detail page per title to capture author, reading level (rl), and interest level (il), caching results in `enrichment-cache.json`.
  - Saves crawl results to `crawl-entries.json` after phase 1; `--skip-crawl` reads from that file to skip phase 1.
  - Uses a `CookieJar` seeded with `contextCookie=melissa` and `siteIDCookie=403`; establishes a `JSESSIONID` session before detail fetches. Do NOT use a manual `Cookie` header — it drops `JSESSIONID`.
  - Detail fetches are sequential at ~2 req/sec; cache flushes every 100 entries; resumable across runs.
- `crawl-entries.json`
  - Output of phase 1 (browse crawl); contains `{title, search_key, href}` dicts for all ~13,807 catalog entries. Committed. Pass `--skip-crawl` to load from this file and skip the ~30 min browse crawl. Regenerating it requires a full browse crawl without `--skip-crawl`.
- `enrichment-cache.json`
  - Persistent cache keyed by `search_key` (normalized title from Destiny's browse href). Committed. Avoids re-fetching ~13,807 detail pages on subsequent runs.
- `catalog.json`
  - Pre-generated entry list (~13,807 entries). Fetched at runtime by `loadBooks()`. Each entry is `{title, author, rl, il}` with nullable fields; legacy string entries are normalized at load time.
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
  - `filterCatalog(catalog, query)` — filters the catalog array with word-boundary regex, matching each word against `e.title` OR `e.author`; returns `null` when query is all stop words (signals caller to fall back to Fuse).
- `script.js`
  - Top-level constants configure Fuse thresholds:

    | Constant | Purpose |
    |---|---|
    | `FUSE_THRESHOLD` | Fuzzy match tolerance for single search (0.35) |
    | `BULK_SCORE_LIMIT` | Stricter tolerance for bulk lookup (0.3) |

  - `loadBooks()` fetches `catalog.json`, normalizes string entries to objects, populates `catalog[]`, and builds two Fuse indexes.
  - `buildFuse()` creates `fuseSingle` (title+author keys, for single search) and `fuseBulk` (title-only, for bulk lookup to prevent author-name false positives).
  - `doSearch()` calls `filterCatalog()` from `lib.js`; falls back to `fuseSingle` for stop-word-only queries.
  - `bookHTML()` renders a match item with title and optional author line.
  - `lookupBook()` and `renderBulkResults()` power paste/CSV bulk checking via `fuseBulk`; author shown below title in results table.
- `test.js`
  - Node.js unit tests using `node:test` + `assert`. Covers `filterCatalog`, `parseCSV`, `parsePaste`, `esc`, and `splitCSVLine`. Run with `node --test test.js`.
- `.github/workflows/refresh-catalog.yml`
  - Runs `generate-catalog.py` weekly (Mondays 8am UTC) and on `workflow_dispatch`. Commits updated JSON files back to `main` if the catalog changed (triggering Pages deploy). Uses `CATALOG_DEPLOY_TOKEN` secret (PAT with `repo` scope) so the push triggers GitHub Pages. Fails the job (→ email notification) if the crawl errors out mid-run.

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
- Author, reading level, and interest level are fetched from `presentbrowseheadingdetailform.do` during the enrichment phase (~13,807 requests, ~1.9h at 2 req/sec). Results are cached in `enrichment-cache.json` keyed by `search_key`. That endpoint requires a `JSESSIONID` cookie obtained via `CookieJar` — do NOT use a manual `Cookie` header.
- The script exits with code 1 if zero titles were collected or if the crawl hit an error mid-run (prevents a partial crawl from short-circuiting as a false no-op).
- After phase 1, the script diffs new `search_key`s against the committed `crawl-entries.json`; exits 0 without touching enrichment or `catalog.json` if no new entries are found.

## Project-Specific Pitfalls

- `parseCSV()` lives in `lib.js` and is used for CSV upload (bulk check); do not remove it.
- Single search uses word-boundary regex (`\bword\b`), not Fuse — `FUSE_THRESHOLD` only applies to the bulk path and the stop-word fallback in `doSearch()`.
- `BULK_SCORE_LIMIT = 0.3` is intentionally stricter than `FUSE_THRESHOLD = 0.35`; do not tighten casually.
- `BULK_SCORE_LIMIT = 0.3` allows small title typos to match but risks false positives on very short queries (e.g. "ca" → "Caddo"). No minimum length guard is implemented yet.
- `parsePaste()` (in `lib.js`) extracts author from tab/`>` delimited input, but `lookupBook()` only uses `book.title` for the Fuse lookup — the pasted author is not used for matching.
- Empty paste currently does nothing; preserve or intentionally improve that behavior with UI feedback.
- Paste auto-runs once on paste via `setTimeout(runPasteCheck, 0)`; later edits require clicking Check List.
- Fuse.js is loaded from cdnjs pinned with an SRI `integrity` hash plus `crossorigin`; if bumping the Fuse version, update the hash to match or the browser will refuse to load it.

## Code review

For code review tasks:

- Follow `../standards/code_review.md` (and `./code_review.md` if present)
- Read `.ai/reviews/current.md` before starting; overwrite it with the final findings
- Do not modify source files unless explicitly asked
- Report only actionable issues, grouped by severity — no cosmetic/style-only nits
