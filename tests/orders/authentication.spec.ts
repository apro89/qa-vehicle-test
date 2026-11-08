import { test } from '@/fixtures';
import { HttpStatus } from '@/constants/http-status';
import { unauthenticatedCallers } from '@/data/unauthenticated-callers';
import { expectApiError } from '@/helpers/response.helpers';
import { ErrorCode } from '@/schemas/error.schema';

test.describe('Authentication', () => {
  for (const caller of unauthenticatedCallers) {
    test(
      `returns 401 for an existing order when ${caller.title}`,
      { tag: ['@security', '@negative'] },
      async ({ orderSteps, ordersApiFactory }) => {
        const order = await orderSteps.createOrder();
        const unauthenticatedApi = await ordersApiFactory(caller.token());

        const response = await unauthenticatedApi.getById(order.id);

        // 401, not 404: the API must not reveal whether the order exists.
        await expectApiError(response, {
          status: HttpStatus.UNAUTHORIZED,
          code: ErrorCode.UNAUTHORIZED,
        });
      },
    );
  }
});
