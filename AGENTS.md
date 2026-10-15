# Anajao backend engineering instructions

## Scope and stack

KAM VOGUE ecommerce backend. Milestone 01 only: Node.js 24 LTS, npm, strict TypeScript, Express, Prisma 7 with MariaDB adapter, XAMPP MariaDB locally, Zod, Pino, Helmet/CORS/rate limiting, Vitest/Supertest, Swagger and GitHub Actions. No frontend, Supabase, Firebase or Milestone 2 implementation without a new user request.

## Architecture and conventions

HTTP composition: src/app.ts; process lifecycle: src/server.ts. Feature modules separate routes/controllers/services/repositories/validation as each layer becomes necessary. Persistence belongs in src/database and future repositories. Do not invent domain tables or abstract base classes. Use ESM with .js imports, explicit types at boundaries, strict compiler options, ESLint and Prettier. Errors use AppError and the centralized middleware; responses use success/data or success/error conventions.

## Security

Never commit .env, secrets, generated client or node_modules. Validate configuration at startup without echoing values. Use schema-scoped runtime credentials and a separate migration identity. Preserve bounded pools, request sizes, shutdown timeouts, exact-origin CORS and safe proxy defaults. Do not log raw bodies, headers, URLs or database exceptions. Verify Truehost runtime/database/TLS constraints before deployment.

## Tests and completion

Run npm ci, npm run db:generate, npm run typecheck, npm run lint, npm run format:check, npm test, npm run build. Integration tests require a separate TEST_DATABASE_URL ending in _test and npm run test:integration. Migrate the isolated test schema before running tests. Never report unexecuted checks as passed. Verify actual startup, migrations, health/readiness and Swagger; record commands/results in docs/milestones. Update Postman and OpenAPI with endpoint changes.

## Git workflow

main is the baseline/release branch; develop integrates reviewed work. Milestone 01 branch: feature/milestone-01-backend-foundation, based on develop. Commit and push the feature branch and open a PR targeting develop. Never force-push, overwrite history or merge automatically. Inspect status/remote before changes; preserve user work.

## Current status and future sessions

See docs/milestones/milestone-01-summary.md and milestone-01-test-report.md for verified status and blockers. Milestone completion requires all required local checks executed plus a pushed feature branch and PR or documented specific access blocker. Do not treat a generated workflow as a successful remote CI run. Read these reports before proceeding. Milestone 2 is a prompt only at docs/prompts/milestone-02-authentication.md; wait for review and explicit authorization before implementing it.
