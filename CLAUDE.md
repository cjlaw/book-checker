# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static single-page app for Melissa ISD staff to check whether a book is on the district's approved reading list. No build step, no backend, no npm. Open `index.html` in a browser or serve it locally.

## Local development

Opening via `file://` triggers a CORS error on the Google Sheet fetch. Serve locally instead:

```bash
python3 -m http.server 8888
# then open http://localhost:8888
kill $(lsof -ti tcp:8888)
```

## Deploy

GitHub Pages: push to `main`, enable Pages in repo settings (source: `main`). Every push auto-deploys.

**Before deploying:** set `DEV_MODE = false` and set `SHEET_CSV_URL` to the published Google Sheet CSV URL at the top of `script.js`. `DEV_MODE = false` hides the Refresh List and Clear Cache buttons from end users.

## Architecture

Three files — no framework, no bundler:

- **`index.html`** — structure and tab layout (One Book / A Whole List)
- **`styles.css`** — all styles, including `@media print` and `@media (max-width: 480px)`
- **`script.js`** — all logic; runs top-to-bottom on load, no modules

### Data flow

1. On load, `loadBooks()` fetches `SHEET_CSV_URL` (a Google Sheets CSV export) and builds a [Fuse.js](https://fusejs.io/) index. Results are cached in `localStorage` for 24 hours (`CACHE_HOURS`).
2. The sheet must have **Title**, **Author**, and **Intended Grade Level** columns. It must be published via File → Share → Publish to web (CSV of a specific tab) — not just shared.
3. If the sheet URL isn't configured, the app falls back to `SAMPLE_BOOKS` (demo mode), showing a config notice banner. `SAMPLE_BOOKS` is intentionally kept in `script.js` for local development convenience — it is not used in production.
4. If fetch fails but a cache exists, the app uses the cache and shows a warning with the cached date.

### Search logic

- Single-book tab: Fuse.js fuzzy search across title + author, threshold `0.35`. All results render in a single flat list under an "Approved books matching your search" header (every book on the list is approved by definition — no per-result badge).
- Bulk tab (A Whole List): paste tab-separated (from Excel/Sheets) or use `>` as delimiter (`Title > Author`). CSV upload also available via a toggle. Bulk uses a stricter score limit (`BULK_SCORE_LIMIT = 0.3`). When an author is present, `lookupBook()` uses a Fuse `$and` query (title + author); falls back to title-only if the combined query misses or scores above the limit. Each row shows explicit status: "✔ Approved" or "? Not Found".

### Key constants (top of `script.js`)

| Constant | Purpose |
|---|---|
| `DEV_MODE` | Shows/hides Refresh + Clear Cache buttons |
| `SHEET_CSV_URL` | Published Google Sheet CSV URL |
| `CACHE_HOURS` | How long before re-fetching (default: 24) |
| `FUSE_THRESHOLD` | Fuzzy match tolerance for single search (0.35) |
| `BULK_SCORE_LIMIT` | Stricter tolerance for bulk lookup (0.3) |

### Audience

Teachers and non-technical volunteers at Melissa ISD. Keep UI copy plain and avoid jargon. The core question the app answers is "can I use this book?" — Not Found means no.

### Future considerations

- **SRI hash on Fuse.js** — `index.html` loads Fuse from cdnjs with no `integrity` attribute. Worth adding `integrity="sha384-..."` + `crossorigin="anonymous"` for supply-chain safety.
- **Empty paste feedback** — clicking "Check List" with an empty textarea silently does nothing. A brief inline message would reduce confusion.
- **Bulk auto-run on paste** — paste triggers an immediate check via `setTimeout(0)`, but edits after pasting require a manual re-click. Consider either removing the auto-run or making it reactive to all input changes.
