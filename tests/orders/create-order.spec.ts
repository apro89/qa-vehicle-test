import { test, expect } from '@/fixtures';
import { HttpStatus } from '@/constants/http-status';
import { ApiRoutes } from '@/constants/routes';
import { buildCreateOrderPayload } from '@/data/order.factory';
import { invalidCreateOrderCases } from '@/data/invalid-order.cases';
import { expectApiError, parseBody } from '@/helpers/response.helpers';
import { ErrorCode } from '@/schemas/error.schema';
import { OrderSchema, OrderStatus } from '@/schemas/order.schema';

test.describe('POST /orders', () => {
  test(
    'creates a PENDING order that honours the contract and is persisted',
    { tag: ['@smoke', '@contract'] },
    async ({ ordersApi, orderSteps, orderCleanup }) => {
      const payload = buildCreateOrderPayload();

      const response = await ordersApi.create(payload);

      await expect(response).toHaveStatus(HttpStatus.CREATED);
      const created = await parseBody(response, OrderSchema);
      orderCleanup.track(created.id);

      expect(created).toMatchObject({ ...payload, status: OrderStatus.PENDING });
      expect(created.updatedAt).toBe(created.createdAt);
      expect(response.headers()['location']).toBe(ApiRoutes.orderById(created.id));

      await test.step('Assert: GET /orders/{id} returns the same order', async () => {
        expect(await orderSteps.getOrder(created.id)).toEqual(created);
      });
    },
  );

  for (const invalidCase of invalidCreateOrderCases) {
    test(
      `rejects the order with 400 when ${invalidCase.title}`,
      { tag: ['@negative', '@contract'] },
      async ({ ordersApi }) => {
        const response = await ordersApi.create(invalidCase.build());

        const error = await expectApiError(response, {
          status: HttpStatus.BAD_REQUEST,
          code: ErrorCode.VALIDATION_ERROR,
        });
        expect(error.details?.map((detail) => detail.field)).toContain(invalidCase.invalidField);
      },
    );
  }
});
