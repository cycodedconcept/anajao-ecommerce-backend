# Postman workflow execution evidence

Local baseline: 2026-10-22. Follow-up verification: 2026-10-23. Base: merged Milestone 02 on develop d80a8a1. This follow-up changes test tooling, generated artifacts and documentation; it adds no API endpoints or migrations.

## Executed local checks

Node.js 24.21.0 was selected through the existing project-local binary. The final clean installation added 419 packages and audited 420 packages, reporting zero vulnerabilities.

| Command                          | Actual result                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| npm ci                           | PASS                                                                                                     |
| npm run db:generate              | PASS, Prisma 7.10.0                                                                                      |
| npm run docs:postman             | PASS, canonical collection/environment generated                                                         |
| npm run typecheck                | PASS                                                                                                     |
| npm run lint                     | PASS                                                                                                     |
| npm run format:check             | PASS                                                                                                     |
| npm test                         | PASS: 45 tests in 4 files                                                                                |
| npm run build                    | PASS                                                                                                     |
| npm run db:migrate:test          | PASS: isolated test schema, no pending migrations                                                        |
| npm run test:integration         | PASS: 22 tests in 2 files                                                                                |
| npm run test:smoke               | PASS: production-mode startup, health/readiness, Swagger, unauthenticated identity and graceful shutdown |
| npm audit --audit-level=moderate | PASS: 0 reported vulnerabilities                                                                         |
| npm run test:api (native macOS)  | BLOCKED: official CLI cannot start; 0 passed, 0 executed failures, 94 unexecuted requests                |

The collection startup attempt exited nonzero and did not prepare database fixtures. Its sanitized reports are reports/api-tests/2026-10-22-macos-blocked.json and .md. This is not a collection pass. Local Vitest results are separate from actual CLI collection execution.

## Validation coverage

The ten new workflow tests check official Postman v2.1 schema acceptance/rejection, generator synchronization, blank secret fields, coverage of every documented operation, production/remote/non-test/same-schema refusal, distinct local test acceptance and report sanitization/missing-request behavior. Existing OpenAPI and identity contract tests remain passing. The final collection contains 95 scenarios, including an explicit already-enabled MFA conflict (409), and eleven database side-effect checks. The historical Mac startup report predates the added conflict scenario and correctly retains its original 94 unexecuted requests.

## Issues found and resolved

The official Postman CLI 1.75.0 binary aborts on macOS 12.7.6 because its system C++ runtime lacks __libcpp_verbose_abort. No operating-system modification or unsafe compatibility workaround was attempted. A Newman fallback was evaluated, found to add 19 dependency advisories including high/critical issues, and removed. The final dependency audit is clean.

JSON-schema validators required their explicit CommonJS default exports under the repository's NodeNext compiler settings; imports were corrected and typecheck/tests passed. CLI reports are projected into a strict allowlist, and missing executions cannot produce a successful aggregate. No raw errors, bodies, tokens or environment values are saved in published reports.

## Remote collection execution

[Linux CI run 39941438320](https://github.com/cycodedconcept/anajao-ecommerce-backend/actions/runs/39941438320) passed on commit eb74098. Actual official Postman CLI 1.75.0 execution: **95 requests passed, 0 failed, 0 unexecuted; 354 assertions passed, 0 failed, 0 skipped; 11 database checks passed; fixture cleanup passed**. The CI job also passed installation, client generation, typecheck, lint, formatting, 45 unit/API/contract tests, build, isolated migrations, 22 integration tests and production startup smoke checks.

Initial CI attempts failed before collection execution because the runner used an unsupported folder flag. The official CLI uses `-i`. The reporter now explicitly selects Newman-compatible JSON and omits bodies/headers; published reports still use a strict allowlist. Those failed attempts were not reported as passes. Safe diagnostic categories identify CLI startup failures without emitting raw output.

Follow-up local checks on 2026-10-23 passed generation, typecheck, lint, formatting and all 45 tests. A sandboxed test attempt failed to bind loopback HTTP sockets (11 failures); the authorized rerun outside that restriction passed all 45. Collection generation now preserves repository formatting, and report validation requires every named status/schema/envelope/error/business assertion rather than accepting an assertion count alone.

The final sanitized snapshots are [JSON](../../reports/api-tests/2026-10-23-linux-ci.json) and [Markdown](../../reports/api-tests/2026-10-23-linux-ci.md). [PR #7](https://github.com/cycodedconcept/anajao-ecommerce-backend/pull/7) targets develop; no merge is authorized or performed.

## Manual and external boundaries

No Postman cloud workspace/key or publishing permission is configured; no cloud documentation was updated. Live email/SMS and Google/Apple success remain unconfigured, while their existing API contracts and failure gates are preserved. Reference/manual examples are not claimed executed. Native Mac collection execution remains blocked until a compatible CLI/OS is available. The production application behavior, schema and endpoints are unchanged. No Milestone 03 work or automatic merge occurred.
