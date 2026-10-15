import { pino } from 'pino';
export const createLogger = (level: string) =>
  pino({
    level,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'res.headers["set-cookie"]',
        'password',
        'DATABASE_URL',
      ],
      censor: '[REDACTED]',
    },
  });
