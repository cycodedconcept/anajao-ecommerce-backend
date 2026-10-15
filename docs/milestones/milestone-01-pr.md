# Milestone 01: establish the KAM VOGUE backend foundation

## Overview

Establishes the empty backend repository as a strict TypeScript/Express service backed by Prisma and MariaDB, with reproducible development setup and pull-request verification. Liveness remains available during database outages; readiness returns a sanitized 503.

## Implementation

- Separate app composition, process lifecycle, feature controllers/services and database access.
- Add validated configuration, structured safe logging, centralized JSON errors, security headers, exact-origin CORS, request limits and bounded shutdown.
- Expose `/api/v1/health`, `/api/v1/ready`, `/api-docs` and OpenAPI JSON.
- Add isolated database integration tests and GitHub Actions, Postman collection, architecture/operations guides, AGENTS.md and Milestone 02 implementation prompt.

## Testing evidence

Local Node.js 24.21.0 / XAMPP MariaDB 10.4.28: 18 unit/API tests and 2 real database integration tests passed. Generation, typecheck, lint, format check and build passed. Compiled server returned 200 for health/readiness/Swagger/OpenAPI and 404 for an unknown route; SIGTERM exited cleanly. Baseline migrations applied successfully to both development and test schemas. Patched dependencies report zero audit vulnerabilities. Full evidence: `docs/milestones/milestone-01-test-report.md`.

## Database changes

No business tables. Baseline migration executes SELECT 1 and Prisma records migration metadata. Development/test databases and schema-scoped accounts are provisioned locally by a documented explicit helper. Runtime DML privileges are separated from migration DDL privileges; no credentials committed.

## Security and limitations

Sensitive URLs, headers, bodies and raw database errors are excluded from logs/responses. Patched transitive dependencies are pinned with tested overrides. In-memory rate limiting requires shared storage for multiple processes. Truehost plan, TLS and production deployment remain unverified; local MariaDB is old and CI targets 10.11. No Milestone 2 business functionality or automatic merge.

## Reviewer checklist

- [ ] Confirm required CI checks pass on this PR.
- [ ] Review environment validation, middleware ordering and response contracts.
- [ ] Review schema-scoped permissions, baseline migration and reset guidance.
- [ ] Review shutdown/readiness behavior and dependency overrides.
- [ ] Import Postman collection and inspect Swagger as desired.
- [ ] Confirm Truehost deployment gates are understood.
- [ ] Approve foundation before authorizing Milestone 02.
