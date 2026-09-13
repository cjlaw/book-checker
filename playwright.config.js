const { defineConfig, devices } = require("@playwright/test");

// The app is served exactly as in production: `python3 -m http.server`.
// catalog.json is stubbed per-test in tests/fixtures.js, so the real 1.8MB
// catalog (which refreshes weekly) is never loaded and assertions stay stable.
module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:8888",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "python3 -m http.server 8888",
    url: "http://localhost:8888",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
