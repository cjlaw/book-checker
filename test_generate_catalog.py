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

    def test_blank_is_none(self):
        self.assertIsNone(gencat.normalize_il("   "))


if __name__ == "__main__":
    unittest.main()
