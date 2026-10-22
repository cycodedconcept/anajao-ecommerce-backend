# Sanitized API execution evidence

The runner writes ignored `latest.json` and `latest.md` files here. They contain only trusted scenario names, status codes, counts and fixed database-check outcomes. Commit dated sanitized snapshots after actual execution. A blocked run must preserve its zero executed count; do not substitute Vitest results for collection requests.

Never commit raw CLI JSON, exported environments, response bodies, headers, credentials or temporary files. GitHub Actions uploads only sanitized latest reports as the `api-test-reports` artifact. See postman/README.md for setup and the local macOS CLI blocker.
