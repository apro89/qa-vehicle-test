import { randomUUID } from 'node:crypto';
import { HttpError } from '../http-error';
import {
  ALLOWED_TRANSITIONS,
  type CreateOrderInput,
  type Order,
  type OrderStatus,
  type UpdateOrderInput,
} from './order.model';
import type { InMemoryOrderRepository } from './order.repository';

const TERMINAL_STATUSES: readonly OrderStatus[] = ['DELIVERED', 'CANCELLED'];

export class OrderService {
  constructor(
    private readonly repository: InMemoryOrderRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(input: CreateOrderInput): Order {
    const timestamp = this.now().toISOString();
    return this.repository.save({
      id: randomUUID(),
      ...input,
      status: 'PENDING',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  getById(id: string): Order {
    const order = this.repository.findById(id);
    if (!order) throw HttpError.notFound(`Order ${id} was not found`);
    return order;
  }

  update(id: string, changes: UpdateOrderInput): Order {
    const order = this.getById(id);

    if (TERMINAL_STATUSES.includes(order.status)) {
      throw HttpError.conflict('ORDER_LOCKED', `Order in status ${order.status} can no longer be modified`);
    }
    if (changes.status && changes.status !== order.status) {
      this.assertTransitionAllowed(order.status, changes.status);
    }

    return this.repository.save({
      ...order,
      ...changes,
      updatedAt: this.now().toISOString(),
    });
  }

  delete(id: string): void {
    const order = this.getById(id);
    if (order.status === 'DELIVERED') {
      throw HttpError.conflict('ORDER_LOCKED', 'Delivered orders cannot be deleted');
    }
    this.repository.delete(id);
  }

  private assertTransitionAllowed(from: OrderStatus, to: OrderStatus): void {
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw HttpError.conflict(
        'INVALID_STATUS_TRANSITION',
        `Cannot change status from ${from} to ${to}`,
      );
    }
  }
}
