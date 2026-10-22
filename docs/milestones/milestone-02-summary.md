# Milestone 02 — Authentication, identity and access

Date: 2026-10-20. Project: KAM VOGUE / Anajao Ecommerce. Branch: `feature/milestone-02-identity-access`.

## Scope and base verification

GitHub confirmed PR #1 (foundation) and PR #3 (handoff) merged into develop. The feature branch was created from the fetched develop commit `741e8de`, with the foundation startup change verified as an ancestor. No existing user work was discarded; local assistant tooling and the prompt library remain excluded from Git.

The owner approved customer-only registration, email verification before login, bearer tokens with rotating refresh sessions, test delivery adapters pending provider selection, audited admin bootstrap and mandatory MFA for privileged access. No Milestone 03 or frontend work is included.

## Implemented behavior and requirement mapping

The prompt library supplies FR-02-01–06, FR-08-01–03 and FR-07-01. The full PRD is not present; the mapping below identifies coverage of the supplied milestone scope, not an invented interpretation of each missing sub-requirement.

| Requirement group                        | Delivered behavior                                                                                                                                                                                                                          | Boundary                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| FR-02-01–06: identity/customer lifecycle | Registration, email verification/resend, login, refresh, logout/all, forgot/reset/change password, profile, verified-phone challenge, saved addresses, privacy requests                                                                     | Real email/SMS adapter selection and verification are pending by agreement. Order history/reorder waits for Milestone 04. |
| FR-08-01–03: identity security/access    | Argon2id, signed and strictly validated JWTs, database revocation checks, hashed one-time tokens, transactional rotation/replay handling, account/IP throttles, ownership/role checks, encrypted TOTP and replay defense, safe audit events | Shared rate-limit storage, operational retention, provider TLS and production deployment remain separate gates.           |
| FR-07-01: privileged identity            | ADMIN/SELLER authorization checks with session MFA; explicit audited admin-bootstrap procedure                                                                                                                                              | No automatic privileged accounts, seller onboarding, or unrelated admin business modules.                                 |
| Conditional social identity              | Google/Apple endpoints explicitly fail closed with 503                                                                                                                                                                                      | Real provider verification, OIDC flows and linking are not implemented without verified configuration.                    |

Identity operations use thin controllers, Zod validation, a service layer and a Prisma repository. Every credential/lifecycle transaction locks the parent user row first. A replayed refresh token commits session revocation before returning 401. Password reset/change, logout-all, MFA enrollment and deletion requests revoke sessions. Authentication rechecks current account status, role and session state rather than trusting embedded role claims.

Privacy DELETE requests suspend access immediately; export/deletion fulfillment remains an operator workflow requiring retention and identity verification, not an assertion that data has already been erased. No real admin account was created and no real customer data was deleted.

## Schema and migration

`prisma/migrations/20261020000000_identity_access/migration.sql` is additive and creates User, CustomerProfile, Session, RefreshToken, VerificationChallenge, Address, MfaFactor, PrivacyRequest and AuditEvent. Fixed CUSTOMER/ADMIN/SELLER roles avoid an unnecessary dynamic permission engine for this scope. User email and token hashes have unique constraints; user/expiry/list indexes and foreign keys are explicit. Application timestamps use UTC and DATETIME(3). User-owned data cascades on physical deletion; audit user references become null.

The migration was applied to the existing local development and isolated test schemas. No reset, drop or destructive schema rewrite ran. Runtime credentials remain DML-only; the test migration helper validates schema separation even when connection credentials differ.

## Changed areas and artifacts

- `src/modules/identity/`: validation, controllers/routes, services, transactional repository, bearer authentication, rate limits, cryptography and delivery interfaces.
- `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/database/client.ts`: dependency injection, required server keys and shared Prisma client.
- `src/scripts/bootstrap-admin.ts`: explicit operator-only promotion with preconditions, session revocation and audit event.
- `src/docs/identity-contracts.ts`, `src/docs/openapi.ts`, `scripts/generate-postman.ts`: documented request/response contracts and reproducible examples.
- `tests/identity.test.ts`, `tests/contracts.test.ts`, `tests/integration/identity.test.ts`: security, contracts, lifecycle and concurrency verification; existing foundation tests retained.
- `scripts/migrate-test.mjs`, `scripts/smoke.mjs`, `.github/workflows/ci.yml`: isolated migrations, production-mode smoke, and PR verification.
- `postman/anajao-milestone-02.postman_collection.json` and `postman/anajao-milestone-02.postman_environment.json`: importable v2.1 collection, example environment, success/error examples and assertions.
- `docs/identity.md`: policies, setup, provider boundaries, recovery/key rotation, retention and Postman walkthrough.
- `AGENTS.md`, README and database guide: current scope and commands.
- `docs/prompts/milestone-03-catalog-inventory.md`: next milestone prompt only; requires review and explicit authorization.

## Verification and acceptance

Required local acceptance checks passed: 35 unit/API/contract tests, 22 database integration tests, clean install/generation, typecheck, lint, formatting, build, migrations, production-mode startup smoke and dependency audit. The implementation is ready for review within the approved provider boundaries; merge and production readiness are not claimed.

See [test execution report](milestone-02-test-report.md) for actual commands and outcomes. Local tests exercise real MariaDB with test-only fixtures and injected delivery, not live provider delivery. API documentation and startup were checked over HTTP; no Postman GUI import or browser visual verification is claimed. Production compatibility and deployment remain unverified.

## Operational risks and reviewer actions

Review the additive migration and locking order, refresh replay behavior, MFA/session gates, admin bootstrap and privacy semantics. Real delivery and social login remain disabled; no credentials or external service claims are fabricated. Rate limiting is per process. Retention cleanup, manual privacy fulfillment, MFA recovery and encryption-key rotation require operational procedures before production. Truehost runtime/database/TLS constraints remain unverified.

New local signing/encryption keys were generated privately in ignored `.env` without printing values; tests and smoke use ephemeral keys. Never commit `.env` or exported Postman environments with real tokens. Review/merge the PR manually before authorizing Milestone 03.

## Published review artifact

Implementation commit `10a0840` and verification/handoff commit `734b0d7` are pushed on `feature/milestone-02-identity-access`. [PR #5](https://github.com/cycodedconcept/anajao-ecommerce-backend/pull/5) targets develop and remains open/unmerged. GitHub Backend CI passed for `734b0d7`, observed directly on 2026-10-20: [execution evidence](https://github.com/cycodedconcept/anajao-ecommerce-backend/actions/runs/39452486694). This publication note is a documentation-only follow-up. Milestone 03 awaits the owner's review and explicit authorization.
