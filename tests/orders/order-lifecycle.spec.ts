import { test, expect } from '@/fixtures';
import { HttpStatus } from '@/constants/http-status';
import { allowedTransitions, forbiddenTransitions } from '@/data/order-lifecycle';
import { expectApiError, parseBody } from '@/helpers/response.helpers';
import { OrderSchema } from '@/schemas/order.schema';

/**
 * Order lifecycle (risk R1, "every status transition"). Both loops are driven by the
 * single state-machine table in src/data/order-lifecycle.ts, so the suite proves the
 * whole machine: every allowed edge succeeds, everything else is refused.
 */
test.describe('PATCH /orders/{id}', () => {
  for (const { from, to } of allowedTransitions) {
    test(
      `moves an order from ${from} to ${to} and changes nothing else`,
      { tag: '@regression' },
      async ({ ordersApi, orderSteps }) => {
        const order = await orderSteps.createOrderInStatus(from);

        const response = await ordersApi.update(order.id, { status: to });

        await expect(response).toHaveStatus(HttpStatus.OK);
        const updated = await parseBody(response, OrderSchema);
        // Only status and updatedAt may change; every other field is preserved.
        expect(updated).toEqual({ ...order, status: to, updatedAt: updated.updatedAt });
        expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(Date.parse(order.updatedAt));

        await test.step('Assert: new status is persisted', async () => {
          expect(await orderSteps.getOrder(order.id)).toEqual(updated);
        });
      },
    );
  }

  for (const { from, to, code } of forbiddenTransitions) {
    test(
      `rejects ${from} → ${to} with 409 ${code} and leaves the order untouched`,
      { tag: ['@negative', '@regression'] },
      async ({ ordersApi, orderSteps }) => {
        const order = await orderSteps.createOrderInStatus(from);

        const response = await ordersApi.update(order.id, { status: to });

        await expectApiError(response, { status: HttpStatus.CONFLICT, code });

        await test.step('Assert: order is unchanged (no partial write)', async () => {
          expect(await orderSteps.getOrder(order.id)).toEqual(order);
        });
      },
    );
  }
});
