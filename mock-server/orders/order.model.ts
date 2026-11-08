// Provider-side model. Deliberately NOT shared with the test suite (src/schemas),
// so contract tests verify the mock instead of agreeing with themselves.
import { z } from 'zod';

export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'DELIVERED', 'CANCELLED'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Order lifecycle state machine: the business rule PATCH enforces. */
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const PriceInput = z.strictObject({
  amount: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Must be an ISO 4217 code'),
});

export const CreateOrderInput = z.strictObject({
  dealerId: z.string().regex(/^DLR-\d{5}$/, 'Must match DLR-00000'),
  customer: z.strictObject({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    email: z.email(),
  }),
  vehicle: z.strictObject({
    vin: z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/, 'VIN must be 17 characters (no I, O or Q)'),
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().min(1990).max(new Date().getFullYear() + 1),
    trim: z.string().min(1).optional(),
  }),
  price: PriceInput,
});

export const UpdateOrderInput = z
  .strictObject({
    status: z.enum(ORDER_STATUSES).optional(),
    price: PriceInput.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, 'At least one updatable field is required');

export type CreateOrderInput = z.infer<typeof CreateOrderInput>;
export type UpdateOrderInput = z.infer<typeof UpdateOrderInput>;

export type Order = CreateOrderInput & {
  id: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};
