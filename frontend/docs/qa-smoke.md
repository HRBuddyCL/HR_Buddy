# Frontend Smoke Test

This smoke script checks that core frontend routes are reachable and return HTML.

## Commands

- `npm run smoke`
  - Checks an already-running frontend instance.
  - Default target: `http://127.0.0.1:3000`
  - Override with env: `FRONTEND_SMOKE_BASE_URL`

- `npm run smoke:self-host`
  - Starts frontend **dev** server and runs route checks.
  - Uses `FRONTEND_SMOKE_HOST` (default `127.0.0.1`) and `FRONTEND_SMOKE_PORT` (default `3105`).

- `npm run smoke:self-host:prod`
  - Starts frontend **production** server (`next start`) and runs route checks.
  - Requires a successful `npm run build` first.

- `npm run smoke:strict`
  - Same as `npm run smoke` but API health (`NEXT_PUBLIC_API_BASE_URL/health`) is required.

- `npm run release:gate`
  - Runs lint + typecheck + build + smoke:self-host:prod.

- `npm run release:gate:strict`
  - Same as release gate and requires backend health check.

## Useful Env Options

- `SMOKE_ROUTE_TIMEOUT_MS` (default `15000`)
- `SMOKE_ROUTE_RETRIES` (default `2`)
- `SMOKE_ROUTE_RETRY_DELAY_MS` (default `500`)
- `SMOKE_SERVER_READY_TIMEOUT_MS` (default `120000`)
- `SMOKE_API_TIMEOUT_MS` (default `7000`)
- `SMOKE_REQUIRE_API` (`true`/`false`)

## Notes

- Smoke validates route availability only (smoke level), not full business interactions.
- If backend is down, `npm run smoke` can pass and prints API warning.
- `smoke:strict` and `release:gate:strict` should be used before release sign-off.
- In constrained environments, process spawning can fail (`spawn EPERM`); rerun outside sandbox or use an already running server.

See also: `qa-manual-checklist.md` for full regression coverage.
