import type { RequestHandler } from 'express';
import type { HealthService } from './health.service.js';
export function healthController(service: HealthService): {
  health: RequestHandler;
  ready: RequestHandler;
} {
  return {
    health: (_req, res) => {
      res.json({ success: true, data: service.health() });
    },
    ready: async (_req, res) => {
      const ready = await service.ready();
      res.status(ready ? 200 : 503).json(
        ready
          ? { success: true, data: { status: 'ready' } }
          : {
              success: false,
              error: {
                code: 'NOT_READY',
                message: 'Service temporarily unavailable',
              },
            },
      );
    },
  };
}
