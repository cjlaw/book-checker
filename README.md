# Book Checker

A lightweight single-page app to check whether a book is in the Melissa ISD library catalog. No backend, no login, no dependencies to install.

## Stack

- `index.html`, `styles.css`, `lib.js`, `script.js` — no framework, no bundler
- `catalog.json` — final entry list (~13,807 entries) served to the app at runtime; committed to the repo
- `enrichment-cache.json` — per-entry cache of author/rl/il from Destiny detail pages; committed so the ~1.9h fetch doesn't need to be re-run
- `crawl-entries.json` — raw book list from Destiny's browse pages; committed so the ~30 min browse crawl can be skipped on re-runs
- `generate-catalog.py` — scrapes the Follett Destiny catalog to regenerate all three files
- `test.js` — unit tests for pure functions (no browser required)
- [Fuse.js](https://fusejs.io/) for fuzzy matching in bulk lookup (loaded from CDN)

## Local development

Opening `index.html` via `file://` causes a CORS error when fetching `catalog.json`. Use a local server:

```bash
python3 -m http.server 8888
# then open http://localhost:8888
kill $(lsof -ti tcp:8888)  # to stop
```

## Testing

```bash
node --test test.js
```

Requires Node 18+. Covers `filterCatalog`, `parseCSV`, `parsePaste`, `esc`, and `splitCSVLine`.

## Regenerating the catalog

Three files store catalog state — all committed so expensive scraper phases can be skipped on re-runs:

| File | What it contains | Time to rebuild |
|---|---|---|
| `crawl-entries.json` | Raw book list from Destiny browse pages (`{title, search_key, href}`) | ~30 min |
| `enrichment-cache.json` | Author/rl/il fetched from ~13,807 Destiny detail pages, keyed by `search_key` | ~1.9h at 2 req/sec |
| `catalog.json` | Final `{title, author, rl, il}` list served to the app | seconds (derived from cache) |

Run the generator when the catalog drifts (new titles added to Destiny):

```bash
python3 generate-catalog.py                # full run: browse crawl + enrichment + catalog (~2h)
python3 generate-catalog.py --skip-crawl  # skip browse crawl if crawl-entries.json is current (~1.9h)
```

Requires no login. Overwrites all three files when complete.

## Deployment

GitHub Pages: push to `main`, enable Pages in repo settings (source: `main`). Every push auto-deploys.
