# Frontend Smoke Test

This smoke script checks that core frontend routes are reachable and return HTML.

## Commands

- `npm run smoke`
  - Checks an already-running frontend instance.
  - Default target: `http://127.0.0.1:3000`
  - Override with env: `FRONTEND_SMOKE_BASE_URL`

- `npm run smoke:self-host`
  - Starts frontend dev server and runs route checks.
  - Uses `FRONTEND_SMOKE_HOST` (default `127.0.0.1`) and `FRONTEND_SMOKE_PORT` (default `3105`).

- `npm run smoke:strict`
  - Same as `npm run smoke` but API health (`NEXT_PUBLIC_API_BASE_URL/health`) is required.

## Notes

- The script validates route availability only (smoke level), not full user interactions.
- If backend is down, `npm run smoke` still passes route checks and prints an API warning.
- In constrained environments where process spawning is blocked, `smoke:self-host` may fail; use `smoke` against an existing running frontend.


See also: qa-manual-checklist.md for full regression coverage beyond route smoke checks.

