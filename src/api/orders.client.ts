import type { APIRequestContext, APIResponse } from '@playwright/test';
import { ApiRoutes } from '@/constants/routes';
import type { CreateOrderRequest, UpdateOrderRequest } from '@/schemas/order.schema';

/** Loosely-typed body, used by negative tests to send deliberately invalid payloads. */
export type RawPayload = Record<string, unknown>;

/**
 * Thin transport layer for /orders. One method per endpoint, no assertions,
 * returns the raw APIResponse so each test decides what "correct" means.
 * The request context is injected (DIP), so the same client works with any
 * auth or baseURL configuration.
 */
export class OrdersClient {
  constructor(private readonly request: APIRequestContext) {}

  create(payload: CreateOrderRequest | RawPayload): Promise<APIResponse> {
    return this.request.post(ApiRoutes.orders, { data: payload });
  }

  getById(id: string): Promise<APIResponse> {
    return this.request.get(ApiRoutes.orderById(id));
  }

  update(id: string, changes: UpdateOrderRequest | RawPayload): Promise<APIResponse> {
    return this.request.patch(ApiRoutes.orderById(id), { data: changes });
  }

  delete(id: string): Promise<APIResponse> {
    return this.request.delete(ApiRoutes.orderById(id));
  }
}
