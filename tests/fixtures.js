const base = require("@playwright/test");

// A small, known catalog. Every E2E assertion is written against THIS data,
// so tests never depend on the real 1.8MB catalog.json (which the weekly
// refresh workflow rewrites). Mirrors the curated set used by unit tests in
// test.js, plus one entry with HTML-special characters to exercise esc().
const CATALOG = {
  generated: "2026-08-25",
  books: [
    { title: "Dog Man", author: "Pilkey, Dav", rl: null, il: "P-2" },
    { title: "Dog Man: A Tale of Two Kitties", author: "Pilkey, Dav", rl: null, il: null },
    { title: "Iron Man", author: "Thomas, Roy", rl: null, il: null },
    { title: "Batman: Gotham's Hero", author: "Beatty, Scott", rl: null, il: null },
    { title: "The Salamander Room", author: "Mazer, Anne", rl: null, il: null },
    { title: "The Human Body", author: "Walker, Richard", rl: null, il: null },
    { title: "Harry Potter and the Sorcerer's Stone", author: "Rowling, J. K.", rl: null, il: null },
    { title: "Harry Potter and the Chamber of Secrets", author: "Rowling, J. K.", rl: null, il: null },
    { title: "Diary of a Wimpy Kid : dog days", author: "Kinney, Jeff", rl: null, il: null },
    { title: "Charlotte's Web", author: "White, E. B.", rl: null, il: null },
    { title: "Frog and Toad Are Friends", author: "Lobel, Arnold", rl: null, il: null },
    { title: "Every Day After", author: "Mankiller, Wilma", rl: null, il: null },
    { title: "Wonder & <Chaos>", author: "Ampersand, Amy", rl: null, il: null },
  ],
};

// Extends Playwright's `page` so catalog.json is intercepted before the app
// fetches it. Any request the app makes for catalog.json gets the fixture.
const test = base.test.extend({
  page: async ({ page }, use) => {
    await page.route("**/catalog.json", (route) =>
      route.fulfill({ json: CATALOG }),
    );
    await use(page);
  },
});

module.exports = { test, expect: base.expect, CATALOG };
