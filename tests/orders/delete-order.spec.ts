import { test, expect } from '@/fixtures';
import { HttpStatus } from '@/constants/http-status';
import { unknownOrderId } from '@/data/order.factory';
import { expectApiError } from '@/helpers/response.helpers';
import { ErrorCode } from '@/schemas/error.schema';
import { OrderStatus } from '@/schemas/order.schema';

/** Delete rules (risk R1, "delete/cancel rules"): who may disappear, who must stay. */
test.describe('DELETE /orders/{id}', () => {
  test(
    'deletes a PENDING order so it can no longer be retrieved',
    { tag: '@smoke' },
    async ({ ordersApi, orderSteps }) => {
      const order = await orderSteps.createOrder();

      const response = await ordersApi.delete(order.id);

      await expect(response).toHaveStatus(HttpStatus.NO_CONTENT);
      expect(await response.text()).toBe('');

      await test.step('Assert: GET /orders/{id} now returns 404', async () => {
        await expectApiError(await ordersApi.getById(order.id), {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND,
        });
      });
    },
  );

  test(
    'refuses to delete a DELIVERED order with 409 and keeps it retrievable',
    { tag: ['@negative', '@regression'] },
    async ({ ordersApi, orderSteps }) => {
      // A delivered vehicle is an accounting fact: the record must survive.
      const delivered = await orderSteps.createOrderInStatus(OrderStatus.DELIVERED);

      const response = await ordersApi.delete(delivered.id);

      await expectApiError(response, {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.ORDER_LOCKED,
      });

      await test.step('Assert: order still exists and is unchanged', async () => {
        expect(await orderSteps.getOrder(delivered.id)).toEqual(delivered);
      });
    },
  );

  test(
    'returns 404 when the order does not exist',
    { tag: '@negative' },
    async ({ ordersApi }) => {
      const response = await ordersApi.delete(unknownOrderId());

      await expectApiError(response, {
        status: HttpStatus.NOT_FOUND,
        code: ErrorCode.NOT_FOUND,
      });
    },
  );
});
