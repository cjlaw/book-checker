# Book Checker

A lightweight single-page app for Melissa ISD staff to check whether a book is on the district's approved reading list. No backend, no login, no dependencies to install.

## Stack

- `index.html`, `styles.css`, `script.js` — no framework, no bundler
- [Fuse.js](https://fusejs.io/) for fuzzy search (loaded from CDN)
- Google Sheets (published as CSV) as the data source
- `localStorage` cache with 24-hour TTL

## Setup

### 1. Prepare the Google Sheet

The sheet needs three columns: **Title**, **Author**, **Approved** (`yes` or `no`).

To publish it as a CSV:
1. File → Share → Publish to web
2. Select the relevant sheet tab (not "Entire Document")
3. Choose **CSV** from the format dropdown
4. Click **Publish** and confirm
5. Copy the URL

### 2. Wire up the URL

In `script.js`, replace the placeholder on this line:

```js
const SHEET_CSV_URL = 'YOUR_GOOGLE_SHEET_CSV_URL_HERE';
```

### 3. Test locally

Opening via `file://` will cause a CORS error when fetching the sheet. Use a local server instead:

```bash
python3 -m http.server 8888
# then open http://localhost:8888
kill $(lsof -ti tcp:8888)
```

## Deployment

GitHub Pages: push to `main`, enable Pages in repo settings (source: `main`). Every push auto-deploys.

**Before deploying:** set `DEV_MODE = false` in `script.js` line 1.

## Notes

- The CORS error seen when testing via `file://` does **not** occur when the app is hosted on a real domain
- If the sheet fetch fails, the app falls back to the last cached version rather than breaking
- Demo mode (sample data) activates automatically when `SHEET_CSV_URL` is not configured
