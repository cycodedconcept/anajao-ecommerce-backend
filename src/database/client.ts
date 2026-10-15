import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Config } from '../config/env.js';
export interface Database {
  ping(): Promise<void>;
  disconnect(): Promise<void>;
}
export function createDatabase(config: Config): Database {
  const url = new URL(config.DATABASE_URL);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    connectionLimit: config.DB_POOL_SIZE,
    connectTimeout: config.DB_CONNECT_TIMEOUT_MS,
    acquireTimeout: config.DB_CONNECT_TIMEOUT_MS,
    socketTimeout: config.DB_CONNECT_TIMEOUT_MS,
  });
  const client = new PrismaClient({ adapter });
  return {
    async ping() {
      await client.$queryRaw`SELECT 1`;
    },
    async disconnect() {
      await client.$disconnect();
    },
  };
}
