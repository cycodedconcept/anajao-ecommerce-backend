import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { randomUUID } from 'node:crypto';
import type { Logger } from 'pino';
import type { Config } from './config/env.js';
import type { Database } from './database/client.js';
import { HealthService } from './modules/health/health.service.js';
import { apiRoutes } from './routes/index.js';
import { errorHandler } from './common/middleware/error-handler.js';
import { AppError } from './common/errors/app-error.js';
import { openapi } from './docs/openapi.js';
import type { IdentityService } from './modules/identity/identity.service.js';
import { identityRoutes } from './modules/identity/identity.routes.js';
export function createApp(
  config: Config,
  database: Database,
  logger: Logger,
  isShuttingDown = () => false,
  identity?: IdentityService,
) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.use(
    pinoHttp({
      logger,
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, !!origin && config.CORS_ORIGINS.includes(origin)),
      credentials: false,
    }),
  );
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: config.RATE_LIMIT_MAX,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      },
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.use('/api/v1', apiRoutes(new HealthService(database, isShuttingDown)));
  if (identity) app.use('/api/v1', identityRoutes(identity, config));
  app.get('/api-docs/openapi.json', (_req, res) => {
    res.json(openapi);
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use((_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'Route not found')),
  );
  app.use(errorHandler(logger));
  return app;
}
