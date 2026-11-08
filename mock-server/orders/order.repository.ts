import type { Order } from './order.model';

/** In-memory persistence. Swap for a real store without touching the service. */
export class InMemoryOrderRepository {
  private readonly orders = new Map<string, Order>();

  findById(id: string): Order | undefined {
    return this.orders.get(id);
  }

  save(order: Order): Order {
    this.orders.set(order.id, order);
    return order;
  }

  delete(id: string): boolean {
    return this.orders.delete(id);
  }
}
