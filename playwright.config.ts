import { defineConfig, devices } from "@playwright/test";

// Unit tests run in Node; e2e tests drive the app at E2E_BASE_URL (a dev server pointed at the
// *local* Supabase, see tests/README.md), never the hosted project.
export default defineConfig({
  testDir: "tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  projects: [
    { name: "unit", testDir: "tests/unit" },
    {
      name: "e2e",
      testDir: "tests/e2e",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
      },
    },
  ],
});
