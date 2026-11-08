import type { APIResponse } from '@playwright/test';
import type { z } from 'zod';
import { expect } from '@/fixtures/matchers';
import { ApiErrorSchema, type ApiError, type ErrorCode } from '@/schemas/error.schema';

/** Asserts the body honours the contract and returns it fully typed. */
export async function parseBody<S extends z.ZodType>(
  response: APIResponse,
  schema: S,
): Promise<z.output<S>> {
  const body: unknown = await response.json();
  expect(body).toMatchSchema(schema);
  return schema.parse(body);
}

/** One-line assertion for the standard error envelope: status + contract + code. */
export async function expectApiError(
  response: APIResponse,
  expected: { status: number; code: ErrorCode },
): Promise<ApiError['error']> {
  await expect(response).toHaveStatus(expected.status);
  const { error } = await parseBody(response, ApiErrorSchema);
  expect(error.code).toBe(expected.code);
  return error;
}
