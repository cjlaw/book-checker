# AGENTS.md

## Project Overview

- Static single-page app for Melissa ISD staff to check whether books are in the Melissa ISD library catalog.
- There is no backend, package manager, bundler, or framework; the app is plain `index.html`, `styles.css`, `script.js`, and `lib.js`.

## Commands

- Install: none.
- Dev: `python3 -m http.server 8888`, then open `http://localhost:8888`.
- Stop dev server: `kill $(lsof -ti tcp:8888)`.
- Regenerate catalog: `python3 generate-catalog.py` (browse crawl ~30 min + detail enrichment ~1.9h on first run; incremental runs short-circuit only when there are no additions, no removals, and every entry is already cached). Use `--skip-crawl` to skip the browse crawl if `crawl-entries.json` is current. Overwrites `crawl-entries.json`, `enrichment-cache.json`, and `catalog.json`.
- Test: `node --test test.js` (JS, requires Node 18+) and `python3 -m unittest test_generate_catalog` (crawl-diff and `normalize_il` logic). Then verify in a browser manually.
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
  - Two-phase: (1) browse crawl — scrapes ~13,807 titles from the Destiny title browse endpoint; (2) enrichment — fetches a detail page per title to capture author and interest level (il), caching results in `enrichment-cache.json`. The detail page also yields `bibId` and one ISBN-13 (first `isbn=` match), which are cached too. A heading with `[n]` > 1 records gets one extra request per record (see Destiny Catalog Notes).
  - Saves crawl results to `crawl-entries.json` after phase 1; `--skip-crawl` reads from that file to skip phase 1.
  - Uses a `CookieJar` seeded with `contextCookie=melissa` and `siteIDCookie=403`; establishes a `JSESSIONID` session before detail fetches. Do NOT use a manual `Cookie` header — it drops `JSESSIONID`.
  - Detail fetches are sequential at ~2 req/sec; cache flushes every 100 entries; resumable across runs.
- `crawl-entries.json`
  - Output of phase 1 (browse crawl); contains `{title, search_key, count}` dicts sorted by `search_key` (`count` is the browse page's `[n]` record count, 1 when absent) (so weekly diffs show only real changes; the browse page's two-column layout otherwise reshuffles crawl order). The detail URL is rebuilt by `detail_href()`. Committed. Pass `--skip-crawl` to load from this file and skip the ~30 min browse crawl. Regenerating it requires a full browse crawl without `--skip-crawl`.
- `enrichment-cache.json`
  - Persistent cache keyed by `search_key` (normalized title from Destiny's browse href). Single-record headings map to `{bibId, isbn, author, il}`; multi-record headings map to `{count, records: [{bibId, isbn, author, il}, ...]}`. Committed. Avoids re-fetching ~13,807 detail pages on subsequent runs.
- `catalog.json`
  - Pre-generated entry list (~15,700 records across ~14,800 titles). Fetched at runtime by `loadBooks()`. Each entry is `{title, author, il, isbn}` with nullable fields, one per Destiny record — a multi-record heading like "Sharks" yields several entries sharing a title (~85% have an `isbn`; one per record, so other editions of the same book won't match it).
- `index.html`
  - Loads Montserrat CSS through `styles.css`, Fuse.js from cdnjs, then `lib.js`, then `script.js`.
  - Defines the Melissa ISD header, One Book tab (with Scan barcode button and hidden `capture` file input), A Whole List tab, paste input, CSV upload, and status/result containers.
- `styles.css`
  - Contains all theme variables, layout, cards, tabs, result states, bulk table, print styles, and mobile rules.
  - Includes `@media print` for printable bulk results and `@media (max-width: 480px)` for small screens.
- `lib.js`
  - Pure functions with no DOM or Fuse dependency. Loaded as a plain `<script>` in the browser (globals) and `require()`-able in Node for testing.
  - `esc()` — HTML-escapes user-controlled strings before insertion.
  - `parseCSV()` — RFC-ish CSV parser for bulk upload.
  - `parsePaste()` — splits paste input into `{ title, author }` objects; handles tab-separated and `Title > Author` formats.
  - `normalizeIsbn(raw)` — returns a checksum-valid ISBN-13 (ISBN-10 converted, hyphens/spaces stripped) or `null`. Also used to reject non-ISBN barcodes (UPC, library stickers).
  - `findByIsbn(catalog, isbn)` — exact ISBN match, or `null`. Destiny lists alternate titles as separate entries sharing an ISBN, so it returns one entry (longest title).
  - `filterCatalog(catalog, query)` — filters the catalog array with word-boundary regex, matching each word against `e.title` OR `e.author`; returns `null` when query is all stop words (signals caller to fall back to Fuse).
- `script.js`
  - Top-level constants configure Fuse thresholds:

    | Constant | Purpose |
    |---|---|
    | `FUSE_THRESHOLD` | Fuzzy match tolerance for single search (0.35) |
    | `BULK_SCORE_LIMIT` | Stricter tolerance for bulk lookup (0.3) |

  - `loadBooks()` fetches `catalog.json`, populates `catalog[]`, and builds two Fuse indexes.
  - `buildFuse()` creates `fuseSingle` (title+author keys, for single search) and `fuseBulk` (title-only, for bulk lookup to prevent author-name false positives).
  - `doSearch()` ignores queries under 3 characters; `renderFound()` renders at most `MAX_RESULTS` (50) cards and notes the true total. `doSearch()` calls `filterCatalog()` from `lib.js`; falls back to `fuseSingle` for stop-word-only queries. A query that `normalizeIsbn()` accepts goes to `isbnSearch()` instead; a 10/13-digit query with a bad checksum shows an invalid-ISBN message.
  - `isbnSearch()` — exact `findByIsbn()` hit → Found. Otherwise fetches the title via `lookupIsbnTitle()` — Google Books (`GOOGLE_BOOKS_KEY`) first, then Open Library (`openlibrary.org/isbn/{isbn}.json`) if Google errors or has no result; cached per session in `isbnTitles`, then title-matches it (`filterCatalog`, then `fuseBulk` under `BULK_SCORE_LIMIT`) and shows the hits as "possible matches". `searchSeq` discards stale async results when the query changes.
  - Barcode scan — Scan button opens the camera via `<input type="file" capture="environment">` and decodes the still photo with `BarcodeDetector`. Where the browser lacks it (iOS Safari, insecure origins) or its native detector can't read EAN-13 (Android without Play services), `makeDetector()` lazy-loads the `barcode-detector` IIFE ponyfill from jsDelivr (SRI-pinned; exposes `BarcodeDetectionAPI.BarcodeDetector` without touching the global, so it works even when a broken native one exists), which fetches a ~950KB zxing WASM from jsDelivr on first use. A decoded ISBN is put in the search box and run through `doSearch()`.
  - `bookHTML()` renders a match item with title and optional author line.
  - `lookupBook()` and `renderBulkResults()` power paste/CSV bulk checking via `fuseBulk`; author shown below title in results table.
- `test.js`
  - Node.js unit tests using `node:test` + `assert`. Covers `filterCatalog`, `normalizeIsbn`, `findByIsbn`, `parseCSV`, `parsePaste`, and `esc`. Run with `node --test test.js`.
- `test_generate_catalog.py`
  - Python `unittest` tests for the pure logic in `generate-catalog.py`: `classify_crawl()` (additions, removals, mixed, no-op, first run, partial-crawl guard), `normalize_il()`, and `build_books()` (catalog entry shape). Run with `python3 -m unittest test_generate_catalog`. Loads the hyphenated module by path.
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
- TC8: Query under three characters: "d" or "do" → no search fires (empty state shows only when the box is empty).
- TC24: Broad query: "dog" → status shows the true match count; only the first 50 cards render, with a "Showing the first 50 of N" note.
- TC9: Stop-word-only query: "the" → falls back to Fuse fuzzy, no crash.

**ISBN / barcode scan**
- TC19: Typed ISBN in catalog: "9781250236104" (also "125023610X") → Found by exact ISBN, one entry ("The 143-story treehouse : camping trip chaos!"), not one per alternate title.
- TC20: Typed ISBN of a different edition / not in the catalog's ISBNs → "possible matches" by title, with the check-title-and-author note; unknown to both Google Books and Open Library (e.g. 9798225101497, a book fair printing) → "Couldn't identify this book"; after a scan the search box text is selected so typing a title replaces it.
- TC21: Bad checksum: "9781250236105" → invalid-ISBN message, no lookup.
- TC22: Scan on iPhone (Safari, `http://<mac-lan-ip>:8888`): photo of a back-cover barcode → ISBN fills the search box and result shows. Photo of a library sticker or UPC → "Wrong barcode". Photo with no barcode → "No barcode found".
- TC23: Paste multi-line text into the search box (e.g. "Dog\nMan" copied via Live Text) → becomes "Dog Man" and searches.

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
- Author and interest level are fetched from `presentbrowseheadingdetailform.do` during the enrichment phase (~13,807 requests, ~1.9h at 2 req/sec). Results are cached in `enrichment-cache.json` keyed by `search_key`. That endpoint requires a `JSESSIONID` cookie obtained via `CookieJar` — do NOT use a manual `Cookie` header.
- Author comes from the record's `searchType=author` link (`searchDisplayable`). Records with no author heading render the statement of responsibility as plain text (`<li>Titles by: Rediger, Pat, 1966.</li>`); `parse_detail()` falls back to that. `build_books()` strips MARC trailing punctuation via `normalize_author()` (keeps the period on initials and Dr./Jr./Inc.-style abbreviations; cache keeps raw values). Null-author cache entries are not refetched automatically.
- The browse endpoint never drops its "next" link; a complete crawl ends when a page repeats only already-seen titles (Destiny's pagination wraps). `crawl()` treats that as the normal graceful stop. `crawl_page_error()` flags the genuine mid-stream failures — a login/home/site-picker redirect (session lost) or an empty page. `fetch_crawl_page()` retries those (re-establishing the session; paging state lives in the next URL's `pagingKey`, not the session), then `crawl_failed()` exits 1 rather than committing a truncated catalog. An *early* pagination loop (a real truncation) is caught instead by the removal-count threshold below, since it drops a large fraction of titles.
- After phase 1, `classify_crawl()` diffs the fresh `search_key`s against the committed `crawl-entries.json` for both additions and removals; it exits 0 without touching enrichment or `catalog.json` only when both sets are empty and every key is cached (so an enrichment that stopped early resumes next run). Any addition **or** removal triggers a rebuild, so weeded books are dropped from `catalog.json` (the previous additions-only check left them stranded as "Found").
- An expired `JSESSIONID` on a detail page returns **200 at the same URL with no records**, not a redirect. `fetch_detail()` treats a page with no `bibID=` link as a session failure (never cached); `enrich()` re-establishes and stops after `AUTH_MAX_FAILURES` consecutive failures.
- A heading with more than one record (`[n]` > 1 in browse) renders a hit list, not a detail page: per-record author/call #/Lexile but no ISBN or interest level. `fetch_entry()` collects each record's `id="bibID_<n>"` DetailLink (`parse_record_ids()`) and fetches `presenttitledetailform.do?bibID=<n>` (`record_href()`; the hit list's `walkerID` param is not needed). A heading is cached only when every record fetched, and is refetched when its browse `count` no longer matches the cached `count` (`needs_fetch()`).
- `crawl-entries.json` is written only after the diff passes its safety guard, so a rejected crawl cannot poison the baseline.
- Secondary removal-count guard: even after a crawl reports success, if removals exceed `max(REMOVAL_ABORT_MIN=200, REMOVAL_ABORT_FRAC=10%)` of the prior crawl, the run aborts with code 1 (→ workflow email) rather than pruning — a catch-all for any truncation `crawl_page_error()` missed. Real weeding is far below this; a large drop is treated as suspect and needs manual review.

## Project-Specific Pitfalls

- `parseCSV()` lives in `lib.js` and is used for CSV upload (bulk check); do not remove it.
- Single search uses word-boundary regex (`\bword\b`), not Fuse — `FUSE_THRESHOLD` only applies to the bulk path and the stop-word fallback in `doSearch()`.
- `BULK_SCORE_LIMIT = 0.3` is intentionally stricter than `FUSE_THRESHOLD = 0.35`; do not tighten casually.
- `BULK_SCORE_LIMIT = 0.3` allows small title typos to match but risks false positives on very short queries (e.g. "ca" → "Caddo"). No minimum length guard is implemented yet.
- `parsePaste()` (in `lib.js`) extracts author from tab/`>` delimited input, but `lookupBook()` only uses `book.title` for the Fuse lookup — the pasted author is not used for matching.
- Empty paste currently does nothing; preserve or intentionally improve that behavior with UI feedback.
- The One Book search box intercepts pastes containing line breaks and inserts them with breaks turned into spaces; browsers otherwise strip the break with no space, so "Dog\nMan" would become "DogMan".
- Paste auto-runs once on paste via `setTimeout(runPasteCheck, 0)`; later edits require clicking Check List.
- Fuse.js is loaded from cdnjs pinned with an SRI `integrity` hash plus `crossorigin`; if bumping the Fuse version, update the hash to match or the browser will refuse to load it. Same for `BARCODE_PONYFILL` in `script.js`. Use the `ponyfill.js` build, not `polyfill.js` — the polyfill only installs when no native `BarcodeDetector` exists, so it can't replace a broken one. The ponyfill's WASM URL is pinned inside it and is not SRI-checked.
- Only one ISBN per catalog record is captured, so a scanned paperback can miss a hardcover record. That's why non-exact ISBN results go through the title lookup and are labelled "possible matches" — do not present them as a definite Yes.
- Google Books and Open Library are third-party dependencies for the fallback only; if both fail, exact ISBN hits still work and misses show "Couldn't identify this book".
- `GOOGLE_BOOKS_KEY` is inline in `script.js` on purpose (no build step, so it can't come from `.env`). It is safe only because the key is restricted in Google Cloud to this site's referrers and to the Books API — keep those restrictions. If the GitHub Pages domain or local test origin isn't in the referrer list, Google returns 403 and every lookup silently falls back to Open Library.
- Live camera (`getUserMedia`) needs HTTPS; the photo-capture approach does not, which is why phone testing over plain LAN HTTP works.

## Code review

For code review tasks:

- Follow `../standards/code_review.md` (and `./code_review.md` if present)
- Read `.ai/reviews/current.md` before starting; overwrite it with the final findings
- Do not modify source files unless explicitly asked
- Report only actionable issues, grouped by severity — no cosmetic/style-only nits
