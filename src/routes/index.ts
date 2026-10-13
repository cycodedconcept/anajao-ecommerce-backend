import { Router } from 'express';
import { z } from 'zod';
import { validateQuery } from '../common/middleware/validate.js';
import { healthController } from '../modules/health/health.controller.js';
import type { HealthService } from '../modules/health/health.service.js';
export function apiRoutes(service: HealthService) {
  const router = Router();
  const controller = healthController(service);
  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  router.get(
    '/health',
    validateQuery(z.object({}).strict()),
    controller.health,
  );
  router.get('/ready', validateQuery(z.object({}).strict()), controller.ready);
  return router;
}
