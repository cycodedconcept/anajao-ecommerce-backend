# Milestone 02: authentication, identity and role-based access

Adds customer registration/verification, login and recovery, rotating refresh sessions with replay revocation, safe profiles, owned addresses, phone verification boundaries, privacy requests, and ADMIN/SELLER gates requiring session MFA. Privileged provisioning is an explicit audited command; public registration always creates CUSTOMER.

The feature branch starts from merged develop at 741e8de. An additive nine-table identity migration uses existing Prisma 7/MariaDB conventions; credential/lifecycle transactions serialize on the user row. One-time tokens are hashed, passwords use Argon2id, TOTP secrets are encrypted, and protected requests recheck database session/account state.

## Verification

Executed: npm ci, db:generate, docs:postman, typecheck, lint, format:check, npm test (35 passing), build, development migration, db:migrate:test, test:integration (22 passing), and production-mode test:smoke. Migration repeats reported no pending changes. Full evidence and resolved failures are in docs/milestones/milestone-02-test-report.md.

## Artifacts and boundaries

OpenAPI, an importable Postman collection/example environment, manual walkthrough, operational guide, updated AGENTS.md, milestone summary/test report and the Milestone 03 catalogue prompt are included. Real email/SMS delivery remains behind adapters per the approved policy; Google/Apple routes fail closed pending verified integration. Privacy requests do not claim completed export/erasure. Truehost/TLS, operational retention and shared rate-limit storage remain deployment gates. No real privileged account, destructive reset, production deployment, automatic merge or Milestone 03 implementation.

## Review checklist

- [ ] Review schema constraints, locking order and migration compatibility.
- [ ] Review refresh replay revocation, password/reset session invalidation and one-time token races.
- [ ] Review role/MFA gates, encrypted factor enrollment and admin-bootstrap preconditions.
- [ ] Review provider defaults, privacy workflow and operational limitations.
- [ ] Confirm the PR's actual CI checks and review the test evidence.
- [ ] Import Postman artifacts and follow docs/identity.md as desired.
- [ ] Merge manually only after approval; authorize Milestone 03 separately.
