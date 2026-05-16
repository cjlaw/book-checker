#!/usr/bin/env python3
"""
Fetch the Melissa ISD library catalog from Destiny and write catalog.json.
Run manually to refresh the book list:  python3 generate-catalog.py

The browse endpoint returns the full ESC11 consortium catalog regardless of
siteTypeID/siteID — per-school scoping is not supported by this endpoint.
"""

import json
import re
import sys
from datetime import datetime, timezone
from html.parser import HTMLParser
import urllib.request

BASE = "https://destiny3.esc11.net"
COOKIES = "contextCookie=melissa; siteIDCookie=403"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
OUTPUT = "catalog.json"

START_URL = (
    BASE + "/cataloging/servlet/presentbrowsesearchresultsform.do"
    "?searchText=a&searchType=title&siteTypeID=1&siteID=403"
    "&includeLibrary=true&includeMedia=false&mediaSiteID=&fromBasicSearch=false"
)


class TitleParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self._in_detail_link = False
        self._current = []
        self.titles = []

    def handle_starttag(self, tag, attrs):
        attr_map = dict(attrs)
        classes = attr_map.get("class", "").split()
        if tag == "a" and "DetailLink" in classes:
            self._in_detail_link = True
            self._current = []

    def handle_data(self, data):
        if self._in_detail_link:
            self._current.append(data)

    def handle_endtag(self, tag):
        if tag == "a" and self._in_detail_link:
            title = re.sub(r'\s*\[\d+\]$', '', "".join(self._current).strip())
            if title:
                self.titles.append(title)
            self._in_detail_link = False
            self._current = []


def fetch(url):
    req = urllib.request.Request(url, headers={"Cookie": COOKIES, "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read().decode("utf-8")


def extract_titles(html):
    parser = TitleParser()
    parser.feed(html)
    return parser.titles


def extract_next_url(html):
    m = re.search(r'href="([^"]*)" id="next"', html)
    if not m:
        return None
    return BASE + m.group(1)


def main():
    all_titles = []
    seen_keys = set()
    url = START_URL
    page = 0

    print("Fetching Melissa ISD catalog from Destiny...")

    while url:
        try:
            html = fetch(url)
        except Exception as e:
            print(f"  Error on page {page + 1}: {e}", file=sys.stderr)
            break

        page_titles = extract_titles(html)
        new_titles = [t for t in page_titles if t.lower() not in seen_keys]
        if page_titles and not new_titles:
            print(f"  Pagination loop detected at page {page + 1}, stopping.")
            break
        for t in new_titles:
            seen_keys.add(t.lower())
            all_titles.append(t)

        page += 1
        if page % 100 == 0:
            last = new_titles[-1] if new_titles else "?"
            print(f"  {page} pages, {len(all_titles)} unique titles so far ({last})")

        url = extract_next_url(html)

    if not all_titles:
        print("No titles collected — catalog.json not modified.", file=sys.stderr)
        sys.exit(1)

    unique = sorted(all_titles, key=str.lower)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with open(OUTPUT, "w") as f:
        json.dump({"generated": generated, "books": unique}, f, indent=2)

    print(f"Done: {len(unique)} unique titles from {page} pages → {OUTPUT}")


if __name__ == "__main__":
    main()
