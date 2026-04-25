# HR-Buddy Backend

Backend API service for HR-Buddy (Construction Lines internal request platform), built with NestJS + Prisma + PostgreSQL.

Last updated: 2026-04-26

## 1) Scope (v1)

Implemented modules in `src/modules`:
- `auth-otp`
- `requests`
- `attachments`
- `messenger`
- `notifications`
- `admin-auth`
- `admin-requests`
- `admin-settings`
- `admin-audit`
- `maintenance`
- `reference`
- `geo`

Notes:
- Activity/audit logging is integrated in request flows and exposed via admin audit APIs.
- Legacy SLA artifacts may exist, but SLA runtime is not an active standalone module in this v1 scope.

## 2) Tech Stack

- NestJS `11`
- Prisma `7`
- PostgreSQL `15+`
- TypeScript `5`
- Jest + Supertest
- ESLint + Prettier

## 3) Project Structure

```text
backend/
|- src/
|  |- main.ts
|  |- app.module.ts
|  |- config/                    # runtime config + env validation
|  |- common/                    # filters, middleware, rate limit, shared utils
|  |- modules/
|     |- auth-otp/
|     |- requests/
|     |- attachments/
|     |- messenger/
|     |- notifications/
|     |- admin-auth/
|     |- admin-requests/
|     |- admin-settings/
|     |- admin-audit/
|     |- maintenance/
|     |- reference/
|     |- geo/
|- prisma/
|- scripts/                      # release gate, smoke, migrate deploy helper
|- test/                         # e2e test suite
|- docs/                         # runbook, API contract, operations checklist
|- .env.example
|- .env.deploy.example
```

## 4) Prerequisites

- Node.js `22+`
- npm `10+`
- PostgreSQL `15+` (local or managed)

Windows note:
- use `npm.cmd` instead of `npm`.

## 5) Local Setup

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
# edit backend/.env
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run start:dev
```

Default API URL:
- `http://localhost:3001`

## 6) Environment Variables

Templates:
- Local baseline: `backend/.env.example`
- Deploy baseline: `backend/.env.deploy.example`

### 6.1 Required in production

- Runtime:
- `NODE_ENV=production`
- `RUNTIME_ENV=production`
- `DATABASE_URL`
- `CORS_ORIGINS`
- Core secrets:
- `OTP_HASH_SECRET`
- `ATTACHMENT_UPLOAD_TICKET_SECRET`
- `MESSENGER_MAGIC_LINK_SECRET`
- `ADMIN_SESSION_SECRET`
- Admin credentials:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- Provider-specific credentials:
- OTP webhook mode requires `OTP_WEBHOOK_URL` (recommended with signing secret)
- OTP smtp mode requires `OTP_SMTP_USERNAME`, `OTP_SMTP_APP_PASSWORD`, `OTP_SMTP_FROM_EMAIL`
- Attachment `b2` mode requires `ATTACHMENT_B2_*`
- Attachment `webhook` mode requires `ATTACHMENT_STORAGE_WEBHOOK_URL`

### 6.2 Strongly recommended in production

- `DIRECT_DATABASE_URL` (migration pipeline)
- `HEALTH_CHECK_TOKEN`
- `TRUST_PROXY` (behind reverse proxy/load balancer)
- `ABUSE_PROTECTION_STORE=postgres`
- `ABUSE_PROTECTION_POSTGRES_FAIL_CLOSED_IN_PRODUCTION=true`
- `ADMIN_REMEMBER_SESSION_TTL_MINUTES`
- `ATTACHMENT_PUBLIC_UPLOAD_SESSION_TTL_SECONDS`

### 6.3 Optional tuning

- `READINESS_STRICT_PROVIDERS`
- `RUNTIME_CONFIG_STRICT`
- `REQUEST_DEDUPE_WINDOW_SECONDS`
- `REQUEST_CREATE_USE_DB_LOCK`
- `RATE_LIMIT_*`
- `RETENTION_*`
- `PDPA_ANONYMIZE_MIN_CLOSED_DAYS`
- `GEO_DATASET_PATH`

## 7) Runtime Behavior

### 7.1 Health endpoints

- `GET /health`
- `GET /health/db`
- `GET /health/ready` (returns `503` when readiness checks fail)

### 7.2 Request IDs and logging

- Every response includes `x-request-id`.
- If inbound `x-request-id` exists, backend reuses it.
- Logs include structured events (`http_request`, `http_exception`) for correlation.

### 7.3 Auth model

- Employee: OTP session flow (`/auth-otp/*`) and employee session token/cookie.
- Admin: session flow (`/admin/auth/*`).
- Messenger: token via magic link (`/messenger/link/*`).

## 8) Security Baseline

- Security headers middleware enabled.
- CORS configurable via `CORS_ORIGINS`, `CORS_ALLOW_CREDENTIALS`.
- Production startup guard checks unsafe config patterns (for example weak/default secret posture).
- Additional production safety expectations:
- avoid wildcard origins with credentials enabled
- avoid localhost origins in production CORS
- avoid `OTP_DELIVERY_PROVIDER=console` in production

## 9) Abuse Protection and Rate Limiting

- Global abuse protection enabled by default.
- Store options:
- `memory` (single-instance)
- `postgres` (multi-instance safe)
- High-risk policy routes include:
- OTP send/verify
- admin login
- request create endpoints
- messenger link operations

Exceeding limits returns `429` with relevant rate-limit metadata.

## 10) Attachments and Storage

Supported storage provider modes:
- `local`
- `webhook`
- `b2`

Upload flow pattern:
1. `presign` endpoint
2. client uploads to presigned URL
3. `complete` endpoint to finalize attachment record

Includes:
- upload ticket TTL
- public upload session token (for public form submission flow)
- download URL TTL and access checks by role

## 11) Messenger Magic Link

- Tokenized route for messenger operations:
- `GET /messenger/link/:token`
- `PATCH /messenger/link/status`
- `POST /messenger/link/report-problem`
- Replay-window safeguards and transition rules are enforced server-side.

## 12) Data Retention and PDPA

- Retention job configurable via `RETENTION_*`.
- Advisory DB lock (default enabled) prevents concurrent retention runs across instances.
- PDPA anonymization endpoints available in admin maintenance APIs.

## 13) Scripts and Commands

Core:
- `npm.cmd run build`
- `npm.cmd run start:dev`
- `npm.cmd run start:prod`
- `npm.cmd run lint`
- `npm.cmd run lint:check`
- `npm.cmd run test`
- `npm.cmd run test:e2e`
- `npm.cmd run test:cov`

Prisma:
- `npm.cmd run prisma:generate`
- `npm.cmd run prisma:migrate:deploy`

Release:
- `npm.cmd run release:gate`
- `npm.cmd run smoke:preprod`
- `npm.cmd run freeze:check`

## 14) Quality Gates

`release:gate` validates:
- build
- lint
- unit tests
- e2e tests

Optional smoke in same gate:
- set `RELEASE_GATE_INCLUDE_SMOKE=true` with required smoke env values.

Recommended pre-release sequence:

```powershell
npm.cmd run lint:check
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run build
npm.cmd run release:gate
```

## 15) API Documentation

Primary references:
- `docs/api-reference.md`
- `docs/error-contract.md`

Operational references:
- `docs/deploy-runbook.md`
- `docs/operations-checklist.md`
- `docs/backend-v1-freeze-checklist.md`
- `docs/legal-compliance-th.md`
- `docs/backend-project-structure.md`
- `docs/release-notes-backend-v1-rc1-2026-03-09.md`

## 16) Deployment (Production)

### Step 1: Prepare environment

```powershell
Copy-Item .env.deploy.example .env
# fill all production values
```

### Step 2: Build and migrate

```powershell
npm.cmd install
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run build
```

### Step 3: Start runtime

```powershell
npm.cmd run start:prod
```

### Step 4: Verify

- `GET /health` => `200`
- `GET /health/db` => `200`
- `GET /health/ready` => ready result for your environment profile

## 17) Rollback Guide (Short)

If release is unstable:
1. Stop/limit mutating operations if incident severity is high.
2. Roll back backend artifact/image to previous stable release.
3. If needed, execute reviewed DB rollback or safe forward-fix path.
4. Re-check health endpoints and critical flows (OTP, request create, admin update, messenger link).
5. Publish incident summary and follow-up actions.

Important:
- Prepare migration rollback strategy before production release.
- Avoid ad-hoc destructive DB commands.

## 18) Troubleshooting

### 18.1 `401` on admin endpoints

- verify admin session token/cookie forwarding
- verify `/admin/auth/login` success and token freshness

### 18.2 OTP not delivered

- check `OTP_DELIVERY_PROVIDER`
- verify corresponding credentials (`webhook` or `smtp`)
- verify provider reachability and timeout settings

### 18.3 Attachment upload finalize fails

- confirm client performed upload to presigned URL before `complete`
- verify ticket not expired
- verify storage metadata (size/mime) matches ticket
- verify role/request access for endpoint being used

### 18.4 Messenger link invalid/expired errors

- verify token source header (`x-messenger-token` or bearer)
- verify `MESSENGER_MAGIC_LINK_SECRET` consistency
- verify TTL not exceeded

### 18.5 CORS issues from frontend

- verify `CORS_ORIGINS` contains exact frontend domains
- verify `CORS_ALLOW_CREDENTIALS` setup matches frontend auth flow

## 19) Ownership and Maintenance

- Primary owner: Backend Engineering team
- Secondary owner: Platform/SRE + QA

Update this README whenever:
- environment variables change
- auth/session behavior changes
- release gate scripts change
- new module or protected route is added
