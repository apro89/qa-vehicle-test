import { config } from 'dotenv';
import { z } from 'zod';

config({ quiet: true });

const positiveInt = z.coerce.number().int().positive();

const EnvSchema = z.object({
  API_BASE_URL: z.url(),
  API_TOKEN: z.string().min(1),

  START_MOCK_SERVER: z.stringbool(),
  MOCK_SERVER_PORT: positiveInt,
  WEB_SERVER_TIMEOUT_MS: positiveInt,

  CI: z.stringbool().default(false),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Invalid test environment configuration (did you copy .env.example to .env?):\n${z.prettifyError(parsed.error)}`,
  );
}

/**
 * Single, validated source of *environment* configuration: where the API is, how to
 * authenticate, whether to boot the mock. Runner behaviour (timeouts, retries, workers,
 * trace, reporters) is not environment-specific and lives in playwright.config.ts profiles.
 */
export const env = Object.freeze(parsed.data);
