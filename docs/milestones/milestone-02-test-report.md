# Milestone 02 test execution report

Executed 2026-10-20 on macOS, using Node.js v24.21.0 selected with `export PATH="$PWD/node_modules/node/bin:$PATH"`, Prisma 7.10.0 and the existing local XAMPP MariaDB service. Only the isolated `anajao_ecommerce_test` schema held test fixtures. No production database, real delivery provider or real privileged account was used.

## Executed acceptance checks

| Command                    | Actual result                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `node --version`           | PASS: v24.21.0                                                                                  |
| `npm ci`                   | PASS: 418 packages installed; 419 audited; 0 reported vulnerabilities                           |
| `npm run db:generate`      | PASS: Prisma Client 7.10.0 generated                                                            |
| `npm run docs:postman`     | PASS: collection and example environment generated                                              |
| `npm run typecheck`        | PASS: strict compiler check, including TypeScript scripts                                       |
| `npm run lint`             | PASS                                                                                            |
| `npm run format:check`     | PASS after formatting the new milestone summary                                                 |
| `npm test`                 | PASS: 35 tests across 3 files, 3.32 seconds in final execution                                  |
| `npm run build`            | PASS: production TypeScript build                                                               |
| `npm run db:migrate`       | PASS: identity migration applied to development; repeat reported no pending migrations          |
| `npm run db:migrate:test`  | PASS: identity migration applied to isolated test schema; repeat reported no pending migrations |
| `npm run test:integration` | PASS: 22 tests across 2 files, 8.47 seconds in final execution                                  |
| `npm run test:smoke`       | PASS: production-mode compiled startup, HTTP probes and graceful SIGTERM exit                   |

Total: **57 passing automated tests**, plus the production-process smoke checks. Results above were actually executed. Clean installation, local HTTP listeners, TypeScript runner IPC and MariaDB access required approved execution outside the sandbox. No database reset ran.

`npm audit --audit-level=moderate` also passed with `found 0 vulnerabilities`; `git diff --check` passed. A tracked-file check confirmed `.env`, generated client, node_modules, local assistant tooling, skills-lock.json and the private prompt library are not tracked.

## Coverage

The 18 foundation unit/API tests remain passing. Identity unit tests verify Argon2id parameters and password rejection, opaque tokens/hash storage, distinct key requirements, absent-user password handling, JWT tampering/expiry/issuer/audience/algorithm/required claims, encrypted user-bound TOTP secrets and replay rejection, delivery configuration failure, normalized email, privilege injection rejection, input bounds and pagination.

Two contract tests validate the OpenAPI 3 document with Swagger Parser and structurally verify all identity operations, request/response examples and assertions in the Postman v2.1 collection. Example environment token fields are blank. This is automated artifact validation, not a claim that the Postman desktop GUI was opened.

The two existing database foundation tests remain passing. Twenty identity integration cases exercise real MariaDB and Express:

- Registration requires verification; case-normalized duplicates and unknown-account recovery have generic responses; only hashes persist.
- Invalid/expired and concurrently reused email challenges are rejected; only one concurrent consume succeeds.
- Safe account DTOs, bearer-only transport, missing/tampered tokens, profile update, public role injection and customer-to-admin/seller denial.
- Refresh rotation, replay audit and committed family revocation; concurrent rotation yields one success and one rejection, and replay invalidates the winner.
- Expired/unknown refresh tokens; per-session logout and logout-all.
- Concurrent password reset, one-time/expired/superseded reset tokens, password change reauthentication and session revocation.
- Cross-account address update/delete denial, bounded lists and successful owner changes.
- Phone challenges bound to the authenticated account and accepted only once.
- Idempotent pending export requests; deletion requests suspend login, access and refresh.
- Encrypted TOTP enrollment, MFA login/replay defense, revoked enrollment sessions, privileged gate enforcement and audited admin-bootstrap preconditions.
- Per-IP throttling and normalized-account throttling across different IPs behind explicitly configured proxy trust.
- Unconfigured delivery/social failure, sanitized provider send failure and generic registration responses.
- Concurrent registration enforces unique email; invalid address ownership violates the real foreign key.
- Expired MFA enrollment and expired sessions are rejected.

Test fixtures use unique run prefixes; cleanup targets those users and associated records rather than dropping or clearing database tables. Generic login-rejection audit rows have no PII and may remain in the isolated test database.

## Startup evidence

The smoke child ran with NODE_ENV=production and ephemeral keys against the local development database:

```text
/api/v1/health: 200
/api/v1/ready: 200
/api-docs/: 200
/api-docs/openapi.json: 200
/missing: 404
/api/v1/me: 401
/api/v1/admin/access: 401
Production build startup and SIGTERM shutdown: PASS
```

## Failures encountered and resolved

- The inherited unquoted npm unit-test exclusion glob expanded when a second integration file was introduced, accidentally selecting an integration file. Quoting the glob restored separation; final npm test ran all three unit/API/contract files and no integration files.
- Initial MFA confirmation failed because the TOTP library rejects negative afterTimeStep values. Fresh factors now omit that option until a valid time step has been consumed; unit and full integration tests passed afterward.
- The initial Argon2 assertion assumed a particular parameter serialization order. It now checks the actual algorithm and sorted parameter values rather than serialization order.
- Fixed a missing Node URL import flagged by ESLint and a syntax error in the new API contract during development.
- The first formatting invocation included `.env.example`, which has no Prettier parser; the normal project formatting/check commands succeeded. The final clean-install sequence paused at a newly written unformatted summary; that document was formatted and all remaining checks rerun successfully.
- The TypeScript CLI runner needed a local IPC socket blocked by the sandbox; approved execution succeeded. No workaround bypassed permission controls.

## Verification boundaries

Real email/SMS delivery and Google/Apple login are intentionally unconfigured. Their failure gates and injected test delivery are verified; live provider success is not claimed. No real admin account was provisioned. Privacy fulfillment/erasure, MFA recovery operations, production key rotation, shared rate-limit storage and retention cleanup were not executed. No Truehost deployment/database-TLS verification, browser visual inspection or Postman GUI import occurred. Milestone 03 is a prompt only.

Remote CI is separate from local verification; publication and observed remote evidence are recorded after PR creation. A generated workflow is not treated as a successful CI execution.
