import { HttpStatus } from '@/constants/http-status';
import { pathTo } from '@/data/order-lifecycle';
import { buildCreateOrderPayload } from '@/data/order.factory';
import { expect } from '@/fixtures/matchers';
import { boxedStep } from '@/helpers/boxed-step.decorator';
import { parseBody } from '@/helpers/response.helpers';
import {
  OrderSchema,
  type CreateOrderRequest,
  type Order,
  type OrderStatus,
} from '@/schemas/order.schema';
import type { OrdersClient } from './orders.client';

/** What OrderSteps needs from the cleanup mechanism (DIP: the consumer owns the interface). */
export type OrderTracker = {
  /** Registers an order for deletion after the test, regardless of outcome. */
  track(orderId: string): void;
};

/**
 * Typed, self-asserting business steps for Arrange and Assert phases.
 * The endpoint under test is always called through OrdersClient directly,
 * so the test body shows exactly what is being verified.
 * Each method is a boxed step (see @boxedStep).
 */
export class OrderSteps {
  constructor(
    private readonly api: OrdersClient,
    private readonly tracker: OrderTracker,
  ) {}

  @boxedStep('create order')
  async createOrder(payload: CreateOrderRequest = buildCreateOrderPayload()): Promise<Order> {
    const response = await this.api.create(payload);
    await expect(response).toHaveStatus(HttpStatus.CREATED);
    const order = await parseBody(response, OrderSchema);
    this.tracker.track(order.id);
    return order;
  }

  @boxedStep((id: string) => `fetch order ${id}`)
  async getOrder(id: string): Promise<Order> {
    const response = await this.api.getById(id);
    await expect(response).toHaveStatus(HttpStatus.OK);
    return parseBody(response, OrderSchema);
  }

  @boxedStep((id: string, status: OrderStatus) => `advance order ${id} to ${status}`)
  async advanceOrder(id: string, status: OrderStatus): Promise<Order> {
    const response = await this.api.update(id, { status });
    await expect(response).toHaveStatus(HttpStatus.OK);
    return parseBody(response, OrderSchema);
  }

  /**
   * Arranges an order in any lifecycle status by walking the shortest allowed path
   * from PENDING (see ALLOWED_TRANSITIONS). Lets a test start "given a DELIVERED order"
   * without spelling out the intermediate PATCH calls.
   */
  @boxedStep((status: OrderStatus) => `create order in status ${status}`)
  async createOrderInStatus(status: OrderStatus): Promise<Order> {
    let order = await this.createOrder();
    for (const next of pathTo(status)) {
      order = await this.advanceOrder(order.id, next);
    }
    return order;
  }
}
