/**
 * Consumer contract for the Vehicle Ordering API.
 * Strict objects: an unexpected field (e.g. a leaked internal attribute) is a contract break.
 */
import { z } from 'zod';

export const OrderStatusSchema = z.enum([
  'PENDING',
  'CONFIRMED',
  'IN_PRODUCTION',
  'DELIVERED',
  'CANCELLED',
]);
export const OrderStatus = OrderStatusSchema.enum;

export const VinSchema = z.string().regex(/^[A-HJ-NPR-Z0-9]{17}$/);

export const CustomerSchema = z.strictObject({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.email(),
});

export const VehicleSchema = z.strictObject({
  vin: VinSchema,
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.number().int(),
  trim: z.string().min(1).optional(),
});

export const PriceSchema = z.strictObject({
  amount: z.number().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
});

export const CreateOrderRequestSchema = z.strictObject({
  dealerId: z.string().min(1),
  customer: CustomerSchema,
  vehicle: VehicleSchema,
  price: PriceSchema,
});

export const UpdateOrderRequestSchema = z.strictObject({
  status: OrderStatusSchema.optional(),
  price: PriceSchema.optional(),
});

export const OrderSchema = CreateOrderRequestSchema.extend({
  id: z.uuid(),
  status: OrderStatusSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
export type UpdateOrderRequest = z.infer<typeof UpdateOrderRequestSchema>;
export type Order = z.infer<typeof OrderSchema>;
