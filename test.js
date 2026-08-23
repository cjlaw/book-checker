const { test } = require("node:test");
const assert = require("node:assert/strict");
const { esc, splitCSVLine, parseCSV, parsePaste, filterCatalog } = require("./lib.js");

const hasTitle = (hits, t) => hits.some((e) => e.title === t);

const C = [
  { title: "Dog Man", author: "Pilkey, Dav" },
  { title: "Dog Man: A Tale of Two Kitties", author: "Pilkey, Dav" },
  { title: "Iron Man", author: "Thomas, Roy" },
  { title: "Batman: Gotham's Hero", author: "Beatty, Scott" },
  { title: "The Salamander Room", author: "Mazer, Anne" },
  { title: "The Human Body", author: "Walker, Richard" },
  { title: "Harry Potter and the Sorcerer's Stone", author: "Rowling, J. K." },
  { title: "Harry Potter and the Chamber of Secrets", author: "Rowling, J. K." },
  { title: "Diary of a Wimpy Kid : dog days", author: "Kinney, Jeff" },
  { title: "Charlotte's Web", author: "White, E. B." },
  { title: "Frog and Toad Are Friends", author: "Lobel, Arnold" },
  { title: "Every Day After", author: "Mankiller, Wilma" },
];

// ── filterCatalog ──

test("filterCatalog: word boundary excludes substrings", () => {
  const hits = filterCatalog(C, "man");
  assert.ok(hasTitle(hits, "Dog Man"), "includes Dog Man");
  assert.ok(hasTitle(hits, "Iron Man"), "includes Iron Man");
  assert.ok(!hasTitle(hits, "Batman: Gotham's Hero"), "excludes Batman");
  assert.ok(!hasTitle(hits, "The Salamander Room"), "excludes Salamander");
  assert.ok(!hasTitle(hits, "The Human Body"), "excludes Human");
});

test("filterCatalog: multi-word AND match", () => {
  const hits = filterCatalog(C, "harry potter");
  assert.equal(hits.length, 2);
  assert.ok(hits.every((e) => e.title.startsWith("Harry Potter")));
});

test("filterCatalog: both words must match (dog man excludes dog days)", () => {
  const hits = filterCatalog(C, "dog man");
  assert.ok(hasTitle(hits, "Dog Man"));
  assert.ok(hasTitle(hits, "Dog Man: A Tale of Two Kitties"));
  assert.ok(!hasTitle(hits, "Diary of a Wimpy Kid : dog days"), "excludes dog days");
});

test("filterCatalog: single word matches across titles", () => {
  const hits = filterCatalog(C, "dog");
  assert.ok(hasTitle(hits, "Dog Man"));
  assert.ok(hasTitle(hits, "Diary of a Wimpy Kid : dog days"));
});

test("filterCatalog: stop word in query ignored, remaining words match", () => {
  const hits = filterCatalog(C, "frog and toad");
  assert.deepEqual(hits.map((e) => e.title), ["Frog and Toad Are Friends"]);
});

test("filterCatalog: pure stop word returns null", () => {
  assert.equal(filterCatalog(C, "the"), null);
  assert.equal(filterCatalog(C, "and"), null);
});

test("filterCatalog: query too short returns null", () => {
  assert.equal(filterCatalog(C, "do"), null);
});

test("filterCatalog: case-insensitive", () => {
  const hits = filterCatalog(C, "CHARLOTTE");
  assert.deepEqual(hits.map((e) => e.title), ["Charlotte's Web"]);
});

test("filterCatalog: no matches returns empty array (not null)", () => {
  const hits = filterCatalog(C, "xyzzy");
  assert.ok(Array.isArray(hits));
  assert.equal(hits.length, 0);
});

test("filterCatalog: author word match returns matching entries", () => {
  const hits = filterCatalog(C, "Pilkey");
  assert.ok(hasTitle(hits, "Dog Man"));
  assert.ok(hasTitle(hits, "Dog Man: A Tale of Two Kitties"));
  assert.ok(!hasTitle(hits, "Iron Man"));
});

test("filterCatalog: cross-field AND matches title word and author word", () => {
  const hits = filterCatalog(C, "Dog Pilkey");
  assert.ok(hasTitle(hits, "Dog Man"));
  assert.ok(hasTitle(hits, "Dog Man: A Tale of Two Kitties"));
  assert.ok(!hasTitle(hits, "Diary of a Wimpy Kid : dog days"));
});

test("filterCatalog: author substring does not match at non-word-boundary", () => {
  const hits = filterCatalog(C, "man");
  assert.ok(!hasTitle(hits, "Every Day After"), "Mankiller should not match \\bman\\b");
});

// ── parsePaste ──

test("parsePaste: plain titles one per line", () => {
  const result = parsePaste("Dog Man\nHatchet");
  assert.deepEqual(result, [
    { title: "Dog Man", author: "" },
    { title: "Hatchet", author: "" },
  ]);
});

test("parsePaste: tab-separated title and author", () => {
  const result = parsePaste("Dog Man\tDav Pilkey");
  assert.deepEqual(result, [{ title: "Dog Man", author: "Dav Pilkey" }]);
});

test("parsePaste: > separator", () => {
  const result = parsePaste("Matilda > Roald Dahl");
  assert.deepEqual(result, [{ title: "Matilda", author: "Roald Dahl" }]);
});

test("parsePaste: empty lines filtered out", () => {
  const result = parsePaste("Dog Man\n\nHatchet\n");
  assert.equal(result.length, 2);
});

test("parsePaste: whitespace-only lines filtered out", () => {
  const result = parsePaste("Dog Man\n   \nHatchet");
  assert.equal(result.length, 2);
});

// ── parseCSV ──

test("parseCSV: title column only", () => {
  const { error, rows } = parseCSV("Title\nDog Man\nHatchet");
  assert.equal(error, null);
  assert.deepEqual(rows, [
    { title: "Dog Man", author: "" },
    { title: "Hatchet", author: "" },
  ]);
});

test("parseCSV: title and author columns", () => {
  const { error, rows } = parseCSV("title,author\nDog Man,Dav Pilkey");
  assert.equal(error, null);
  assert.deepEqual(rows, [{ title: "Dog Man", author: "Dav Pilkey" }]);
});

test("parseCSV: no title column returns error", () => {
  const { error, rows } = parseCSV("Book,Author\nDog Man,Dav Pilkey");
  assert.equal(error, "No title column found in the CSV.");
  assert.deepEqual(rows, []);
});

test("parseCSV: fewer than 2 lines returns empty rows", () => {
  const { error, rows } = parseCSV("Title");
  assert.equal(error, null);
  assert.deepEqual(rows, []);
});

test("parseCSV: quoted field containing a comma", () => {
  const { error, rows } = parseCSV('title\n"Dog Man, A Novel"');
  assert.equal(error, null);
  assert.equal(rows[0].title, "Dog Man, A Novel");
});

test("parseCSV: escaped double-quote inside quoted field", () => {
  const { error, rows } = parseCSV('title\n"It\'s ""Great"""');
  assert.equal(error, null);
  assert.equal(rows[0].title, 'It\'s "Great"');
});

test("parseCSV: quoted field spanning multiple lines", () => {
  const { error, rows } = parseCSV('title\n"Dog Man:\nA Novel"\nHatchet');
  assert.equal(error, null);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "Dog Man:\nA Novel");
  assert.equal(rows[1].title, "Hatchet");
});

test("parseCSV: skips rows with empty title", () => {
  const { rows } = parseCSV("title\nDog Man\n\nHatchet");
  assert.equal(rows.length, 2);
});

// ── esc ──

test("esc: escapes HTML special chars", () => {
  assert.equal(esc('<script>alert("xss")</script>'), "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  assert.equal(esc("a & b"), "a &amp; b");
});

test("esc: plain text unchanged", () => {
  assert.equal(esc("Dog Man"), "Dog Man");
});

test("esc: coerces non-string to string", () => {
  assert.equal(esc(42), "42");
});

// ── splitCSVLine ──

test("splitCSVLine: simple fields", () => {
  assert.deepEqual(splitCSVLine("a,b,c"), ["a", "b", "c"]);
});

test("splitCSVLine: quoted field with comma", () => {
  assert.deepEqual(splitCSVLine('"a,b",c'), ["a,b", "c"]);
});

test("splitCSVLine: escaped double-quote inside quoted field", () => {
  assert.deepEqual(splitCSVLine('"a""b"'), ['a"b']);
});

test("splitCSVLine: trims whitespace around fields", () => {
  assert.deepEqual(splitCSVLine(" a , b , c "), ["a", "b", "c"]);
});
