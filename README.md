# HR-Buddy

HR-Buddy is an internal service-request platform for Construction Lines.

It supports 4 request flows:
- Building repair
- Vehicle repair
- Messenger booking (with magic link update flow)
- Document request

## Current Repository Status (2026-03-10)

- Backend: implemented and validated with release gate (`build + lint + unit + e2e`)
- Frontend: Next.js scaffold is present, but business UI integration is not finalized in this repository snapshot
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
|- frontend/                # Next.js app (scaffold)
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
npm.cmd run start:dev
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
- `frontend`: no required production-grade env documented yet in this snapshot

For backend variable details and production-safe guidance, use:
- `backend/.env.example`

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

## CI Workflows

- `.github/workflows/backend-release-gate.yml`
- `.github/workflows/backend-preprod-smoke.yml`

## Important Notes

- Production should use `npm.cmd run prisma:migrate:deploy`, not `migrate dev`.
- Keep all real secrets out of git.
- Configure backend `.env` with production-safe values before any real deployment.
