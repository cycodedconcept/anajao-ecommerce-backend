# Anajao Ecommerce API workflow

The canonical version-controlled collection is `anajao-ecommerce.postman_collection.json`, named **Anajao Ecommerce API**. Its folders are health, authentication, customers, admin and sellers. These match the implemented foundation/identity modules. Do not add empty payments, orders, logistics, blog or other domain folders until those APIs exist or their planned status is explicitly documented. Existing Milestone 01/02 collections are retained as historical snapshots; their requests were reviewed before introducing the canonical collection. The older environment's example passwords have been cleared.

Each domain contains a `reference-*` folder with manual requests/examples and an `automated-*` folder with isolated scenarios. Reference examples are illustrative. Only requests actually executed with successful assertions in a generated report count as passed. `scripts/postman/scenarios.ts` owns scenario intent; `src/docs/identity-contracts.ts` and `src/docs/openapi.ts` remain the API contract sources. `npm run docs:postman` regenerates the canonical collection and environment without overwriting historical collections.

## Setup and local execution

Use Node.js 24 and a local test database as described in docs/database.md. The official Postman CLI is pinned as a development dependency and installed by `npm ci`; no global CLI, API key or cloud login is required for file-based runs on a supported host. See the [official CLI installation guide](https://learning.postman.com/docs/postman-cli/postman-cli-installation/) and [local collection execution documentation](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection).

```sh
npm ci
npm run test:api:prepare
npm run docs:postman
npm run test:api
```

`test:api:prepare` generates Prisma Client and migrates the isolated test schema. `test:api` checks TEST_DATABASE_URL and refuses NODE_ENV=production, non-loopback database hosts, names not ending in `_test`, or the runtime schema even if credentials differ. It starts the existing application factory on an ephemeral loopback port, checks database/API readiness, injects test-only memory delivery, and creates uniquely named disposable fixtures. It does not start or mutate the normal development server. The unavailable-readiness scenario uses a second loopback test app with an injected failing dependency.

Fixtures include customers, verified/unverified accounts, sessions, pending challenges and MFA factors. These are test setup, not claimed HTTP successes. Fixture generation uses the existing repository/service/crypto implementation; privileged roles are assigned only within the isolated fixture database. The collection then makes actual HTTP requests and asserts HTTP codes, response schemas, envelopes, specific errors and relevant business outcomes. All documented API operations have automated coverage; invalid payload and missing-auth scenarios are generated where applicable. Session revocation, ownership, replay, uniqueness, pagination and lifecycle behavior have explicit cases. Eleven additional database assertions verify persisted side effects.

Every folder run must succeed, every expected request must be present and pass, and cleanup must succeed. Any failed, missing or skipped request/assertion fails the command and CI. The runner closes servers and deletes only users with its randomly generated run prefix and their related rows. It never resets a schema. Generic login-rejection audit rows without user references may remain in the test database; no customer PII is recorded there.

### Known local platform blocker

On this project's macOS 12.7.6 host, Postman CLI 1.75.0 aborts before startup because the system C++ library lacks `__libcpp_verbose_abort`. Therefore local Postman collection execution on this host is **blocked**, not passed. Use a supported newer macOS/Linux host or the configured GitHub Actions Linux job. The runner reports all requests unexecuted when CLI startup fails. Do not bypass this by claiming the separate Vitest suite executed the collection.

Newman was investigated as a fallback but removed after npm audit found unresolved high/critical dependency advisories. It is not a project dependency or a supported execution path. The official CLI remains the only collection runner.

## Secrets and production safeguards

Import `anajao-local.postman_environment.json` for manual reference requests. Only baseUrl has a value (`http://127.0.0.1:3000`); credentials, IDs and tokens are blank. Put manual credentials in an ignored `*.local.json` environment, or use an approved secret manager. Never export real values into tracked templates.

Automated credentials, signing/encryption keys and token variables are randomly generated at runtime. They are written only into a private temporary directory with mode 0700 and an environment file with mode 0600. The directory is removed in the runner's finally block, including failed runs. Do not retain or upload raw runner JSON: it can contain credentials. A hard OS kill may leave an OS-temporary directory; remove only that run's `anajao-postman-*` directory if this happens.

The child CLI receives only PATH, its temporary directory and a CI marker; database URLs, application secrets and POSTMAN_API_KEY are not forwarded. The runner uses a collection file path, never a cloud collection ID, and disables event reporting. It does not log in, publish, or upload runs to a Postman workspace. Collection scripts skip requests targeting a non-loopback baseUrl; automated folders also require the isolated-run marker. Never point tests at production, even if a database happens to end in `_test`.

## Reports and CI

The runner explicitly selects the official CLI’s Newman-compatible JSON structure and omits bodies/headers before projecting results. Folder selection uses the CLI’s `-i` option; see the [official command reference](https://learning.postman.com/docs/postman-cli/postman-cli-collections/) and [reporter options](https://learning.postman.com/docs/postman-cli/postman-cli-reporters).

The runner projects raw results into an allowlist of scenario names, status codes, assertion counts, execution flags and fixed side-effect check names. It never exports request/response bodies, headers, emails, tokens, passwords, raw errors or the full environment. Reports are written to ignored `reports/api-tests/latest.json` and `latest.md`. Commit sanitized, dated report snapshots as milestone evidence. Unexecuted requests are reported separately from executed failures; skipped assertions prevent acceptance.

GitHub Actions runs the collection after test-schema migration, integration tests and smoke checks on Linux. A failed collection run fails the verify job. The `api-test-reports` artifact contains only sanitized latest reports and expires after 14 days. A workflow definition or upload alone is not evidence of a pass; inspect the actual run and report. Do not upload private temporary files or raw Postman JSON reports.

## Documentation, validation and future milestones

Run `npm run docs:postman`, `npm test`, and all existing acceptance checks before review. Tests validate the canonical collection against the vendored official v2.1 schema, detect generator drift, validate OpenAPI, and enforce automated coverage of every documented API operation. The schema is sourced from [Postman's official collection schema](https://schema.getpostman.com/json/collection/v2.1.0/collection.json); it is vendored so validation does not require a network call.

Every milestone must update relevant domain folders, request/response schemas and examples, authorization requirements, environment placeholders, executable positive/negative cases and database assertions. Add response fixtures only as sanitized examples. Keep OpenAPI at `src/docs/openapi.ts` and its existing identity contract module; the HTTP spec remains `/api-docs/openapi.json`. Future filtering/conflict cases belong beside their real endpoints, not invented placeholder APIs.

Milestone handoff must include collection/environment changes, OpenAPI changes when needed, actual passed/failed/skipped counts, sanitized report files, setup instructions, an endpoint change summary, updated AGENTS.md when needed, and known manual/configuration gates. Preserve folder organization and completed behavior. Commit/push a feature branch and open a PR to develop; never merge automatically.

Cloud workspace selection, Postman credentials and publishing authorization are not configured. No shared/cloud documentation update is claimed. Provider-success cases here use injected delivery; live email/SMS and Google/Apple success remain outside automated acceptance. Privacy export/deletion fulfillment, production TLS and production deployment remain manual integration gates documented in docs/identity.md. The collection tests do not claim these operations occurred.
