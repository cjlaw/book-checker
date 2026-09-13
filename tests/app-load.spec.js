const { test, expect, CATALOG } = require("./fixtures");

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("status bar shows the catalog count and generation date", async ({ page }) => {
  const status = page.locator("#statusText");
  await expect(status).toContainText(`${CATALOG.books.length} books`);
  await expect(status).toContainText("August 25, 2026");
});

test("empty state is visible on load, before any search", async ({ page }) => {
  await expect(page.locator("#emptyState")).toBeVisible();
  await expect(page.locator("#result")).toBeEmpty();
});

test("switching to the bulk tab shows the bulk pane and hides single", async ({ page }) => {
  await expect(page.locator("#paneSingle")).toBeVisible();
  await expect(page.locator("#paneBulk")).toBeHidden();

  await page.getByRole("tab", { name: "A Whole List" }).click();

  await expect(page.locator("#paneBulk")).toBeVisible();
  await expect(page.locator("#paneSingle")).toBeHidden();
  await expect(page.getByRole("tab", { name: "A Whole List" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("switching tabs clears the other tab's state", async ({ page }) => {
  // Run a search on the single tab...
  await page.locator("#searchInput").fill("Dog Man");
  await expect(page.locator("#result")).toContainText("catalog");

  // ...switch to bulk and back; the single result should be cleared.
  await page.getByRole("tab", { name: "A Whole List" }).click();
  await page.getByRole("tab", { name: "One Book" }).click();

  await expect(page.locator("#searchInput")).toHaveValue("");
  await expect(page.locator("#result")).toBeEmpty();
  await expect(page.locator("#emptyState")).toBeVisible();
});
