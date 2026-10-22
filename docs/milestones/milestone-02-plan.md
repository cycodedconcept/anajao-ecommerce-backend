# Milestone 02 implementation plan

Base verified 2026-10-20: PR #1 and PR #3 merged into develop; branch feature/milestone-02-identity-access created from 741e8de. User approved customer-only registration, verified email before login, bearer access tokens with rotating refresh sessions, test delivery adapters pending provider selection, audited CLI admin bootstrap and mandatory privileged MFA.

1. Add identity schema and additive migration; fixed CUSTOMER/ADMIN/SELLER roles, profiles, addresses, sessions, hashed challenges, encrypted MFA and privacy/audit records.
2. Implement layered identity API, Argon2id, strict signed-token verification, transactional rotation/replay handling, ownership, account/IP throttling and MFA.
3. Implement account lifecycle and provider boundaries. Social login remains explicitly disabled without verified Google/Apple configuration; no external delivery or real privileged account creation is claimed.
4. Exercise unit/API and isolated MariaDB integration tests including concurrent token consumption and lifecycle revocation; run all foundation checks and smoke tests.
5. Publish OpenAPI, Postman collection/environment and walkthrough, reports, updated AGENTS.md and Milestone 03 prompt; incremental commits, push and PR to develop, no automatic merge.

PRD mapping uses the supplied prompt identifiers (the full PRD is not in the repository): FR-02-01–06 identity/customer lifecycle; FR-08-01–03 access/security; FR-07-01 privileged identity. Detailed acceptance coverage will be recorded in the summary. Orders/history/reorder deferred to Milestone 04 because no order data exists.
