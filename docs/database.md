# Database operations and deployment constraints

Local XAMPP reports MariaDB 10.4.28. Prisma uses the MySQL connector with `@prisma/adapter-mariadb`; compatibility is verified by migrations and a real `SELECT 1` through Prisma, not inferred solely from version numbers. See the [official MySQL connector documentation](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/mysql). [Node.js release policy](https://github.com/nodejs/Release) identifies Node.js 24 as LTS for this milestone.

`anajao_ecommerce_dev` and `anajao_ecommerce_test` use utf8mb4. `anajao_app` has SELECT/INSERT/UPDATE/DELETE on development only. `anajao_migrator` has schema-scoped ALL PRIVILEGES for migrations, without global privileges or grant option. `anajao_test` is restricted to the test schema. Credentials are randomly generated into chmod-600 `.env`; they are never committed. Keep `.env` private and rotate credentials if disclosed.

`DATABASE_URL` is runtime-only. `MIGRATION_DATABASE_URL` overrides it for Prisma CLI. Pool size defaults to 5; connect, acquisition and socket timeouts default to 3 seconds. The server begins accepting requests even when the database is unavailable, so liveness remains useful while readiness fails. Graceful shutdown stops accepting requests, drains existing requests, disconnects Prisma, and has a hard deadline.

The version-controlled baseline runs `SELECT 1`; only Prisma's `_prisma_migrations` bookkeeping table is created. No customer/product/order tables or placeholder domain entities exist. Run `npm run db:migrate` to apply committed migrations; `npm run db:generate` generates the ignored client. Use `npm run db:dev -- --name descriptive_name` when adding actual models in later milestones. `migrate dev` needs a separately configured shadow database/account; do not grant global CREATE DATABASE privileges to the runtime account. Add an explicit shadow database URL in Prisma config before using that workflow.

## Reset (destructive; development only)

Check the migration URL points to `anajao_ecommerce_dev`, stop the server, then run `npm run db:reset`. Prisma asks for confirmation and replays migrations. Never reset production. No reset was performed during milestone implementation. For integration migrations, explicitly set `MIGRATION_DATABASE_URL` to the isolated test connection, then `npm run db:migrate`. Tests never reset/drop a database.

## Production gate

Truehost plan details have not been supplied or verified. Before deployment verify Node.js 24 support, persistent process supervision, reverse proxy and port routing, MySQL/MariaDB version, connection quotas, TLS CA/hostname verification, backup/restore procedures, migration access and secret injection. The current adapter configuration is intended for local TCP only; implement and verify provider-specific TLS configuration before any remote production database connection. No deployment is included in this milestone.

XAMPP MariaDB 10.4 is an old local environment; production should use a supported provider version. CI tests MariaDB 10.11 as a separate compatibility target. In-memory rate limiting is per process; introduce a shared store when deploying multiple instances. Configure exact CORS origins and trust-proxy hop count only after verifying the proxy topology. Never set blanket trust proxy. Current logging deliberately excludes URLs, request bodies and raw error objects to avoid credential leakage; operational diagnostics can be extended with sanitized error classifications.
