import type { APIRequestContext, PlaywrightWorkerArgs } from '@playwright/test';
import { env } from '@/config/env';

type RequestFactory = PlaywrightWorkerArgs['playwright']['request'];

/**
 * Single place that knows how to build an APIRequestContext for the API under test.
 * Omit the token to get an anonymous (unauthenticated) context.
 */
export function newApiContext(requestFactory: RequestFactory, token?: string): Promise<APIRequestContext> {
  return requestFactory.newContext({
    baseURL: env.API_BASE_URL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  });
}
