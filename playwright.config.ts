import { defineConfig, type PlaywrightTestConfig, type ReporterDescription } from '@playwright/test';
import { env } from './src/config/env';

/** Runner behaviour that differs between a person's machine and a pipeline. */
type RunProfile = {
  reporter: ReporterDescription[];
  trace: NonNullable<PlaywrightTestConfig['use']>['trace'];
  retries: number;
  workers: number;
};

/**
 * Run profiles, selected by the CI flag (set automatically by GitHub Actions, documented in
 * .env.example). Environment facts (API URL, token, mock) come from .env; everything about
 * how the runner behaves is decided here, in one place, per profile.
 *
 *  - local: fast feedback for a person. Compact console output, the HTML report opens after
 *    every run, every test keeps a full trace so a failure can be inspected without re-running,
 *    no retries (a flaky test must be seen, not hidden).
 *  - ci:    output for a pipeline. Annotated GitHub log, JUnit for the test tab, JSON for
 *    dashboards; HTML is written and published as an artefact; traces only for failures to
 *    keep artefacts small; one retry to separate infrastructure hiccups from real failures.
 */
const profiles: Record<'local' | 'ci', RunProfile> = {
  local: {
    reporter: [['list'], ['html', { outputFolder: 'reports/html', open: 'always' }]],
    trace: 'on',
    retries: 0,
    workers: 4,
  },
  ci: {
    reporter: [
      ['github'],
      ['html', { outputFolder: 'reports/html', open: 'never' }],
      ['junit', { outputFile: 'reports/junit/results.xml' }],
      ['json', { outputFile: 'reports/json/results.json' }],
    ],
    trace: 'retain-on-failure',
    retries: 1,
    workers: 2,
  },
};

const profile = profiles[env.CI ? 'ci' : 'local'];

/** API calls are quick; generous enough for a cold mock, tight enough to expose a hang. */
const TEST_TIMEOUT_MS = 30_000;
const EXPECT_TIMEOUT_MS = 5_000;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  // Accidentally committed test.only must fail the pipeline, not silently shrink the run.
  forbidOnly: env.CI,
  retries: profile.retries,
  workers: profile.workers,
  timeout: TEST_TIMEOUT_MS,
  expect: { timeout: EXPECT_TIMEOUT_MS },
  reporter: profile.reporter,

  use: {
    // Credentials are NOT set globally: the ordersApi / ordersApiFactory fixtures build
    // their own context (src/api/api-context.ts), so 401 tests can omit or forge the token.
    baseURL: env.API_BASE_URL,
    // Traces record every API request and response (headers + bodies).
    trace: profile.trace,
  },

  webServer: env.START_MOCK_SERVER
    ? {
        command: 'npm run mock',
        url: `http://localhost:${env.MOCK_SERVER_PORT}/health`,
        // Locally, reuse a mock you started yourself; in CI always boot a clean one.
        reuseExistingServer: !env.CI,
        timeout: env.WEB_SERVER_TIMEOUT_MS,
        stdout: 'pipe',
      }
    : undefined,
});
