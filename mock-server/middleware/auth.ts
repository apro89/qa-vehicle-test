import type { RequestHandler } from 'express';
import { HttpError } from '../http-error';

/** Rejects any request without the expected bearer token with 401. */
export const bearerAuth =
  (expectedToken: string): RequestHandler =>
  (req, _res, next) => {
    if (req.header('authorization') !== `Bearer ${expectedToken}`) {
      next(HttpError.unauthorized());
      return;
    }
    next();
  };
