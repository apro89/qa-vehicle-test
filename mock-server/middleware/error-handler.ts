import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../http-error';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(`Route ${req.method} ${req.path} does not exist`));
};

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  const error = toHttpError(err);
  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  });
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) return err;
  // express.json() raises a SyntaxError with `type: 'entity.parse.failed'`.
  if (err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed') {
    return new HttpError(400, 'MALFORMED_JSON', 'Request body is not valid JSON');
  }
  console.error('[mock-server] Unhandled error', err);
  return new HttpError(500, 'INTERNAL_ERROR', 'Unexpected server error');
}
