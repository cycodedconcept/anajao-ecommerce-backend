import type { RequestHandler } from 'express';
import type { z } from 'zod';
import { AppError } from '../errors/app-error.js';
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    next(
      result.success
        ? undefined
        : new AppError(400, 'VALIDATION_ERROR', 'Invalid query parameters'),
    );
  };
}
