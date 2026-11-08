import express, { type Express } from 'express';
import { bearerAuth } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { InMemoryOrderRepository } from './orders/order.repository';
import { createOrderRouter } from './orders/order.router';
import { OrderService } from './orders/order.service';

/** Composition root: wires dependencies so each piece stays independently replaceable. */
export function createApp({ apiToken }: { apiToken: string }): Express {
  const app = express();
  const orderService = new OrderService(new InMemoryOrderRepository());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  // Authenticate before parsing, so an anonymous caller always gets 401, never 400.
  app.use(bearerAuth(apiToken));
  app.use(express.json());
  app.use('/orders', createOrderRouter(orderService));
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
