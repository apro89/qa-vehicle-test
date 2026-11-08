import { Router } from 'express';
import type { z } from 'zod';
import { HttpError } from '../http-error';
import { CreateOrderInput, UpdateOrderInput } from './order.model';
import type { OrderService } from './order.service';

function validate<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw HttpError.badRequest(
      'Request body failed validation',
      result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }
  return result.data;
}

/** Check order: 401 (middleware) → 400 validation → 404 → 409 business rule. */
export function createOrderRouter(service: OrderService): Router {
  const router = Router();

  router.post('/', (req, res) => {
    const order = service.create(validate(CreateOrderInput, req.body));
    res.status(201).location(`/orders/${order.id}`).json(order);
  });

  router.get('/:id', (req, res) => {
    res.json(service.getById(req.params.id));
  });

  router.patch('/:id', (req, res) => {
    res.json(service.update(req.params.id, validate(UpdateOrderInput, req.body)));
  });

  router.delete('/:id', (req, res) => {
    service.delete(req.params.id);
    res.status(204).end();
  });

  return router;
}
