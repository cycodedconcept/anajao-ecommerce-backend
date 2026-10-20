# Identity and access operations

Milestone 02 uses customer-only registration, verified email before login, bearer access tokens and rotating refresh sessions. The owner approved these defaults on 2026-10-20. The fixed roles are CUSTOMER, ADMIN and SELLER. Roles are mutually exclusive and evaluated from the database on every authenticated request; tokens never grant a role by themselves. No public route changes roles.

## Setup and commands

Use Node.js 24 (`.nvmrc`). Run `npm ci`, `npm run db:generate`, and `npm run db:migrate` with the existing schema-scoped migration identity. The additive `20261020000000_identity_access` migration creates nine identity tables without changing foundation data. Runtime credentials remain DML-only.

Generate two independent 32-byte random values with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Store them privately as `AUTH_SIGNING_KEY` and `MFA_ENCRYPTION_KEY`. The server refuses missing, malformed or identical keys; never use the example placeholders. Existing local `.env` files need these new keys before `npm run dev` or `npm start` can start. Tests generate ephemeral keys. `AUTH_ISSUER` and `AUTH_AUDIENCE` default to `anajao` and `anajao-api`.

Run `npm run db:migrate:test` before `npm run test:integration`. The helper checks that TEST_DATABASE_URL names a separate schema ending in `_test`; TEST_MIGRATION_DATABASE_URL may provide a separate DDL identity for that same schema. Local test credentials already have test-only DDL privileges. CI uses its disposable database service. Tests remove only their uniquely prefixed fixture users and associated records, never reset a database.

## Tokens, passwords and client transport

Passwords are 12–128 characters, hashed with Argon2id (19 MiB, two iterations, one lane), following the [OWASP password-storage minimum](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Passwords are not normalized or logged. Emails are trimmed and lowercased; database uniqueness uses the existing utf8mb4 Unicode case-insensitive collation. Profiles do not duplicate email or identity data.

Access JWTs last 10 minutes, use HS256 and validate signature, algorithm, type, issuer, audience, issued-at, expiry, subject and session ID. Sessions expire absolutely after 30 days. Every protected request checks current account status and session revocation in MariaDB, so logout, reset, password change and deletion requests invalidate access immediately. Refresh tokens are random 256-bit opaque strings; only SHA-256 hashes are stored. Rotation consumes the previous token transactionally; reuse commits revocation of the entire session before returning 401. Concurrent refresh requests yield at most one success; the replay also invalidates that winner. Clients must serialize refresh requests rather than retrying the same refresh token concurrently.

Send access tokens only via `Authorization: Bearer ...`; refresh and one-time tokens go in JSON bodies, never query strings. Cookies are not accepted as authentication and no authentication cookies are set. This avoids ambient cookie-authentication CSRF; exact-origin CORS remains in force. Web clients should keep access tokens in memory, use a separately reviewed BFF for durable browser sessions, and avoid localStorage for long-lived refresh tokens. Native clients should use platform secure storage. HTTPS is required outside local development. A cookie-based transport would require a new CSRF design and tests.

Changing AUTH_SIGNING_KEY invalidates existing access JWTs; revoke sessions as part of a compromise response. Refresh-token hashing does not use this key, so revoke those sessions separately. MFA_ENCRYPTION_KEY encrypts TOTP secrets with AES-256-GCM and binds each ciphertext to the user ID. Rotate it only through an audited decrypt/re-encrypt maintenance operation with both old and new keys available. Never simply replace it: existing factors would become unreadable. No online key-rotation endpoint or automated MFA recovery bypass exists.

## Provider boundaries and account recovery

The default server wires `UnconfiguredDelivery`: registration, resend, forgot-password and phone-challenge requests return a clear 503 before mutating account state when delivery is not configured. Unit/integration tests inject `MemoryDelivery` to exercise successful flows. Test tokens are never returned by production HTTP endpoints or logged. There is no development mailbox endpoint or silent fake delivery.

Before enabling real delivery, select and verify email/SMS providers, sender/domain ownership, templates, delivery retries, timeouts and credential handling. Implement `IdentityDelivery`, inject it in server composition, and test failure paths with the chosen provider. EMAIL, PHONE and PASSWORD_RESET challenges expire in 30 minutes, are purpose-bound, consumed once, and superseded by a new challenge for the same account/purpose. Phone tokens are high-entropy opaque values delivered through the adapter, not short numeric SMS codes. SMS UX and link delivery need provider-specific work before release. Password resets revoke sessions and do not disable MFA.

Google and Apple login endpoints explicitly return `PROVIDER_NOT_CONFIGURED` (503). No social JWT is trusted and no automatic account linking occurs. Real OIDC discovery, issuer/audience validation, nonce/PKCE, verified-email linking rules and provider credentials require a separately verified integration. Order history/reorder remains deferred to Milestone 04 because no order data exists.

## MFA and privileged provisioning

A signed-in user supplies their password to `/me/mfa/setup`, securely records the returned TOTP secret/URI, then confirms a code at `/me/mfa/confirm` within 10 minutes. Confirming enrollment revokes existing sessions. Login then requires password plus a fresh TOTP code. The library permits the current or previous 30-second step, and an atomic monotonic step check rejects reuse. Do not reuse the confirmation code for immediate login; wait for the next code. The provisioning URI is returned only in the authenticated response, never used as an API request URL.

`GET /admin/access` requires ADMIN plus an MFA-verified session. `GET /seller/access` requires SELLER plus MFA. These are authorization checks, not business administration modules. A privileged account without enrolled MFA can access account enrollment routes but cannot pass either privileged gate. No public seller promotion is available.

To bootstrap an admin, first register and verify a customer through a configured delivery adapter, enroll MFA, then have an authorized operator set ADMIN_BOOTSTRAP_EMAIL privately and run `npm run build` followed by `npm run admin:bootstrap`. The command refuses unverified, inactive, already-privileged or non-MFA accounts, revokes sessions, and writes ADMIN_BOOTSTRAP_GRANTED in the audit table in one transaction. Record the operator and approval in the deployment change log. The CLI was not run against real development or production users; integration tests exercise the same repository procedure only with disposable test users. Lost-MFA recovery needs an approved operator identity-proofing procedure; no insecure self-service bypass is supplied.

## Profiles, addresses and privacy

`GET/PATCH /me` exposes safe DTOs and permits display-name changes only. Email and role updates are deliberately excluded. Verified phone replacement uses a new challenge. Address create/list/replace/delete is always scoped to the authenticated user; cross-account writes return 404. Maximum 20 addresses; list page size 1–50 and page 1–1000. Dates use UTC application timestamps and DATETIME(3).

`POST /me/privacy-requests` requires password confirmation. EXPORT requests are idempotent while pending. DELETE requests immediately mark the account DELETION_PENDING, revoke sessions and invalidate challenges. Requests are not claims of completed data erasure or export. Authorized operations staff must verify the requester, apply the approved retention policy, securely deliver exports or erase/anonymize records, and mark completedAt only after fulfillment. Automatic erasure is deferred until order/audit retention requirements are agreed. User-owned profiles, addresses, factors, sessions, challenges and privacy records have cascading deletion semantics; audit user references become null on physical deletion. No deletion job or production data removal ran in this milestone.

## Abuse controls and audit

Authentication endpoints have per-IP and normalized-account limits (default 10 per 15 minutes); IPv6 addresses use express-rate-limit's subnet normalization. Protected account routes and MFA confirmation also have account limits. Failed attempts count; clients receive 429. Limits are in-memory and require a shared store for multi-instance deployments. Keep proxy trust at zero unless the deployment topology is verified. Registration/recovery responses are generic for eligible and unknown accounts, and missing-user login performs a dummy password verification. Network timing is not promised to be indistinguishable.

Audit rows record fixed event names, UTC time and an internal user ID where applicable, never credentials, raw tokens, headers, URLs, bodies or database exceptions. Security-relevant credential and lifecycle changes write their audit event in the same transaction. Authentication failures and refresh replay are recorded. Configure retention/archiving for expired sessions, consumed challenges, refresh history and audit records before production; keep consumed refresh hashes at least until their session expiry so replay detection remains effective.

## Postman walkthrough

Import `postman/anajao-milestone-02.postman_collection.json` and `postman/anajao-milestone-02.postman_environment.json`. Select the example environment, set baseUrl and use disposable local accounts. Examples are illustrative request/response contracts, not captured production responses. The default server intentionally returns 503 for delivery and social providers; successful registration/recovery needs a verified adapter. Automated integration tests exercise those flows with an injected memory adapter.

1. Register, obtain the verification token from the configured delivery channel, put it in verificationToken, then run Verify.
2. Login. Test scripts save accessToken and refreshToken in the selected environment. Read/update Me; add an address (addressId is captured), list, replace and delete it.
3. Refresh once; the script replaces both tokens. To test replay, retain the old refresh value separately and submit it again, then confirm the entire session is rejected. Login again afterward.
4. For password recovery, request instructions, copy the delivered token into resetToken, set newPassword and reset. Update password in the environment before logging in again. Password change, logout and logout-all are independent scenarios and invalidate sessions.
5. Set up MFA, store the secret in an authenticator, set mfaCode and confirm. Login again with an added `code` property using a fresh code. Do not export the environment with actual tokens or passwords.
6. Run the negative-case folder as a signed-in CUSTOMER: missing auth gives 401, role injection gives 400, invalid reset gives 400, admin access gives 403. Verify admin/seller success only with explicitly provisioned test roles and MFA.
7. Request EXPORT; submit DELETE only for a disposable account as it immediately suspends access. Do not run the entire collection indiscriminately: destructive lifecycle actions and expired one-time values intentionally change later expectations.

Regenerate the collection with `npm run docs:postman`. Swagger remains at `/api-docs/` and machine-readable OpenAPI at `/api-docs/openapi.json`. Provider delivery, Postman GUI import and production deployment must not be inferred from automated contract/test validation.
