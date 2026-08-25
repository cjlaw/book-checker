#!/usr/bin/env python3
"""
Fetch the Melissa ISD library catalog from Destiny and write catalog.json.
Run manually to refresh the book list:  python3 generate-catalog.py

The browse endpoint returns the full ESC11 consortium catalog regardless of
siteTypeID/siteID — per-school scoping is not supported by this endpoint.
"""

import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from html.parser import HTMLParser
from http.cookiejar import Cookie, CookieJar
from urllib.parse import parse_qs, unquote, urlparse
import urllib.request

BASE = "https://destiny3.esc11.net"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
OUTPUT = "catalog.json"
CACHE_FILE = "enrichment-cache.json"
CRAWL_FILE = "crawl-entries.json"
CACHE_FLUSH_INTERVAL = 100
DETAIL_RATE_SEC = 0.5      # ~2 req/sec
MAX_ELAPSED_SEC = 4 * 3600
DETAIL_MAX_RETRIES = 3
REMOVAL_ABORT_MIN = 200    # suspect a partial crawl if more than this many entries vanish
REMOVAL_ABORT_FRAC = 0.10  # ...and they exceed this fraction of the prior crawl

START_URL = (
    BASE + "/cataloging/servlet/presentbrowsesearchresultsform.do"
    "?searchText=a&searchType=title&siteTypeID=1&siteID=403"
    "&includeLibrary=true&includeMedia=false&mediaSiteID=&fromBasicSearch=false"
)

WELCOME_URL = BASE + "/common/servlet/presenthomeform.do?l=1&tm=1"


class TitleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._in_detail_link = False
        self._current = []
        self._current_href = None
        self.entries = []

    def handle_starttag(self, tag, attrs):
        attr_map = dict(attrs)
        classes = attr_map.get("class", "").split()
        if tag == "a" and "DetailLink" in classes:
            self._in_detail_link = True
            self._current = []
            self._current_href = attr_map.get("href")

    def handle_data(self, data):
        if self._in_detail_link:
            self._current.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._in_detail_link:
            title = re.sub(r'\s*\[\d+\]$', '', "".join(self._current).strip())
            href = self._current_href or ""
            search_key = None
            try:
                params = parse_qs(urlparse(href).query)
                raw = params.get("searchKey", [None])[0]
                if raw:
                    search_key = unquote(raw)
            except Exception:
                pass
            if title and search_key:
                self.entries.append({"title": title, "search_key": search_key, "href": href})
            self._in_detail_link = False
            self._current = []
            self._current_href = None


def make_opener():
    jar = CookieJar()
    for name, value in [("contextCookie", "melissa"), ("siteIDCookie", "403")]:
        jar.set_cookie(Cookie(
            version=0, name=name, value=value,
            port=None, port_specified=False,
            domain="destiny3.esc11.net", domain_specified=True, domain_initial_dot=False,
            path="/", path_specified=True,
            secure=False, expires=None, discard=True,
            comment=None, comment_url=None, rest={},
        ))
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def establish_session(opener):
    for url in [WELCOME_URL, START_URL]:
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        with opener.open(req, timeout=60) as resp:
            resp.read()


def fetch(opener, url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with opener.open(req, timeout=60) as resp:
        return resp.read().decode("utf-8"), resp.geturl()


def is_login_redirect(final_url):
    path = urlparse(final_url).path.lower()
    return "loginform" in path or "welcomeform" in path or "homeform" in path


def extract_entries(html):
    parser = TitleParser()
    parser.feed(html)
    return parser.entries


def extract_next_url(html):
    m = re.search(r'href="([^"]*)" id="next"', html)
    if not m:
        return None
    return BASE + m.group(1)


def load_cache():
    if not os.path.exists(CACHE_FILE):
        return {}
    try:
        with open(CACHE_FILE) as f:
            data = json.load(f)
        if not isinstance(data, dict):
            raise ValueError("cache root is not a dict")
        return data
    except Exception as e:
        print(f"ERROR: {CACHE_FILE} is malformed: {e}", file=sys.stderr)
        sys.exit(1)


def atomic_write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    os.replace(tmp, path)


def save_cache(cache):
    atomic_write(CACHE_FILE, cache)


def fetch_detail(opener, href, retries=DETAIL_MAX_RETRIES):
    url = BASE + href
    for attempt in range(retries):
        try:
            html, final_url = fetch(opener, url)
            if is_login_redirect(final_url):
                return None, "auth"
            return html, None
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(2 ** attempt)
            else:
                return None, str(e)
    return None, "retries exhausted"


# Destiny renders "Interest grade level: Grades 2-6 Junior Library Guild." — a
# grade range with an optional label prefix and a trailing rating-source
# attribution, all in one text node. Reduce it to the bare grade token.
def normalize_il(raw):
    val = raw.split("<")[0].strip().rstrip(".").strip()
    val = re.sub(r'^(?:Grades?|Ages?)\s+', "", val, flags=re.I)
    val = re.sub(r'\s+(?:Junior Library Guild|Follett\b.*)$', "", val, flags=re.I)
    val = re.sub(r'-\s+', "-", val)
    return val or None


def parse_detail(html):
    bib_id = None
    isbn = None
    author = None
    rl = None
    il = None

    m = re.search(r'bibID=(\d+)', html)
    if m:
        bib_id = int(m.group(1))

    m = re.search(r'isbn=(\d{13})', html)
    if m:
        isbn = m.group(1)

    m = re.search(r'searchType=author[^>]*searchDisplayable=([^&"]+)', html)
    if m:
        author = unquote(m.group(1).replace("+", " "))

    m = re.search(r'Reading grade level:\s*([\d]+(?:\.[\d]+)?)', html)
    if m:
        rl = float(m.group(1))

    m = re.search(r'Interest grade level:\s*([^<]+)', html)
    if m:
        il = normalize_il(m.group(1))

    return {"bibId": bib_id, "isbn": isbn, "author": author, "rl": rl, "il": il}


def enrich(opener, all_entries, cache):
    uncached = [e for e in all_entries if e["search_key"] not in cache]
    total = len(uncached)
    if not total:
        print("All entries already cached — skipping detail fetches.")
        return cache

    print(f"Fetching details for {total} uncached entries (~{total * DETAIL_RATE_SEC / 3600:.1f}h)...")
    flush_count = 0
    auth_retried = False
    start = time.monotonic()

    for i, entry in enumerate(uncached):
        if time.monotonic() - start > MAX_ELAPSED_SEC:
            print(f"  Elapsed-time guard tripped — saving and stopping.", file=sys.stderr)
            break

        html, err = fetch_detail(opener, entry["href"])
        if err == "auth" and not auth_retried:
            auth_retried = True
            print("  Session expired — re-establishing...", file=sys.stderr)
            establish_session(opener)
            html, err = fetch_detail(opener, entry["href"])

        if err:
            print(f"  Fetch error for {entry['title']!r}: {err}", file=sys.stderr)
            time.sleep(DETAIL_RATE_SEC)
            continue

        cache[entry["search_key"]] = parse_detail(html)
        flush_count += 1

        if flush_count % CACHE_FLUSH_INTERVAL == 0:
            save_cache(cache)
            print(f"  {i + 1}/{total} fetched, cache flushed")

        time.sleep(DETAIL_RATE_SEC)

    save_cache(cache)
    print(f"  Detail fetch complete: {flush_count} new entries cached")
    return cache


def crawl_page_error(final_url, page_entries):
    """Return a failure reason for a fetched crawl page, or None if usable.

    A login/home redirect (session lost) or a page with no titles means the crawl
    broke mid-stream rather than reaching its end — treat as a failure so a late
    break (which loses too few titles for the removal threshold to catch) can't
    silently shrink the catalog. A page that merely repeats already-seen titles is
    NOT flagged here: on this catalog that is the *normal* terminator (Destiny
    keeps offering a "next" link that eventually wraps), handled by the caller as a
    graceful stop. An early loop that truncates the crawl is caught instead by
    classify_crawl()'s removal threshold.
    """
    if is_login_redirect(final_url):
        return "redirected to a login/home page (session lost)"
    if not page_entries:
        return "returned no titles"
    return None


def crawl(opener):
    all_entries = []
    seen_keys = set()
    url = START_URL
    page = 0
    had_errors = False

    print("Fetching Melissa ISD catalog from Destiny...")

    while url:
        try:
            html, final_url = fetch(opener, url)
        except Exception as e:
            print(f"  Error on page {page + 1}: {e}", file=sys.stderr)
            had_errors = True
            break

        page_entries = extract_entries(html)
        err = crawl_page_error(final_url, page_entries)
        if err:
            print(f"  Page {page + 1} {err} — treating as a failed crawl.", file=sys.stderr)
            had_errors = True
            break

        new_entries = [e for e in page_entries if e["search_key"] not in seen_keys]
        if not new_entries:
            # Every title on this page was already seen: Destiny's pagination has
            # wrapped, which is how a complete crawl ends here. Stop cleanly.
            print(f"  Reached end of catalog at page {page + 1} ({len(all_entries)} unique titles).")
            break

        for e in new_entries:
            seen_keys.add(e["search_key"])
            all_entries.append(e)

        page += 1
        if page % 100 == 0:
            last = new_entries[-1]["title"] if new_entries else "?"
            print(f"  {page} pages, {len(all_entries)} unique titles so far ({last})")

        url = extract_next_url(html)

    if had_errors:
        return all_entries, had_errors

    if not all_entries:
        print("No titles collected — aborting.", file=sys.stderr)
        sys.exit(1)

    print(f"  Crawl complete: {len(all_entries)} unique titles.")
    return all_entries, had_errors


def classify_crawl(existing_keys, current_keys,
                   removal_min=REMOVAL_ABORT_MIN, removal_frac=REMOVAL_ABORT_FRAC):
    """Compare a fresh crawl against the prior baseline.

    Returns (added, removed, suspect). `suspect` is True when so many entries
    vanished that a silently truncated crawl is likelier than real weeding — the
    caller should abort rather than prune the catalog to a partial set. A first
    run (empty baseline) is never suspect.
    """
    added = current_keys - existing_keys
    removed = existing_keys - current_keys
    suspect = bool(existing_keys) and len(removed) > max(removal_min, removal_frac * len(existing_keys))
    return added, removed, suspect


def main(skip_crawl=False):
    cache = load_cache()
    opener = make_opener()

    print("Establishing session...")
    establish_session(opener)

    if skip_crawl:
        if not os.path.exists(CRAWL_FILE):
            print(f"ERROR: --skip-crawl requires {CRAWL_FILE} from a prior run.", file=sys.stderr)
            sys.exit(1)
        with open(CRAWL_FILE) as f:
            all_entries = json.load(f)
        print(f"Skipping crawl — loaded {len(all_entries)} entries from {CRAWL_FILE}")
    else:
        existing_keys = set()
        if os.path.exists(CRAWL_FILE):
            with open(CRAWL_FILE) as f:
                existing_keys = {e["search_key"] for e in json.load(f)}

        all_entries, had_errors = crawl(opener)

        if had_errors:
            print("ERROR: Crawl did not complete — aborting to avoid false no-op.", file=sys.stderr)
            sys.exit(1)

        current_keys = {e["search_key"] for e in all_entries}
        added, removed, suspect = classify_crawl(existing_keys, current_keys)

        if suspect:
            print(f"ERROR: {len(removed)} entries missing vs prior crawl "
                  f"({len(current_keys)} now vs {len(existing_keys)} before) — "
                  f"suspected partial crawl, aborting without touching the catalog.", file=sys.stderr)
            sys.exit(1)

        atomic_write(CRAWL_FILE, all_entries)

        if existing_keys and not added and not removed:
            print("No changes — catalog is up to date.")
            sys.exit(0)

        print(f"  {len(added)} added, {len(removed)} removed.")

    if not all_entries:
        print("No titles collected — catalog.json not modified.", file=sys.stderr)
        sys.exit(1)

    cache = enrich(opener, all_entries, cache)

    # Drop cache entries for titles no longer in the catalog. Safe here: all_entries
    # is the full trusted set (the partial-crawl guard already ran), so orphans are
    # genuine removals, not fetch gaps.
    live_keys = {e["search_key"] for e in all_entries}
    orphans = [k for k in cache if k not in live_keys]
    if orphans:
        for k in orphans:
            del cache[k]
        save_cache(cache)
        print(f"  Pruned {len(orphans)} orphaned cache entries no longer in the catalog.")

    null_count = sum(1 for e in all_entries if not cache.get(e["search_key"], {}).get("author"))
    if null_count:
        print(f"  {null_count}/{len(all_entries)} entries have null metadata (not yet cached or fetch failed)")

    unique = sorted(all_entries, key=lambda e: e["title"].lower())
    books = [
        {
            "title": e["title"],
            "author": cache.get(e["search_key"], {}).get("author"),
            "rl": cache.get(e["search_key"], {}).get("rl"),
            "il": cache.get(e["search_key"], {}).get("il"),
        }
        for e in unique
    ]

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    atomic_write(OUTPUT, {"generated": generated, "books": books})

    print(f"Done: {len(unique)} unique titles → {OUTPUT}")


if __name__ == "__main__":
    main(skip_crawl="--skip-crawl" in sys.argv)
