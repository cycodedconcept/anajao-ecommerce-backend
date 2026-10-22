import { z } from 'zod';
const databaseUrl = z
  .string()
  .url()
  .refine((value) => {
    if (!URL.canParse(value)) return false;
    const url = new URL(value);
    return (
      url.protocol === 'mysql:' && !!url.hostname && url.pathname.length > 1
    );
  }, 'Expected a MySQL database URL');
const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: databaseUrl,
  AUTH_SIGNING_KEY: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  MFA_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  AUTH_ISSUER: z.string().min(1).max(100).default('anajao'),
  AUTH_AUDIENCE: z.string().min(1).max(100).default('anajao-api'),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(10),
  DB_POOL_SIZE: z.coerce.number().int().min(1).max(50).default(5),
  DB_CONNECT_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(30000)
    .default(3000),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z
          .string()
          .url()
          .refine((v) => {
            if (!URL.canParse(v)) return false;
            const u = new URL(v);
            return ['http:', 'https:'].includes(u.protocol) && u.origin === v;
          }),
      ),
    ),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SHUTDOWN_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(100)
    .max(60000)
    .default(10000),
});
export type Config = z.infer<typeof schema>;
export function parseEnv(env: NodeJS.ProcessEnv): Config {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid environment configuration: ${[...new Set(result.error.issues.map((issue) => issue.path.join('.')))].join(', ')}`,
    );
  return result.data;
}
