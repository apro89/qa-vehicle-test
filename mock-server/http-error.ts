export type ErrorDetail = { field: string; message: string };

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ErrorDetail[],
  ) {
    super(message);
  }

  static badRequest(message: string, details?: ErrorDetail[]) {
    return new HttpError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized() {
    return new HttpError(401, 'UNAUTHORIZED', 'Missing or invalid bearer token');
  }

  static notFound(message: string) {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(code: string, message: string) {
    return new HttpError(409, code, message);
  }
}
