import { defineConfig, devices } from "@playwright/test";

/**
 * One end-to-end journey (operator → passenger → operator → passenger) against
 * a real Supabase: the local stack from `supabase start`, or a dedicated test
 * project. `scripts/test-e2e.sh` brings the stack up and sets these vars.
 *
 *   VITE_SUPABASE_URL              the API the app talks to
 *   VITE_SUPABASE_PUBLISHABLE_KEY  its anon key
 *   SUPABASE_SERVICE_ROLE_KEY      optional; only used to delete test users
 *   E2E_BASE_URL                   optional; skip the dev server and use this
 */
const port = Number(process.env.E2E_PORT ?? 8080);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const startDevServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  // The journey is one shared story across two accounts; running it twice over
  // the same database at once would make the queue ambiguous.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL,
    // Tracing every run costs a third of the CPU; a retry is when it is wanted.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: startDevServer
    ? {
        command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "pipe",
        stderr: "pipe",
      }
    : undefined,
});
