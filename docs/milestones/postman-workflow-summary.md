# Postman API workflow follow-up

Date: 2026-10-22. Branch: feature/postman-api-workflow. Base: merged develop d80a8a1; PR #5 (Milestone 02) was verified merged before changes.

## Scope

This follow-up implements the owner's Postman API Testing and Documentation Workflow as a permanent requirement in AGENTS.md and postman/README.md. It does not implement Milestone 03, add business endpoints, alter authentication policy, or change production API behavior. OpenAPI remains at its established source paths and is revalidated; the existing endpoint contracts are unchanged.

The canonical collection is named Anajao Ecommerce API. Its health, authentication, customers, admin and sellers folders contain reference examples and isolated automated scenarios. Existing milestone collections were inspected and preserved; only example passwords in the historical environment template were cleared. No payments, orders, logistics or blog endpoints were invented.

The collection contains 94 HTTP scenarios covering every documented operation, generated missing-auth/invalid-payload cases where applicable, and explicit replay, ownership, pagination, uniqueness and lifecycle checks. Eleven database assertions verify persistence and revocation effects. Templates contain blank credentials/tokens; ephemeral fixture values never enter Git. Test-schema guards reject production mode, remote hosts, non-test names and the runtime schema even under different credentials.

The runner invokes the official Postman CLI against a file, starts ephemeral loopback test servers, verifies readiness, injects memory delivery, aggregates sanitized results, and cleans up only uniquely prefixed fixtures. Raw results are private temporary files and removed; committed/CI reports contain only allowlisted names, status codes, counts and boolean outcomes. Missing or skipped requests fail acceptance. The official collection schema is vendored for offline validation, and generator drift/coverage are tested.

## Platform and external setup

The official CLI is installed as a pinned development dependency. Its current native macOS binary cannot start on this host's macOS 12.7.6 because a required C++ runtime symbol is absent. Local collection execution is therefore blocked, not passed. Linux GitHub Actions is configured to execute the same runner and upload sanitized reports, with failures failing the verify job. Actual CI evidence will be recorded before review readiness is claimed.

Newman was evaluated and removed after its dependency tree introduced unresolved high/critical advisories. No Newman dependency or alternative runner is shipped. No Postman API key, cloud workspace or publishing permission was configured; cloud documentation and live provider delivery are not claimed updated. Reference/manual examples and provider configuration remain distinct from executed automated scenarios.

## Artifacts and checks

- postman/anajao-ecommerce.postman_collection.json and anajao-local.postman_environment.json.
- postman/README.md: installation, isolated execution, platform blocker, reporting, secrets, manual/cloud boundaries and future milestone checklist.
- scripts/postman/: scenario definitions, collection generation, guarded fixtures, official CLI runner and report sanitization.
- tests/postman.test.ts: official schema validation, generation drift, complete operation coverage, database isolation and report redaction.
- GitHub Actions: official CLI collection execution after schema migration and sanitized report artifacts.
- AGENTS.md, README and the Milestone 03 prompt: durable workflow requirements.

Local regression results, actual collection execution evidence, passed/failed/not-executed counts, report paths and PR publication are recorded in postman-workflow-test-report.md. Never infer collection execution from the Vitest suite or from workflow creation alone.
