# Book Checker

A lightweight single-page app to check whether a book is in the Melissa ISD library catalog. No backend, no login, no dependencies to install.

## Stack

- `index.html`, `styles.css`, `lib.js`, `script.js` — no framework, no bundler
- `catalog.json` — pre-generated title list (~13,801 entries), committed to the repo
- `generate-catalog.py` — scrapes the Follett Destiny catalog to regenerate `catalog.json`
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

`catalog.json` is committed and updated manually. Run the generator when the catalog drifts (new titles added to Destiny):

```bash
python3 generate-catalog.py
```

Takes ~10–15 minutes. Scrapes the full Follett Destiny ESC11 consortium catalog via the title browse endpoint and overwrites `catalog.json`. Requires no login.

## Deployment

GitHub Pages: push to `main`, enable Pages in repo settings (source: `main`). Every push auto-deploys.
