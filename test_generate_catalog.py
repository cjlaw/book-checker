"""Unit tests for the pure logic in generate-catalog.py.

Run with:  python3 -m unittest test_generate_catalog
The module name has a hyphen, so it is loaded by path rather than imported.
Only top-level defs run on load (the crawl is behind `if __name__ == '__main__'`).
"""

import importlib.util
import pathlib
import unittest

_spec = importlib.util.spec_from_file_location(
    "gencat", pathlib.Path(__file__).with_name("generate-catalog.py")
)
gencat = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gencat)


class ClassifyCrawl(unittest.TestCase):
    def test_additions_only(self):
        added, removed, suspect = gencat.classify_crawl({"a", "b"}, {"a", "b", "c"})
        self.assertEqual(added, {"c"})
        self.assertEqual(removed, set())
        self.assertFalse(suspect)

    def test_removals_only(self):
        added, removed, suspect = gencat.classify_crawl({"a", "b", "c"}, {"a", "b"})
        self.assertEqual(added, set())
        self.assertEqual(removed, {"c"})
        self.assertFalse(suspect)

    def test_mixed(self):
        added, removed, suspect = gencat.classify_crawl({"a", "b"}, {"b", "c"})
        self.assertEqual(added, {"c"})
        self.assertEqual(removed, {"a"})
        self.assertFalse(suspect)

    def test_no_change(self):
        added, removed, suspect = gencat.classify_crawl({"a", "b"}, {"a", "b"})
        self.assertEqual(added, set())
        self.assertEqual(removed, set())
        self.assertFalse(suspect)

    def test_first_run_never_suspect(self):
        current = {str(i) for i in range(10000)}
        added, removed, suspect = gencat.classify_crawl(set(), current)
        self.assertEqual(added, current)
        self.assertEqual(removed, set())
        self.assertFalse(suspect)

    def test_large_drop_is_suspect(self):
        existing = {str(i) for i in range(14000)}
        current = {str(i) for i in range(7000)}  # half vanished → partial crawl
        _, removed, suspect = gencat.classify_crawl(existing, current)
        self.assertEqual(len(removed), 7000)
        self.assertTrue(suspect)

    def test_modest_weeding_not_suspect(self):
        existing = {str(i) for i in range(14000)}
        current = {str(i) for i in range(14000) if i >= 50}  # 50 removed
        _, removed, suspect = gencat.classify_crawl(existing, current)
        self.assertEqual(len(removed), 50)
        self.assertFalse(suspect)

    def test_below_absolute_floor_not_suspect(self):
        # 150 removed from 1000 is 15% but under the 200-entry floor.
        existing = {str(i) for i in range(1000)}
        current = {str(i) for i in range(1000) if i >= 150}
        _, removed, suspect = gencat.classify_crawl(existing, current)
        self.assertEqual(len(removed), 150)
        self.assertFalse(suspect)


class CrawlPageError(unittest.TestCase):
    BROWSE = gencat.BASE + "/cataloging/servlet/presentbrowsesearchresultsform.do?searchText=a"
    LOGIN = gencat.BASE + "/common/servlet/loginform.do"
    HOME = gencat.BASE + "/common/servlet/presenthomeform.do"
    ENTRY = {"search_key": "a"}

    def test_healthy_page_ok(self):
        self.assertIsNone(gencat.crawl_page_error(self.BROWSE, [self.ENTRY]))

    def test_login_redirect_fails(self):
        self.assertIsNotNone(gencat.crawl_page_error(self.LOGIN, [self.ENTRY]))

    def test_home_redirect_fails(self):
        self.assertIsNotNone(gencat.crawl_page_error(self.HOME, [self.ENTRY]))

    def test_empty_page_fails(self):
        self.assertIsNotNone(gencat.crawl_page_error(self.BROWSE, []))

    def test_all_seen_page_is_not_a_failure(self):
        # A non-empty page whose titles are all already-seen is the normal
        # end-of-catalog terminator, not a crawl_page_error failure. The caller
        # (crawl) stops gracefully; classify_crawl guards against an early loop.
        self.assertIsNone(gencat.crawl_page_error(self.BROWSE, [self.ENTRY]))


class NormalizeIl(unittest.TestCase):
    def test_plain_range_with_markup(self):
        self.assertEqual(gencat.normalize_il("2-4.</li></ul>"), "2-4")

    def test_grades_prefix_and_vendor_suffix(self):
        self.assertEqual(gencat.normalize_il("Grades 2-6 Junior Library Guild."), "2-6")

    def test_follett_suffix(self):
        self.assertEqual(gencat.normalize_il("3-6 Follett Content Solutions."), "3-6")

    def test_young_adult_preserved(self):
        self.assertEqual(gencat.normalize_il("Young Adult Follett Library Resources."), "Young Adult")

    def test_hyphen_spacing(self):
        self.assertEqual(gencat.normalize_il("PreK- 2."), "PreK-2")

    def test_word_label_kept(self):
        self.assertEqual(gencat.normalize_il("Preschool."), "Preschool")

    def test_perma_bound_suffix(self):
        self.assertEqual(gencat.normalize_il("K-3 Perma-Bound Books."), "K-3")

    def test_idempotent_on_cached_values(self):
        for v in ["3-6", "PreK-2", "Young Adult", "Preschool"]:
            self.assertEqual(gencat.normalize_il(v), v)

    def test_blank_is_none(self):
        self.assertIsNone(gencat.normalize_il("   "))


class IsLoginRedirect(unittest.TestCase):
    def test_site_picker_redirect(self):
        self.assertTrue(gencat.is_login_redirect(
            gencat.BASE + "/district/servlet/presentlistsitesform.do?districtMode=true"))

    def test_browse_page_is_not_redirect(self):
        self.assertFalse(gencat.is_login_redirect(gencat.BASE + "/cataloging/servlet/presentbrowsesearchresultsform.do"))


class FetchDetail(unittest.TestCase):
    def _run(self, html, final_url=gencat.BASE + "/cataloging/servlet/presentbrowseheadingdetailform.do"):
        orig = gencat.fetch
        gencat.fetch = lambda opener, url: (html, final_url)
        try:
            return gencat.fetch_detail(None, "/x")
        finally:
            gencat.fetch = orig

    def test_expired_session_200_with_no_records_is_auth(self):
        # Observed 2026-11-20: no JSESSIONID → 200 at the same URL, no bibID links.
        self.assertEqual(self._run("<html>Sharks</html>"), (None, "auth"))

    def test_real_detail_page_ok(self):
        html = '<a href="x?bibID=41022">'
        self.assertEqual(self._run(html), (html, None))


class DetailHref(unittest.TestCase):
    def test_matches_destiny_browse_href(self):
        entry = {"title": "365 Days of wonder : Mr. Browne's book of precepts",
                 "search_key": "0000000365 DAYS OF WONDER MR BROWNES BOOK OF PRECEPTS"}
        self.assertEqual(gencat.detail_href(entry),
            "/cataloging/servlet/presentbrowseheadingdetailform.do?searchKey=0000000365+DAYS+OF+WONDER+MR+BROWNES+BOOK+OF+PRECEPTS"
            "&searchDisplayable=365+Days+of+wonder+%3A+Mr.+Browne%27s+book+of+precepts&siteTypeID=-2&searchType=title"
            "&siteID=403&includeLibrary=true&includeMedia=false&mediaSiteID=")


def browse_link(text, key):
    return f'<a class="DetailLink" href="/x?searchKey={key}&amp;searchType=title">{text}</a>'


class TitleParserCount(unittest.TestCase):
    def test_multi_record_count_kept_and_stripped_from_title(self):
        [e] = gencat.extract_entries(browse_link("Sharks [6]", "SHARKS"))
        self.assertEqual((e["title"], e["search_key"], e["count"]), ("Sharks", "SHARKS", 6))

    def test_no_count_means_one(self):
        [e] = gencat.extract_entries(browse_link("Wonder", "WONDER"))
        self.assertEqual((e["title"], e["count"]), ("Wonder", 1))

    def test_bracket_inside_title_not_a_count(self):
        [e] = gencat.extract_entries(browse_link("Book [2] of the saga", "BOOK"))
        self.assertEqual((e["title"], e["count"]), ("Book [2] of the saga", 1))


# Trimmed from the real "Sharks" hit list (2026-11-20): each record has a
# DetailLink with id="bibID_<n>" plus a second bibID link for the cover.
HIT_LIST = """
<td class="SearchResultsHeader">Titles: 1 - 3 of 3</td>
<a class="DetailLink" href="/cataloging/servlet/presenttitledetailform.do?siteTypeID=-2&siteID=403&bibID=189556&walkerID=1" id="bibID_189556">Sharks&nbsp;</a>
<a href="/cataloging/servlet/presenttitledetailform.do?siteTypeID=-2&siteID=403&bibID=189556&viewType=2&quantity=1&walkerID=1">
<a class="DetailLink" href="/cataloging/servlet/presenttitledetailform.do?siteTypeID=-2&siteID=403&bibID=161424&walkerID=1" id="bibID_161424">Sharks&nbsp;</a>
<a class="DetailLink" href="/cataloging/servlet/presenttitledetailform.do?siteTypeID=-2&siteID=403&bibID=210353&walkerID=1" id="bibID_210353">Sharks&nbsp;</a>
"""


class ParseRecordIds(unittest.TestCase):
    def test_hit_list_ids_in_page_order(self):
        self.assertEqual(gencat.parse_record_ids(HIT_LIST), [189556, 161424, 210353])

    def test_duplicate_ids_collapsed(self):
        self.assertEqual(gencat.parse_record_ids('id="bibID_5" id="bibID_5"'), [5])

    def test_title_detail_page_has_none(self):
        self.assertEqual(gencat.parse_record_ids('<a href="x?bibID=189556&isbn=9781426333620">'), [])

    def test_record_href_needs_no_walker(self):
        self.assertEqual(gencat.record_href(189556),
            "/cataloging/servlet/presenttitledetailform.do?siteTypeID=-2&siteID=403"
            "&includeLibrary=true&includeMedia=false&mediaSiteID=&bibID=189556")


class NeedsFetch(unittest.TestCase):
    SINGLE = {"bibId": 1, "isbn": "9781426333620", "author": "Boyer, Crispin.", "il": "P-2"}
    MULTI = {"count": 2, "records": [SINGLE, SINGLE]}

    def check(self, count, meta):
        cache = {} if meta is None else {"K": meta}
        return gencat.needs_fetch({"search_key": "K", "count": count}, cache)

    def test_uncached(self):
        self.assertTrue(self.check(1, None))

    def test_cached_single_not_refetched(self):
        self.assertFalse(self.check(1, self.SINGLE))

    def test_legacy_entry_without_count_field_is_single(self):
        self.assertFalse(gencat.needs_fetch({"search_key": "K"}, {"K": self.SINGLE}))

    def test_old_first_record_only_cache_refetched_for_multi(self):
        self.assertTrue(self.check(6, self.SINGLE))

    def test_cached_multi_not_refetched(self):
        self.assertFalse(self.check(2, self.MULTI))

    def test_count_change_refetched(self):
        self.assertTrue(self.check(3, self.MULTI))

    def test_multi_shrunk_to_single_refetched(self):
        self.assertTrue(self.check(1, self.MULTI))


class FetchEntry(unittest.TestCase):
    ENTRY = {"search_key": "SHARKS", "title": "Sharks", "count": 3}

    def setUp(self):
        self.requested = []
        self.pages = {
            gencat.detail_href(self.ENTRY): HIT_LIST,
            gencat.record_href(189556): '<a href="x?bibID=189556&isbn=9781426333620">'
                '<a href="y?searchType=author&searchDisplayable=Boyer%2C+Crispin.&z">Interest grade level: P-2.</li>',
            gencat.record_href(161424): '<a href="x?bibID=161424&isbn=9781465418319">',
            gencat.record_href(210353): None,
        }

        def fake(opener, href):
            self.requested.append(href)
            html = self.pages[href]
            return (html, None) if html else (None, "HTTP Error 500")

        self.orig = gencat.fetch_authed
        gencat.fetch_authed = fake

    def tearDown(self):
        gencat.fetch_authed = self.orig

    def test_multi_fetches_every_record(self):
        self.pages[gencat.record_href(210353)] = '<a href="x?bibID=210353">'
        meta, err = gencat.fetch_entry(None, self.ENTRY)
        self.assertIsNone(err)
        self.assertEqual(meta["count"], 3)
        self.assertEqual([r["bibId"] for r in meta["records"]], [189556, 161424, 210353])
        self.assertEqual(meta["records"][0], {"bibId": 189556, "isbn": "9781426333620",
                                              "author": "Boyer, Crispin.", "il": "P-2"})

    def test_one_failed_record_caches_nothing(self):
        self.assertEqual(gencat.fetch_entry(None, self.ENTRY), (None, "HTTP Error 500"))

    def test_single_heading_fetches_once(self):
        entry = {"search_key": "W", "title": "W", "count": 1}
        self.pages[gencat.detail_href(entry)] = '<a href="x?bibID=7&isbn=9781426333620">'
        meta, err = gencat.fetch_entry(None, entry)
        self.assertEqual((meta["bibId"], err), (7, None))
        self.assertEqual(len(self.requested), 1)


class NormalizeAuthor(unittest.TestCase):
    def test_trailing_comma(self):
        self.assertEqual(gencat.normalize_author("Applegate, Katherine,"), "Applegate, Katherine")

    def test_trailing_period(self):
        self.assertEqual(gencat.normalize_author("Boyer, Crispin."), "Boyer, Crispin")

    def test_year_period(self):
        self.assertEqual(gencat.normalize_author("Rediger, Pat, 1966."), "Rediger, Pat, 1966")

    def test_initial_kept(self):
        self.assertEqual(gencat.normalize_author("Laughlin, Kara L."), "Laughlin, Kara L.")

    def test_abbreviation_kept(self):
        self.assertEqual(gencat.normalize_author("Seuss, Dr."), "Seuss, Dr.")

    def test_open_date_range_kept(self):
        self.assertEqual(gencat.normalize_author("Star, Fleur, 1974-"), "Star, Fleur, 1974-")

    def test_parenthetical_untouched(self):
        self.assertEqual(gencat.normalize_author("National Geographic Society (U.S.)"),
                         "National Geographic Society (U.S.)")

    def test_idempotent(self):
        for v in ["Boyer, Crispin", "Laughlin, Kara L.", "Seuss, Dr.", "Star, Fleur, 1974-"]:
            self.assertEqual(gencat.normalize_author(v), v)


class ParseDetailAuthor(unittest.TestCase):
    def test_author_link_preferred(self):
        html = ('<li><a class="DetailLink" href="/x?searchType=author&siteID=403&searchKey=BOYER+CRISPIN'
                '&searchDisplayable=Boyer%2C+Crispin.&fromTitleDetails=true">Titles by: Boyer, Crispin.</a></li>')
        self.assertEqual(gencat.parse_detail(html)["author"], "Boyer, Crispin.")

    def test_plain_text_statement_fallback(self):
        # bibID 189599 ("Soccer", 2026-11-20): no author heading, only the statement.
        html = '<ul><li>Titles by: Rediger, Pat, 1966.</li></ul>'
        self.assertEqual(gencat.parse_detail(html)["author"], "Rediger, Pat, 1966.")

    def test_fallback_unescapes_entities(self):
        self.assertEqual(gencat.parse_detail("<li>Titles by: O&#39;Brien &amp; Co.</li>")["author"], "O'Brien & Co.")

    def test_no_author(self):
        self.assertIsNone(gencat.parse_detail("<li>Sharks</li>")["author"])


class BuildBooks(unittest.TestCase):
    def test_multi_record_heading_yields_one_book_per_record(self):
        entries = [{"title": "Sharks", "search_key": "S", "count": 2}]
        cache = {"S": {"count": 2, "records": [
            {"author": "Boyer, Crispin.", "il": "P-2", "isbn": "9781426333620"},
            {"author": "Star, Fleur, 1974-", "il": "2-5 Perma-Bound Books", "isbn": "9781465418319"},
        ]}}
        self.assertEqual(gencat.build_books(entries, cache), [
            {"title": "Sharks", "author": "Boyer, Crispin", "il": "P-2", "isbn": "9781426333620"},
            {"title": "Sharks", "author": "Star, Fleur, 1974-", "il": "2-5", "isbn": "9781465418319"},
        ])

    def test_includes_isbn_and_sorts_by_title(self):
        entries = [{"title": "zebra", "search_key": "Z"}, {"title": "Apple", "search_key": "A"}]
        cache = {"A": {"author": "Doe, Jane", "il": "K-3", "isbn": "9781250236104"}}
        books = gencat.build_books(entries, cache)
        self.assertEqual([b["title"] for b in books], ["Apple", "zebra"])
        self.assertEqual(books[0]["isbn"], "9781250236104")
        self.assertEqual(books[1], {"title": "zebra", "author": None, "il": None, "isbn": None})

    def test_renormalizes_cached_il(self):
        entries = [{"title": "A", "search_key": "A"}]
        books = gencat.build_books(entries, {"A": {"il": "4-7 Perma-Bound Books"}})
        self.assertEqual(books[0]["il"], "4-7")


if __name__ == "__main__":
    unittest.main()
