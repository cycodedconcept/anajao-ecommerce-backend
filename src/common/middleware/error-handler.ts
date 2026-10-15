import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { AppError } from '../errors/app-error.js';
export const errorHandler =
  (logger: Logger): ErrorRequestHandler =>
  (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const malformed =
      error instanceof SyntaxError && 'status' in error && error.status === 400;
    const tooLarge =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      error.status === 413;
    const known =
      error instanceof AppError
        ? error
        : malformed
          ? new AppError(400, 'INVALID_JSON', 'Invalid JSON body')
          : tooLarge
            ? new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body too large')
            : undefined;
    if (!known)
      logger.error({ event: 'unhandled_request_error' }, 'Request failed');
    res.status(known?.status ?? 500).json({
      success: false,
      error: {
        code: known?.code ?? 'INTERNAL_ERROR',
        message: known?.message ?? 'An unexpected error occurred',
      },
    });
  };
