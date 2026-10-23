# API collection execution report

Generated: 2026-10-22T08:51:11.821Z. Runner: not started unknown. Overall: FAIL.

Requests: 0 passed, 0 failed, 94 not executed. Assertions: 0 passed, 0 failed, 0 skipped. Fixture cleanup: NOT NEEDED (no fixtures created).

Failure stage: Postman CLI startup (requires a supported host). Sensitive error details were deliberately omitted.

| Request                                                | Expected | Actual       | Result       |
| ------------------------------------------------------ | -------- | ------------ | ------------ |
| Liveness succeeds                                      | 200      | not executed | NOT EXECUTED |
| Readiness succeeds                                     | 200      | not executed | NOT EXECUTED |
| Liveness rejects unknown query                         | 400      | not executed | NOT EXECUTED |
| Readiness rejects unknown query                        | 400      | not executed | NOT EXECUTED |
| Readiness fails with unavailable dependency            | 503      | not executed | NOT EXECUTED |
| Unknown resource returns not found                     | 404      | not executed | NOT EXECUTED |
| Register customer                                      | 202      | not executed | NOT EXECUTED |
| Duplicate registration is generic                      | 202      | not executed | NOT EXECUTED |
| Reject public privilege assignment                     | 400      | not executed | NOT EXECUTED |
| Login rejects unverified customer                      | 401      | not executed | NOT EXECUTED |
| Consume email verification                             | 200      | not executed | NOT EXECUTED |
| Reject reused verification                             | 400      | not executed | NOT EXECUTED |
| Resend verification instructions                       | 202      | not executed | NOT EXECUTED |
| Login customer                                         | 200      | not executed | NOT EXECUTED |
| Reject wrong password                                  | 401      | not executed | NOT EXECUTED |
| Reject unknown account                                 | 401      | not executed | NOT EXECUTED |
| Rotate refresh token                                   | 200      | not executed | NOT EXECUTED |
| Reject refresh replay                                  | 401      | not executed | NOT EXECUTED |
| Reject replacement after replay                        | 401      | not executed | NOT EXECUTED |
| Logout session                                         | 200      | not executed | NOT EXECUTED |
| Reject logged out access                               | 401      | not executed | NOT EXECUTED |
| Logout all sessions                                    | 200      | not executed | NOT EXECUTED |
| Reject second session after logout all                 | 401      | not executed | NOT EXECUTED |
| Request password recovery                              | 202      | not executed | NOT EXECUTED |
| Unknown recovery remains generic                       | 202      | not executed | NOT EXECUTED |
| Reset password                                         | 200      | not executed | NOT EXECUTED |
| Reject reused password reset                           | 400      | not executed | NOT EXECUTED |
| Reset invalidates existing access                      | 401      | not executed | NOT EXECUTED |
| Login with changed password                            | 200      | not executed | NOT EXECUTED |
| google provider fails closed                           | 503      | not executed | NOT EXECUTED |
| apple provider fails closed                            | 503      | not executed | NOT EXECUTED |
| Read own profile                                       | 200      | not executed | NOT EXECUTED |
| Update own profile                                     | 200      | not executed | NOT EXECUTED |
| Reject profile privilege change                        | 400      | not executed | NOT EXECUTED |
| Request phone verification                             | 202      | not executed | NOT EXECUTED |
| Verify phone                                           | 200      | not executed | NOT EXECUTED |
| Reject phone token reuse                               | 400      | not executed | NOT EXECUTED |
| Save address                                           | 201      | not executed | NOT EXECUTED |
| List addresses with pagination                         | 200      | not executed | NOT EXECUTED |
| Reject oversized page                                  | 400      | not executed | NOT EXECUTED |
| Reject cross-account address update                    | 404      | not executed | NOT EXECUTED |
| Reject cross-account address deletion                  | 404      | not executed | NOT EXECUTED |
| Replace own address                                    | 200      | not executed | NOT EXECUTED |
| Delete own address                                     | 200      | not executed | NOT EXECUTED |
| Deleted address returns not found                      | 404      | not executed | NOT EXECUTED |
| Begin MFA enrollment                                   | 200      | not executed | NOT EXECUTED |
| Confirm MFA enrollment                                 | 200      | not executed | NOT EXECUTED |
| MFA enrollment revokes access                          | 401      | not executed | NOT EXECUTED |
| Change password                                        | 200      | not executed | NOT EXECUTED |
| Password change revokes access                         | 401      | not executed | NOT EXECUTED |
| Request privacy export                                 | 202      | not executed | NOT EXECUTED |
| Duplicate export is idempotent                         | 202      | not executed | NOT EXECUTED |
| List privacy requests                                  | 200      | not executed | NOT EXECUTED |
| Reject invalid privacy pagination                      | 400      | not executed | NOT EXECUTED |
| Request account deletion                               | 202      | not executed | NOT EXECUTED |
| Deletion suspends access                               | 401      | not executed | NOT EXECUTED |
| Admin with MFA allowed                                 | 200      | not executed | NOT EXECUTED |
| Customer denied admin access                           | 403      | not executed | NOT EXECUTED |
| Admin without session MFA denied                       | 403      | not executed | NOT EXECUTED |
| Seller with MFA allowed                                | 200      | not executed | NOT EXECUTED |
| Customer denied seller access                          | 403      | not executed | NOT EXECUTED |
| POST /auth/register rejects invalid payload            | 400      | not executed | NOT EXECUTED |
| POST /auth/login rejects invalid payload               | 400      | not executed | NOT EXECUTED |
| POST /auth/refresh rejects invalid payload             | 400      | not executed | NOT EXECUTED |
| POST /auth/verify rejects invalid payload              | 400      | not executed | NOT EXECUTED |
| POST /auth/resend-verification rejects invalid payload | 400      | not executed | NOT EXECUTED |
| POST /auth/forgot-password rejects invalid payload     | 400      | not executed | NOT EXECUTED |
| POST /auth/reset-password rejects invalid payload      | 400      | not executed | NOT EXECUTED |
| POST /auth/logout requires authentication              | 401      | not executed | NOT EXECUTED |
| POST /auth/logout-all requires authentication          | 401      | not executed | NOT EXECUTED |
| GET /me requires authentication                        | 401      | not executed | NOT EXECUTED |
| PATCH /me requires authentication                      | 401      | not executed | NOT EXECUTED |
| PATCH /me rejects invalid payload                      | 400      | not executed | NOT EXECUTED |
| POST /me/password requires authentication              | 401      | not executed | NOT EXECUTED |
| POST /me/password rejects invalid payload              | 400      | not executed | NOT EXECUTED |
| POST /me/phone requires authentication                 | 401      | not executed | NOT EXECUTED |
| POST /me/phone rejects invalid payload                 | 400      | not executed | NOT EXECUTED |
| POST /me/phone/verify requires authentication          | 401      | not executed | NOT EXECUTED |
| POST /me/phone/verify rejects invalid payload          | 400      | not executed | NOT EXECUTED |
| GET /me/addresses requires authentication              | 401      | not executed | NOT EXECUTED |
| POST /me/addresses requires authentication             | 401      | not executed | NOT EXECUTED |
| POST /me/addresses rejects invalid payload             | 400      | not executed | NOT EXECUTED |
| PUT /me/addresses/{id} requires authentication         | 401      | not executed | NOT EXECUTED |
| PUT /me/addresses/{id} rejects invalid payload         | 400      | not executed | NOT EXECUTED |
| DELETE /me/addresses/{id} requires authentication      | 401      | not executed | NOT EXECUTED |
| POST /me/mfa/setup requires authentication             | 401      | not executed | NOT EXECUTED |
| POST /me/mfa/setup rejects invalid payload             | 400      | not executed | NOT EXECUTED |
| POST /me/mfa/confirm requires authentication           | 401      | not executed | NOT EXECUTED |
| POST /me/mfa/confirm rejects invalid payload           | 400      | not executed | NOT EXECUTED |
| GET /me/privacy-requests requires authentication       | 401      | not executed | NOT EXECUTED |
| POST /me/privacy-requests requires authentication      | 401      | not executed | NOT EXECUTED |
| POST /me/privacy-requests rejects invalid payload      | 400      | not executed | NOT EXECUTED |
| GET /admin/access requires authentication              | 401      | not executed | NOT EXECUTED |
| GET /seller/access requires authentication             | 401      | not executed | NOT EXECUTED |

## Database side effects

This report contains only allowlisted names, status codes and counts. No request/response bodies, tokens, passwords, emails, headers or raw errors are retained. Provider-success examples use an injected test delivery adapter; live email/SMS, Google/Apple success and cloud publishing were not executed. See postman/README.md for manual/setup requirements.
