# HR-Buddy Frontend

Frontend web application for HR-Buddy, built with Next.js App Router + TypeScript.

This app supports 3 user roles:
- Employee/Public: create service requests and track own requests via OTP session.
- Admin: manage requests, statuses, settings, audit logs, and notifications.
- Messenger: handle messenger jobs via magic link token page.

Last updated: 2026-04-26

## 1) Tech Stack

- Next.js `16.1.6` (App Router)
- React `19.2.3`
- TypeScript `5`
- Tailwind CSS `v4`
- Vitest + Testing Library (unit/component tests)
- ESLint (Next.js config)

## 2) Project Structure

```text
frontend/
|- app/
|  |- api/                        # Next.js route handlers (proxy + auth cookie helpers)
|  |- requests/new/*              # Public request forms (building/vehicle/messenger/document)
|  |- auth/otp                    # OTP flow
|  |- my-requests, my-notifications
|  |- messenger/link/[token]      # Messenger magic link page
|  |- admin/*                     # Admin pages (dashboard/requests/settings/audit/notifications)
|  |- _components                 # Shared app-level UI blocks
|- components/
|  |- guards/route-guard.tsx      # Session validation and role guard logic
|- lib/
|  |- api/                        # API client + per-domain API wrappers
|  |- auth/                       # Token/session utilities
|- scripts/                       # smoke, release gate, API contract checks
|- docs/                          # QA and route documentation
|- next.config.ts                 # Security headers + CSP policy
```

## 3) Runtime Architecture

- Browser-side API calls target `/api/backend/*` via Next.js proxy route.
- Server-side calls may use direct backend URL from `BACKEND_API_BASE_URL`.
- Proxy route at `app/api/backend/[...path]/route.ts` forwards:
- request method, body, query
- authorization header (if already present)
- admin/employee session token from cookies when authorization is absent
- retry on upstream `502/503/504` for idempotent methods (`GET/HEAD/OPTIONS`)

## 4) Prerequisites

- Node.js `22+`
- npm `10+`
- Running backend API (default `http://localhost:3001`)

## 5) Local Development

```powershell
cd frontend
npm.cmd install
Copy-Item .env.example .env
# update .env if needed
npm.cmd run dev
```

Default URL:
- `http://localhost:3000`

## 6) Environment Variables

Use:
- Local template: `frontend/.env.example`
- Deploy template: `frontend/.env.deploy.example`

### 6.1 Required (production)

- `BACKEND_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_AUTH_TOKEN_STORAGE` (`session` recommended)

### 6.2 Recommended (production)

- `FRONTEND_CSP_CONNECT_SRC`
- `FRONTEND_CSP_IMG_SRC`
- `FRONTEND_CSP_MEDIA_SRC`
- `FRONTEND_CSP_FRAME_SRC`

### 6.3 Optional (CI / smoke / contract)

- `FRONTEND_SMOKE_BASE_URL`
- `FRONTEND_SMOKE_HOST`
- `FRONTEND_SMOKE_PORT`
- `SMOKE_ROUTE_TIMEOUT_MS`
- `SMOKE_ROUTE_RETRIES`
- `SMOKE_ROUTE_RETRY_DELAY_MS`
- `SMOKE_SERVER_READY_TIMEOUT_MS`
- `SMOKE_API_TIMEOUT_MS`
- `SMOKE_REQUIRE_API`
- `API_CONTRACT_TIMEOUT_MS`
- `FRONTEND_RELEASE_GATE_REQUIRE_API`
- `FRONTEND_RELEASE_GATE_SKIP_SMOKE`
- `FRONTEND_RELEASE_GATE_SMOKE_PORT`

### 6.4 Deploy quick setup

```powershell
Copy-Item .env.deploy.example .env
# replace placeholder values with real production values
```

Important:
- Keep `BACKEND_API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` aligned to the same backend target.
- Include storage domains (for upload/preview/download) in CSP env variables.
- Never commit real secrets/tokens.

## 7) Auth, Session, and Guard Model

- Employee pages are protected by OTP session cookie + route guard validation.
- Admin pages are protected by admin session cookie + route guard validation.
- Messenger page is token-based (`/messenger/link/[token]`) and does not use OTP/admin session.
- Guard behavior (`components/guards/route-guard.tsx`):
- validates active session against backend (`/admin/auth/me` or `/requests/my?limit=1`)
- redirects to login when session is missing/expired
- redirects to `/unauthorized` when backend returns `403`
- shows near-expiry warning popup and persists dismissal per session-expiry value

## 8) Security Headers and CSP

Configured in `next.config.ts`:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-site`
- dynamic CSP with optional env allow-lists (`FRONTEND_CSP_*`)

Note:
- In production, avoid over-broad CSP origins.
- Add only required origins for API/storage/media.

## 9) Scripts

- `npm run dev` start development server
- `npm run build` build production bundle
- `npm run start` start production server
- `npm run lint` run ESLint
- `npm run typecheck` run TypeScript (`tsc --noEmit`)
- `npm run test` run Vitest once
- `npm run test:watch` run Vitest in watch mode
- `npm run api:contract` run API contract checks
- `npm run smoke` smoke test against running frontend
- `npm run smoke:self-host` start dev server and run smoke
- `npm run smoke:self-host:prod` start prod server and run smoke
- `npm run smoke:strict` smoke + require backend health
- `npm run release:gate` lint + typecheck + build + smoke:self-host:prod
- `npm run release:gate:strict` same as above + require backend health

## 10) Testing Strategy

Automated:
- Unit/component tests via Vitest
- API/route smoke tests via `scripts/smoke.mjs`
- Release gate checks for lint/type/build/smoke

Manual:
- Use `docs/qa-manual-checklist.md` for full regression
- Use `docs/qa-smoke.md` for smoke-level validation

Recommended pre-release command sequence:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
npm.cmd run smoke:self-host:prod
```

## 11) Route Overview

Core pages:
- `/` entry/home
- `/requests/new/building`
- `/requests/new/vehicle`
- `/requests/new/messenger`
- `/requests/new/document`
- `/requests/success/[requestNo]`
- `/auth/otp`
- `/my-requests`
- `/my-requests/[id]`
- `/my-notifications`
- `/messenger/link/[token]`
- `/admin/login`
- `/admin`
- `/admin/requests`
- `/admin/requests/[id]`
- `/admin/settings`
- `/admin/audit`
- `/admin/notifications`
- `/unauthorized`

Full map:
- `docs/route-map.md`

Page-to-API mapping:
- `docs/page-api-checklist.md`

## 12) Deployment (Frontend)

### 12.1 Build and verify

```powershell
cd frontend
npm.cmd install
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test
npm.cmd run build
```

### 12.2 Deploy target

Deploy to Vercel (recommended for Next.js) or compatible platform.

Set environment variables from:
- `frontend/.env.deploy.example`

After deployment, verify:
- public form routes load
- OTP flow works
- protected routes redirect correctly when unauthorized
- admin pages can call backend via proxy
- attachment preview/download works with CSP

## 13) Troubleshooting

### 13.1 Upload preview blocked by browser policy

Symptoms:
- media/image/frame blocked in console

Checks:
- backend CORS is correct
- `FRONTEND_CSP_CONNECT_SRC` includes backend/storage
- `FRONTEND_CSP_IMG_SRC` includes image source
- `FRONTEND_CSP_MEDIA_SRC` includes video/audio source
- `FRONTEND_CSP_FRAME_SRC` includes embedded preview source

### 13.2 API calls go to wrong backend

Checks:
- `BACKEND_API_BASE_URL`
- `NEXT_PUBLIC_API_BASE_URL`
- ensure both point to intended environment

### 13.3 Session loops to login

Checks:
- backend auth endpoints reachable
- cookie settings on deployed domain
- route guard session validation result (`401` vs `403`)

### 13.4 Smoke test fails on protected routes

The smoke script already accepts expected redirects for protected routes.
If still failing, verify:
- route path in `scripts/smoke.mjs`
- login redirect target
- base URL env values

### 13.5 `spawn EPERM` in constrained runtime

Some test/smoke runs may fail in restricted shell environments.
Use:
- elevated terminal
- self-host smoke mode
- CI runner without local process spawn restrictions

## 14) Related Documentation

- `docs/route-map.md`
- `docs/page-api-checklist.md`
- `docs/qa-smoke.md`
- `docs/qa-manual-checklist.md`
- `docs/ui-phases.md`

## 15) Ownership

- Primary owner: Frontend Engineering team
- Secondary owner: Platform/QA collaboration
- Update this README when:
- adding/removing env variables
- changing auth/session behavior
- changing smoke/release gate logic
- adding/removing major routes
