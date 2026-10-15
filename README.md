# KAM VOGUE — Anajao Ecommerce Backend

Milestone 01 provides backend infrastructure only: Express, strict TypeScript, Prisma/MariaDB, Zod, Pino, Helmet, CORS, rate limiting, Vitest/Supertest, Swagger and GitHub Actions.

## Local setup

Install Node.js 24 LTS (`nvm install && nvm use`), npm, and XAMPP. Open `/Applications/XAMPP/manager-osx.app`, select Manage Servers → MySQL Database → Start. XAMPP calls its MariaDB service “MySQL”. Use TCP `127.0.0.1:3306`; the bundled client's default socket may differ from the running server.

```sh
npm ci
python3 scripts/provision-local.py
npm run db:generate
npm run db:migrate
npm run dev
```

Provisioning is a one-time macOS XAMPP convenience requiring local root access; it creates only the named dev/test schemas and dedicated users. It refuses to overwrite `.env` or existing users. If already provisioned, skip it. For other environments, copy `.env.example` to `.env` and have an administrator create equivalent schema-scoped accounts. Never use the database root account in application configuration. The provisioning helper assumes local root without a password; use an interactive `mysql -u root -p` administrative session for a password-protected installation. Never pass passwords as command-line arguments.

Application: http://127.0.0.1:3000/api/v1/health ; readiness: http://127.0.0.1:3000/api/v1/ready ; Swagger: http://127.0.0.1:3000/api-docs ; specification: `/api-docs/openapi.json`.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run test:integration
npm start
```

Integration tests require a separate `TEST_DATABASE_URL` whose database name ends in `_test`. Apply its migration with `MIGRATION_DATABASE_URL` set to that test connection, never the development/production connection. CI provisions an isolated MariaDB service and migrates it before tests.

## Architecture

`src/app.ts` is a side-effect-free injectable Express factory. `src/server.ts` owns listening and bounded SIGINT/SIGTERM shutdown. `config/` validates environment variables and creates logging; `common/` supplies errors and validation; `routes/` mounts `/api/v1`; `modules/health/` separates controllers from services; `database/` owns the Prisma adapter and pool; `docs/` contains OpenAPI. Health uses the database interface directly; a domain repository would add no value until domain entities exist. Future modules should add repositories for persistence and Zod schemas at HTTP boundaries, without controllers calling Prisma directly.

Liveness does not query the database; readiness returns 503 if the database is unreachable or shutdown has started. Responses use `{success:true,data}` or `{success:false,error:{code,message}}`. Unknown health query parameters return 400. No public endpoint exposes connection strings, database versions or internal errors.

See [database operations](docs/database.md), [milestone report](docs/milestones/milestone-01-summary.md), [execution evidence](docs/milestones/milestone-01-test-report.md) and [Milestone 2 prompt](docs/prompts/milestone-02-authentication.md).
