import { faker } from '@faker-js/faker';
import type { CreateOrderRequest } from '@/schemas/order.schema';

/** A well-formed id that no order has: for not-found scenarios. */
export const unknownOrderId = (): string => faker.string.uuid();

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/**
 * Builds a valid, unique order payload. Override only what the test cares about:
 *   buildCreateOrderPayload({ vehicle: { year: 2020 } })
 */
export function buildCreateOrderPayload(
  overrides: DeepPartial<CreateOrderRequest> = {},
): CreateOrderRequest {
  const base: CreateOrderRequest = {
    dealerId: `DLR-${faker.string.numeric(5)}`,
    customer: {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      email: faker.internet.email({ provider: 'example.com' }),
    },
    vehicle: {
      vin: faker.vehicle.vin(),
      make: faker.vehicle.manufacturer(),
      model: faker.vehicle.model(),
      year: faker.date.recent({ days: 365 * 3 }).getFullYear(),
      trim: faker.helpers.arrayElement(['Base', 'Comfort', 'Sport', 'Premium']),
    },
    price: {
      amount: Number(faker.commerce.price({ min: 15_000, max: 120_000, dec: 2 })),
      currency: 'EUR',
    },
  };

  return {
    ...base,
    ...overrides,
    customer: { ...base.customer, ...overrides.customer },
    vehicle: { ...base.vehicle, ...overrides.vehicle },
    price: { ...base.price, ...overrides.price },
  };
}
