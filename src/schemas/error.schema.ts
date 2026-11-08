import { z } from 'zod';

export const ErrorCodeSchema = z.enum([
  'VALIDATION_ERROR',
  'MALFORMED_JSON',
  'UNAUTHORIZED',
  'NOT_FOUND',
  'INVALID_STATUS_TRANSITION',
  'ORDER_LOCKED',
]);
export const ErrorCode = ErrorCodeSchema.enum;

export const ApiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    details: z
      .array(z.strictObject({ field: z.string().min(1), message: z.string().min(1) }))
      .optional(),
  }),
});

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
