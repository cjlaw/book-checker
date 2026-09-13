const { test, expect } = require("./fixtures");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("exact title in catalog is found", async ({ page }) => {
  await page.locator("#searchInput").fill("Dog Man");

  const result = page.locator("#result");
  await expect(result).toHaveClass(/found-only/);
  await expect(result).toContainText("Dog Man");
  // "Dog Man" and "Dog Man: A Tale of Two Kitties" match; "dog days" (no "man")
  // and "Iron Man" (no "dog") do not.
  await expect(result).toContainText("2 matches in the catalog");
  await expect(result).not.toContainText("Iron Man");
});

test("word-boundary matching: 'man' hits Dog/Iron Man but not Batman", async ({ page }) => {
  await page.locator("#searchInput").fill("man");

  const result = page.locator("#result");
  await expect(result).toContainText("Dog Man");
  await expect(result).toContainText("Iron Man");
  await expect(result).not.toContainText("Batman");
});

test("multi-word query stays precise", async ({ page }) => {
  await page.locator("#searchInput").fill("harry potter");

  const matches = page.locator(".match-item");
  await expect(matches).toHaveCount(2);
  await expect(page.locator("#result")).toContainText("Harry Potter");
});

test("title not in catalog reports not found", async ({ page }) => {
  await page.locator("#searchInput").fill("The Hobbit");

  const result = page.locator("#result");
  await expect(result).toHaveClass(/not-found/);
  await expect(result).toContainText("not in the catalog");
  await expect(result).toContainText("The Hobbit");
});

test("single-character query does not fire a search", async ({ page }) => {
  await page.locator("#searchInput").fill("d");

  // Below the 2-char minimum: no result rendered.
  await expect(page.locator("#result")).toBeEmpty();
  await expect(page.locator("#result")).not.toHaveClass(/visible/);
});

test("match titles are HTML-escaped, not injected as markup", async ({ page }) => {
  await page.locator("#searchInput").fill("Wonder");

  // If esc() were bypassed, "<Chaos>" would become an element and textContent
  // would differ. Reading it back verbatim proves the string was escaped.
  await expect(page.locator(".match-title")).toHaveText("Wonder & <Chaos>");
});
