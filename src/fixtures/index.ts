import { test as base, type APIRequestContext } from '@playwright/test';
import { newApiContext } from '@/api/api-context';
import { OrderSteps, type OrderTracker } from '@/api/order.steps';
import { OrdersClient } from '@/api/orders.client';
import { env } from '@/config/env';

/** Builds an OrdersClient with any bearer token; omit the token for an anonymous caller. */
type OrdersApiFactory = (token?: string) => Promise<OrdersClient>;

type ApiFixtures = {
  /** Low-level factory, mainly for authentication tests (missing or forged token). */
  ordersApiFactory: OrdersApiFactory;
  /** Authenticated client (API_TOKEN). Use it for the endpoint under test. */
  ordersApi: OrdersClient;
  /** Deletes every tracked order after the test, regardless of outcome. */
  orderCleanup: OrderTracker;
  /** Self-asserting Arrange/verify steps; created orders are cleaned up automatically. */
  orderSteps: OrderSteps;
};

export const test = base.extend<ApiFixtures>({
  ordersApiFactory: async ({ playwright }, use) => {
    const contexts: APIRequestContext[] = [];

    await use(async (token) => {
      const context = await newApiContext(playwright.request, token);
      contexts.push(context);
      return new OrdersClient(context);
    });

    await Promise.allSettled(contexts.map((context) => context.dispose()));
  },

  ordersApi: async ({ ordersApiFactory }, use) => {
    await use(await ordersApiFactory(env.API_TOKEN));
  },

  // Depends on ordersApi, so it is torn down first, while the context is still alive.
  orderCleanup: async ({ ordersApi }, use) => {
    const createdIds = new Set<string>();
    await use({ track: (id) => createdIds.add(id) });

    // Best effort: a 404 (already deleted by the test) or a hiccup here
    // must never mask the real test result.
    await Promise.allSettled([...createdIds].map((id) => ordersApi.delete(id)));
  },

  orderSteps: async ({ ordersApi, orderCleanup }, use) => {
    await use(new OrderSteps(ordersApi, orderCleanup));
  },
});

export { expect } from './matchers';
