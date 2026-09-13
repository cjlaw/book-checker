const { test, expect } = require("./fixtures");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "A Whole List" }).click();
});

test("pasted list reports found and not-found with correct counts", async ({ page }) => {
  await page.locator("#pasteInput").fill("Dog Man\nThe Hobbit");
  await page.getByRole("button", { name: "Check List" }).click();

  const results = page.locator("#bulkResults");
  await expect(results).toContainText("1 Found");
  await expect(results).toContainText("1 Not Found");
  // Guidance line only appears when something is not found.
  await expect(results).toContainText("not in the library catalog");

  await expect(page.locator("tr", { hasText: "Dog Man" })).toContainText("Found");
  await expect(page.locator("tr.row-unknown", { hasText: "The Hobbit" })).toBeVisible();
});

test("all-found list omits the not-found guidance", async ({ page }) => {
  await page.locator("#pasteInput").fill("Dog Man\nIron Man");
  await page.getByRole("button", { name: "Check List" }).click();

  const results = page.locator("#bulkResults");
  await expect(results).toContainText("2 Found");
  await expect(results).not.toContainText("Not Found");
  await expect(results).not.toContainText("not in the library catalog");
});

test("CSV upload parses the title column and renders results", async ({ page }) => {
  // Reveal the CSV section (hidden behind a toggle by default).
  await page.getByRole("button", { name: "or upload a CSV file instead" }).click();

  await page.locator("#csvInput").setInputFiles({
    name: "books.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("title\nDog Man\nThe Hobbit\n"),
  });
  await page.getByRole("button", { name: "Check", exact: true }).click();

  const results = page.locator("#bulkResults");
  await expect(results).toContainText("1 Found");
  await expect(results).toContainText("1 Not Found");
  await expect(page.locator("tr", { hasText: "Dog Man" })).toContainText("Found");
});

test("empty paste does nothing", async ({ page }) => {
  await page.getByRole("button", { name: "Check List" }).click();
  await expect(page.locator("#bulkResults")).toBeEmpty();
});
