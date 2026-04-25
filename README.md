# HR-Buddy

HR-Buddy is an internal service-request platform for Construction Lines.

It supports 4 request flows:
- Building repair
- Vehicle repair
- Messenger booking (with magic link update flow)
- Document request

## Current Repository Status (2026-04-26)

- Backend: implemented and validated with release gate (`build + lint + unit + e2e`)
- Frontend: Next.js app is integrated with business flows and route-level smoke checks
- CI workflows:
  - `Backend Release Gate`
  - `Backend Preprod Smoke`

## Tech Stack

- Backend: NestJS 11, Prisma 7, PostgreSQL
- Frontend: Next.js 16, React 19, TypeScript
- Tooling: ESLint, Jest, Supertest, GitHub Actions

## Repository Structure

```text
HR-buddy/
|- backend/                 # Main API service
|- frontend/                # Next.js app
|- .github/workflows/       # CI workflows
|- docker-compose.yml       # Local PostgreSQL + pgAdmin
|- .env.example             # Top-level env for docker-compose
```

## Prerequisites

- Node.js 22+
- npm 10+
- PostgreSQL 15+ (or Docker)
- PowerShell (for commands below on Windows)

## Quick Start

### 1) Start database (Docker option)

```powershell
Copy-Item .env.example .env
# edit .env values if needed
# then start containers

docker compose up -d
```

This starts:
- PostgreSQL on `POSTGRES_PORT`
- pgAdmin on `PGADMIN_PORT`

### 2) Run backend

```powershell
cd backend
npm.cmd install
Copy-Item .env.example .env
# edit backend/.env
npm.cmd run prisma:migrate:deploy
npm.cmd run dev
```

Default backend URL: `http://localhost:3001`

### 3) Run frontend (optional)

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

Default frontend URL (Next.js): usually `http://localhost:3000`

## Environment Files

- Top-level `.env`: used by `docker-compose.yml` (DB + pgAdmin)
- `backend/.env`: used by backend runtime (supports optional `DIRECT_DATABASE_URL` for migration jobs)
- `frontend/.env`: used by frontend runtime and local dev

Templates:
- Local/backend baseline: `backend/.env.example`
- Deploy/backend: `backend/.env.deploy.example`
- Local/frontend baseline: `frontend/.env.example`
- Deploy/frontend: `frontend/.env.deploy.example`

### Deploy env quick setup

Backend (Railway/Render/Fly.io/etc.):
```powershell
Copy-Item backend/.env.deploy.example backend/.env
# replace all placeholder values before deploy
```

Frontend (Vercel/Netlify/etc.):
```powershell
Copy-Item frontend/.env.deploy.example frontend/.env
# replace all placeholder values before deploy
```

Important:
- Never commit real secrets, passwords, API keys, or connection strings.
- Ensure `CORS_ORIGINS` (backend) and `BACKEND_API_BASE_URL`/`NEXT_PUBLIC_API_BASE_URL` (frontend) point to real production domains.
- Ensure CSP allow-list variables (`FRONTEND_CSP_*`) include your attachment/storage domains.

### Environment Variable Matrix (Required vs Optional)

Backend required (production):
- `NODE_ENV`, `RUNTIME_ENV`
- `DATABASE_URL` (and `DIRECT_DATABASE_URL` for migration job)
- `CORS_ORIGINS`
- `OTP_HASH_SECRET`
- `ATTACHMENT_UPLOAD_TICKET_SECRET`
- `MESSENGER_MAGIC_LINK_SECRET`
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
- Storage credentials by provider:
- `ATTACHMENT_STORAGE_PROVIDER=b2` requires `ATTACHMENT_B2_*`
- `ATTACHMENT_STORAGE_PROVIDER=webhook` requires `ATTACHMENT_STORAGE_WEBHOOK_URL` (and recommended signing/api key)
- OTP delivery credentials by provider:
- `OTP_DELIVERY_PROVIDER=webhook` requires `OTP_WEBHOOK_URL`
- `OTP_DELIVERY_PROVIDER=smtp` requires `OTP_SMTP_USERNAME`, `OTP_SMTP_APP_PASSWORD`, `OTP_SMTP_FROM_EMAIL`

Backend optional but recommended:
- `HEALTH_CHECK_TOKEN`
- `TRUST_PROXY` (when behind reverse proxy)
- `ABUSE_PROTECTION_STORE=postgres` and related `ABUSE_PROTECTION_POSTGRES_*`
- `RETENTION_*`, `PDPA_ANONYMIZE_MIN_CLOSED_DAYS`
- `ADMIN_REMEMBER_SESSION_TTL_MINUTES`

Frontend required (production):
- `BACKEND_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_AUTH_TOKEN_STORAGE`

Frontend optional but recommended:
- `FRONTEND_CSP_CONNECT_SRC`
- `FRONTEND_CSP_IMG_SRC`
- `FRONTEND_CSP_MEDIA_SRC`
- `FRONTEND_CSP_FRAME_SRC`

Notes:
- Full canonical variable lists are maintained in:
- `backend/.env.deploy.example`
- `frontend/.env.deploy.example`

## Database and Prisma

From `backend/`:

```powershell
npx prisma generate
npm.cmd run prisma:migrate:deploy
```

For local iterative development only:

```powershell
npx prisma migrate dev
```

## Deployment Steps (Production)

### Step 1: Prepare backend environment

```powershell
Copy-Item backend/.env.deploy.example backend/.env
# fill real production values in backend/.env
```

### Step 2: Deploy backend and run migrations

```powershell
cd backend
npm.cmd install
npx prisma generate
npm.cmd run prisma:migrate:deploy
npm.cmd run build
```

Deploy the built backend to your runtime platform (Railway/Render/Fly.io/etc.) and verify:
- `GET /health`
- `GET /health/db`

### Step 3: Prepare frontend environment

```powershell
Copy-Item frontend/.env.deploy.example frontend/.env
# fill real production values in frontend/.env
```

### Step 4: Deploy frontend

```powershell
cd frontend
npm.cmd install
npm.cmd run build
```

Deploy to Vercel/Netlify and verify:
- login pages load
- protected routes redirect correctly
- request create and detail pages call the intended backend

## Testing and Quality Gates

From `backend/`:

```powershell
npm.cmd run lint:check
npm.cmd run test
npm.cmd run test:e2e
npm.cmd run release:gate
```

Optional smoke test against a running target:

```powershell
$env:SMOKE_BASE_URL="https://your-backend-url"
$env:SMOKE_ADMIN_USERNAME="admin"
$env:SMOKE_ADMIN_PASSWORD="<admin-password>"
# optional when target protects health endpoints in production
$env:SMOKE_HEALTH_TOKEN="<health-check-token>"
npm.cmd run smoke:preprod
```

Notes:
- `test:e2e` in this repository uses mocked service integrations for deterministic API contract checks.
- `smoke:preprod` checks a real running backend target and therefore uses that target's real runtime config.

Recommended pre-release full check:

```powershell
cd backend
npm.cmd run lint:check
npm.cmd run test
npm.cmd run test:e2e

cd ../frontend
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run smoke
```

## Staging / UAT Exit Checklist

Before Go-live, confirm all:
- No open `Critical`/`High` defects
- AuthN/AuthZ checks pass (role boundaries for User/Admin/Messenger)
- OTP flow works in real provider mode
- Attachment upload/preview/download works for all supported roles and request types
- Messenger magic link flow works end-to-end (`APPROVED -> IN_TRANSIT -> DONE`)
- Notification badge counts and lists are consistent after refresh and cross-page navigation
- Thai localization is correct in critical screens
- CSP/CORS allow only intended domains and required storage domains
- Audit log captures key actions with correct actor information

## Rollback Guide (Short)

If production release is faulty:
1. Freeze traffic-changing operations (status updates / admin mutations) if possible.
2. Roll back frontend to previous stable deployment.
3. Roll back backend to previous stable artifact/image.
4. If current DB migration is incompatible, execute your prepared DB rollback plan (or hotfix-forward if rollback is unsafe).
5. Validate health endpoints and critical flows (`OTP`, create request, admin status update, messenger link).
6. Publish incident note and postmortem action items.

Important:
- Always test rollback in staging before first production rollout.
- Never run ad-hoc destructive DB commands without reviewed rollback scripts.

## Troubleshooting FAQ

### 1) Upload fails with CORS/CSP errors
- Check backend CORS: `CORS_ORIGINS`
- Check frontend CSP allow-lists: `FRONTEND_CSP_CONNECT_SRC`, `FRONTEND_CSP_IMG_SRC`, `FRONTEND_CSP_MEDIA_SRC`, `FRONTEND_CSP_FRAME_SRC`
- Check storage/bucket CORS policy on provider side

### 2) OTP send/verify fails in production
- Verify `OTP_DELIVERY_PROVIDER` and corresponding credentials
- For webhook mode, verify `OTP_WEBHOOK_URL`, auth key, and signature settings
- For smtp mode, verify SMTP host/port/secure and app password

### 3) Messenger link says token missing/invalid
- Confirm frontend sends `x-messenger-token` (and/or valid bearer as configured)
- Confirm backend `MESSENGER_MAGIC_LINK_SECRET` unchanged between token issue and token use
- Confirm token is not expired (`MESSENGER_MAGIC_LINK_TTL_HOURS`)

### 4) Admin/employee session loops to login
- Check cookie domain/secure/samesite setup on deployment platform
- Verify `BACKEND_API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` point to correct backend
- Check proxy/forwarded headers and `TRUST_PROXY` when behind load balancer

### 5) Smoke test fails on protected routes
- Protected routes may return redirect by design
- Use the project smoke script as-is (it already handles expected redirects)

## Backend API Areas

Main modules implemented in `backend/src/modules`:
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

## API Documentation

Detailed API reference (all endpoints + auth + key request fields + purpose):
- `backend/docs/api-reference.md`

Error contract and business error codes:
- `backend/docs/error-contract.md`

Quick API summary:
- Health:
  - `GET /health`
  - `GET /health/db`
  - `GET /health/ready`
- OTP:
  - `POST /auth-otp/send`
  - `POST /auth-otp/verify`
- Public request create:
  - `POST /requests/building`
  - `POST /requests/vehicle`
  - `POST /requests/messenger`
  - `POST /requests/document`
- Employee self-service:
  - `GET /requests/my`
  - `GET /requests/:id`
  - `PATCH /requests/:id/cancel`
  - attachment routes under `/requests/:id/attachments/*`
- Admin core:
  - `/admin/auth/*`
  - `/admin/requests/*`
  - `/admin/settings/*`
  - `/admin/audit/*`
  - `/admin/notifications/*`
  - `/admin/maintenance/*`
- Public reference and geo:
  - `/reference/*`
  - `/geo/*`

## Deployment and Operations Docs

Read these docs before production deployment:
- `backend/docs/deploy-runbook.md`
- `backend/docs/operations-checklist.md`
- `backend/docs/error-contract.md`
- `backend/docs/backend-v1-freeze-checklist.md`
- `backend/docs/legal-compliance-th.md`

Also prepare environment from:
- `backend/.env.deploy.example`
- `frontend/.env.deploy.example`

## CI Workflows

- `.github/workflows/backend-release-gate.yml`
- `.github/workflows/backend-preprod-smoke.yml`

## Important Notes

- Production should use `npm.cmd run prisma:migrate:deploy`, not `migrate dev`.
- Keep all real secrets out of git.
- Configure backend `.env` with production-safe values before any real deployment.

## Document Metadata

- README owner: Platform Engineering (Backend + Frontend)
- Last updated: 2026-04-26
- Source of truth for deploy env values:
- `backend/.env.deploy.example`
- `frontend/.env.deploy.example`
