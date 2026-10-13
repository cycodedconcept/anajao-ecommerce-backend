# Milestone 01 test execution report

Executed 2026-10-13 on macOS against XAMPP MariaDB 10.4.28. Runtime: Node.js v24.21.0 (project-local executable selected with `export PATH="$PWD/node_modules/node/bin:$PATH"`). Prisma 7.10.0, Vitest 5.0.4. No production database used.

| Command / check                          | Actual result                                                    |
| ---------------------------------------- | ---------------------------------------------------------------- |
| `npm run db:generate`                    | PASS; Prisma client generated in src/generated/prisma            |
| `npm run typecheck`                      | PASS; exit 0                                                     |
| `npm run lint`                           | PASS; exit 0                                                     |
| `npm run format:check`                   | PASS; all matched files use Prettier style                       |
| `npm test`                               | PASS; 1 file, 18 tests, 2.16s                                    |
| `npm run build`                          | PASS; exit 0                                                     |
| `npm run db:migrate` (development)       | PASS; baseline applied; subsequent run: no pending migrations    |
| `npm run db:migrate` (isolated test URL) | PASS; baseline applied                                           |
| `npm run test:integration`               | PASS; 1 file, 2 tests, 2.35s                                     |
| `npm run test:smoke`                     | PASS; compiled server startup, HTTP responses and SIGTERM exit 0 |
| Patched dependency installation audit    | PASS; 0 reported vulnerabilities                                 |
| `git diff --check`                       | PASS                                                             |

## Case coverage

Unit/API suite: side-effect-free application construction; health success and security/request headers; readiness success; sanitized database failure; shutdown readiness rejection; unknown routes; query validation; malformed JSON; sanitized unexpected errors; allowed/disallowed CORS origins; rate limiting; Swagger UI/OpenAPI; five invalid environment cases; safe environment defaults.

Integration suite: Prisma SELECT 1 against `anajao_ecommerce_test` with real HTTP readiness success; an unreachable database port produces 503. Database name isolation is checked before tests run. Development credentials are not used for integration probes.

Production smoke output:

```text
/api/v1/health: 200
/api/v1/ready: 200
/api-docs/: 200
/api-docs/openapi.json: 200
/missing: 404
Production build startup and SIGTERM shutdown: PASS
```

Migration evidence:

```text
Applying migration `20261013000000_foundation`
All migrations have been successfully applied.
```

The same baseline was successfully applied to both named schemas. Only Prisma migration metadata is created; no domain tables.

## Failures encountered and resolved

Initial sandbox execution prohibited HTTP listeners (`listen EPERM`); rerun with approved local network access passed. Two malformed-URL environment cases initially threw `Invalid URL` from refinements; URL.canParse guards fixed the issue and all five invalid configuration cases now pass without exposing values. Initial npm audit found six affected package entries; patched overrides resolved the findings, with generation/migration/tests repeated successfully. Initial socket and sandbox GitHub authentication checks were misleading; TCP XAMPP access and authenticated GitHub access work outside the sandbox.

## Verification boundaries

No destructive database reset was executed. No Truehost deployment or provider TLS test, browser visual inspection, Postman GUI import or Milestone 2 tests were performed. Remote CI and final clean-install evidence are appended when available; these are not claimed based on workflow creation alone.

## Clean installation

`npm ci` completed successfully: added 391 packages, audited 392 packages. `npm audit --audit-level=moderate` then exited 0 with `found 0 vulnerabilities`. The lockfile is reproducible locally.

## Publication

Implementation `0aa04b6` is pushed on `feature/milestone-01-backend-foundation`. [PR #1](https://github.com/cycodedconcept/anajao-ecommerce-backend/pull/1) targets develop. Consult the PR checks for the latest remote CI result; all local results above were executed successfully.
