## Session Handoff — 2026-06-04

### Goal
Add automated weekly catalog refresh via GitHub Actions so `catalog.json` stays current without manual intervention.

### What was done
- **Added short-circuit to `generate-catalog.py`** — after phase 1 (crawl), diffs new `search_key`s against the existing `crawl-entries.json`; exits 0 with "No new entries found" if nothing changed, skipping enrichment and `catalog.json` rewrite entirely.
- **Added crawl error guard** — `crawl()` now returns `had_errors`; if any page fetch fails, `main()` exits 1 to prevent a partial crawl from being treated as a no-op. This was needed after the first GHA run timed out at page 47, committed 920 entries as the full crawl-entries.json, and silently succeeded.
- **Created `.github/workflows/refresh-catalog.yml`** — runs weekly (Mondays 8am UTC) + `workflow_dispatch`. Uses `CATALOG_DEPLOY_TOKEN` PAT secret so pushes trigger GitHub Pages. Commits updated JSON files back to `main` only on success.
- **Updated AGENTS.md** — added workflow file to Codebase Structure, updated Commands and Destiny Catalog Notes for new behaviors.

### Current state
- Working tree clean, `main` up to date with `origin/main`.
- 31/31 tests passing.
- Two GHA runs completed: first exposed the partial-crawl bug (since fixed); second ran cleanly — full crawl, cache hit for all 13,807 entries, committed updated files, Pages deploy triggered.
- `CATALOG_DEPLOY_TOKEN` secret is set on the repo.

### Environment changes
- New repo secret: `CATALOG_DEPLOY_TOKEN` — PAT with `repo` scope, used by the GHA workflow to push back to `main`.

### Next steps
- Monitor the first scheduled run (Monday 2026-06-08 at 8am UTC) to confirm the short-circuit fires cleanly (no new entries expected week-over-week).

### Backlog
- TC15 (CSV upload), TC17 (mobile), TC18 (print) — not yet manually verified.

### Gotchas
- **PAT pushes trigger Pages; `GITHUB_TOKEN` pushes do not** — GitHub Pages is configured as "Deploy from branch," which only fires on pushes that look like real user pushes. `GITHUB_TOKEN` is silently ignored by the Pages watcher.
- **First buggy GHA run corrupted `crawl-entries.json`** — a timeout on page 47 produced a 920-entry partial file that was committed before the error guard was added. The second run self-healed by treating all 12,887 missing entries as "new" (all cache hits, so enrichment was instant). File is now correct at 13,807 entries.

---

## Session Handoff — 2026-06-03 (cleanup)

### Goal
Clean up the gitignore inconsistency with `crawl-entries.json` and document all three catalog JSON files clearly before pushing to deploy.

### What was done
- **Removed `crawl-entries.json` from `.gitignore`** — it was treated as a throwaway intermediate artifact, but it's the same class of data as `enrichment-cache.json` (both are slow scraper outputs, both worth preserving). Committed it alongside the other two files for consistency.
- **Updated README.md** — Stack section now lists all three JSON files; Regenerating section replaced with a table showing each file's contents and rebuild cost, plus the `--skip-crawl` usage.
- **Updated AGENTS.md** — Fixed `crawl-entries.json` entry from "Not committed" to "Committed"; updated regenerate command to list all three output files.

### Current state
- Working tree clean, `main` is 4 commits ahead of `origin/main` — not yet pushed.
- 31/31 tests passing.
- All three catalog files (`crawl-entries.json`, `enrichment-cache.json`, `catalog.json`) committed and consistently documented.

### Next steps
- Push `main` to `origin/main` to deploy to GitHub Pages.

### Backlog
- TC15 (CSV upload), TC17 (mobile), TC18 (print) — not yet manually verified.
- Lambda to auto-regenerate `catalog.json` on a schedule.

### Gotchas
- **1,728 null-author entries are permanent** — re-running the scraper will not improve coverage. This is Destiny's data ceiling, not a bug.

---

## Session Handoff — 2026-06-03

### Goal
Complete and ship the author enrichment feature: confirm the scraper finished, verify catalog.json format, commit all changed files, and smoke-test the app.

### What was done
- **Scraper confirmed complete** — `enrichment-cache.json` had 13,805/13,807 entries from the prior session's run; re-ran with `--skip-crawl` to pick up the 2 remaining uncached entries. All 13,807 now cached.
- **1,728 null-author entries** — investigated and confirmed these are not retryable: all 1,728 are in the cache with `author: None` because Destiny simply has no author field for those records. ~12.5% null coverage is the real ceiling.
- **`catalog.json` already enriched** — the scraper had written the object-format entries during the prior run; no regeneration needed.
- **Committed**: `generate-catalog.py`, `lib.js`, `script.js`, `test.js`, `AGENTS.md`, `enrichment-cache.json`, `catalog.json`, `.gitignore` (added `crawl-entries.json` and `__pycache__/`).
- **Smoke-tested**: author shows in single search and bulk table; Dog Man search shows no regression.

### Current state
- Working tree clean, `main` is 2 commits ahead of `origin/main` (not yet pushed).
- 31/31 tests passing.
- Author enrichment feature fully shipped locally; awaiting push.

### Next steps
- Push `main` to deploy to GitHub Pages.

### Backlog
- TC15 (CSV upload), TC17 (mobile), TC18 (print) — not yet manually verified.
- Lambda to auto-regenerate `catalog.json` on a schedule.

### Gotchas
- **1,728 null-author entries are permanent** — re-running the scraper will not improve coverage. This is Destiny's data ceiling, not a bug.
- **`__pycache__/` is now gitignored** — was untracked noise before this session.


