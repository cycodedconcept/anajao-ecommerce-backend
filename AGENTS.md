# Anajao backend engineering instructions

## Scope and stack

KAM VOGUE ecommerce backend. Milestones 01–02: Node.js 24 LTS, npm, strict TypeScript, Express, Prisma 7 with MariaDB adapter, XAMPP MariaDB locally, Zod, Pino, Helmet/CORS/rate limiting, Vitest/Supertest, Swagger and GitHub Actions. Milestone 02 identity/access is explicitly authorized. No frontend, Supabase, Firebase or Milestone 03 implementation without a new user request.

## Architecture and conventions

HTTP composition: src/app.ts; process lifecycle: src/server.ts. Feature modules separate routes/controllers/services/repositories/validation as each layer becomes necessary. Persistence belongs in src/database and feature repositories. Identity tables are implemented; do not invent unrelated domain tables or abstract base classes. Use ESM with .js imports, explicit types at boundaries, strict compiler options, ESLint and Prettier. Errors use AppError and the centralized middleware; responses use success/data or success/error conventions.

## Security

Never commit .env, secrets, generated client or node_modules. Validate configuration at startup without echoing values. Use schema-scoped runtime credentials and a separate migration identity. Preserve bounded pools, request sizes, shutdown timeouts, exact-origin CORS and safe proxy defaults. Do not log raw bodies, headers, URLs or database exceptions. Verify Truehost runtime/database/TLS constraints before deployment.

Public registration creates CUSTOMER only; email verification precedes login. Use Argon2id and bearer JWTs plus hashed, rotating refresh tokens. Check session/account state on every protected request; require role and session MFA for privileged operations. Serialize credential/lifecycle changes with the repository's user-row lock; never roll back replay-triggered revocation by throwing inside that transaction. Store only hashes of verification/reset/refresh tokens and encrypt TOTP secrets with the distinct MFA key. Provider delivery and social login fail closed until explicitly configured and verified. Never expose test-delivery tokens over HTTP. Admin bootstrap is an explicit audited operator command, never startup/seed behavior. See docs/identity.md for approved policies, MFA/key recovery and privacy workflow boundaries.

## Tests and completion

Run npm ci, npm run db:generate, npm run typecheck, npm run lint, npm run format:check, npm test, npm run build. Integration tests require a separate TEST_DATABASE_URL ending in _test and npm run test:integration. Run npm run db:migrate:test before integration tests; never point tests at the runtime schema even with different credentials. Run npm run test:smoke for production startup, health/readiness, Swagger, unauthenticated identity and graceful shutdown. Never report unexecuted checks as passed. Record commands/results in docs/milestones. Update OpenAPI and run npm run docs:postman with endpoint changes. Keep the npm test exclusion glob quoted so shell expansion cannot accidentally select integration tests.

## Postman workflow for every milestone

Follow postman/README.md. Maintain the canonical `Anajao Ecommerce API` collection at postman/anajao-ecommerce.postman_collection.json with folders matching implemented domains; preserve historical collections and never invent working endpoints. Keep OpenAPI, examples, auth requirements and executable scenarios synchronized with `npm run docs:postman`. Run `npm run test:api:prepare` and `npm run test:api` on a supported official Postman CLI host, in addition to existing tests. Native CLI incompatibility is a blocker for that local execution, not a pass; use actual Linux CI evidence where available.

Collection runs must use isolated loopback test data, wait for readiness, fail on failed/missing/skipped assertions, verify relevant database side effects and clean up only their own fixtures. Commit only blank secret fields in environment templates. Never retain or upload raw runner reports; publish only allowlisted reports under reports/api-tests/. Each milestone must deliver actual passed/failed/skipped counts, dated sanitized report snapshots, setup instructions, endpoint changes and known manual/provider/cloud limitations. Cloud publishing requires configured access and authorization, and must never be claimed without a successful operation. Never run destructive tests against production or silently change completed behavior.

## Git workflow

main is the baseline/release branch; develop integrates reviewed work. Milestone 02 branch: feature/milestone-02-identity-access. Its Postman workflow follow-up uses feature/postman-api-workflow from merged develop. Future milestone branches start from latest develop. Commit and push the feature branch and open a PR targeting develop. Never force-push, overwrite history or merge automatically. Inspect status/remote before changes; preserve user work. Local assistant tooling and BACKEND_CODEX_PROMPTS.md remain locally excluded and must not be committed.

## Current status and future sessions

Milestones 01 and 02 are merged into develop (PRs #1, #3 and #5; Milestone 02 merge verified 2026-10-22 at develop d80a8a1). The Postman workflow follow-up is on PR #7 targeting develop: Linux CI run 39941438320 verified 95 requests, 354 assertions and 11 database checks on 2026-10-23; native macOS CLI startup remains blocked. See docs/milestones/postman-workflow-summary.md for the API testing workflow and platform/cloud limits. See docs/milestones/milestone-02-summary.md and milestone-02-test-report.md for identity/access implementation, actual verification and deferred provider/deployment work. Milestone completion requires all required local checks executed plus a pushed feature branch and PR or documented specific access blocker. Do not treat a generated workflow as a successful remote CI run. Read these reports before proceeding. Milestone 03 is a prompt only at docs/prompts/milestone-03-catalog-inventory.md; wait for Milestone 02 review and explicit authorization before implementing it.
