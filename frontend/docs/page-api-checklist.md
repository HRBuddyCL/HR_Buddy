# Page-to-API Checklist

Last updated: 2026-03-10

Use this file as implementation checklist when wiring each frontend page.

## Employee/public pages

| Page | API calls |
|---|---|
| `/` | (optional) `GET /reference/departments`, `GET /reference/problem-categories`, `GET /reference/vehicle-issue-categories` for preload |
| `/requests/new/building` | `GET /reference/departments`, `GET /reference/problem-categories`, `POST /requests/building` |
| `/requests/new/vehicle` | `GET /reference/departments`, `GET /reference/vehicle-issue-categories`, `POST /requests/vehicle` |
| `/requests/new/messenger` | `GET /reference/departments`, `GET /geo/provinces`, `GET /geo/districts`, `GET /geo/subdistricts`, `GET /geo/postal-code`, `POST /requests/messenger` |
| `/requests/new/document` | `GET /reference/departments`, `POST /requests/document` |
| `/requests/success/[requestNo]` | No API required (display param + next action links) |
| `/auth/otp` | `POST /auth-otp/send`, `POST /auth-otp/verify` |
| `/my-requests` | `GET /requests/my`, `GET /notifications/my`, `PATCH /notifications/my/read-all`, `PATCH /notifications/my/:id/read` |
| `/my-requests/[id]` | `GET /requests/:id`, `PATCH /requests/:id/cancel`, `POST /requests/:id/attachments/presign`, `POST /requests/:id/attachments/complete`, `GET /requests/:id/attachments/:attachmentId/download-url` |

## Messenger page

| Page | API calls |
|---|---|
| `/messenger/link/[token]` | `GET /messenger/link`, `PATCH /messenger/link/status`, `POST /messenger/link/pickup-event`, `POST /messenger/link/report-problem` |

## Admin pages

| Page | API calls |
|---|---|
| `/admin/login` | `POST /admin/auth/login` |
| `/admin` | `GET /admin/requests/report/summary`, `GET /admin/notifications`, `PATCH /admin/notifications/:id/read`, `PATCH /admin/notifications/read-all` |
| `/admin/requests` | `GET /admin/requests`, `GET /admin/requests/export/csv` |
| `/admin/requests/[id]` | `GET /admin/requests/:id`, `PATCH /admin/requests/:id/status`, `POST /admin/requests/:id/attachments/presign`, `POST /admin/requests/:id/attachments/complete`, `GET /admin/requests/:id/attachments/:attachmentId/download-url` |
| `/admin/settings` | `GET/POST/PATCH /admin/settings/departments`, `GET/POST/PATCH /admin/settings/problem-categories`, `GET/POST/PATCH /admin/settings/vehicle-issue-categories`, `GET/POST/PATCH /admin/settings/operators` |
| `/admin/audit` | `GET /admin/audit/activity-logs`, `GET /admin/audit/activity-logs/export/csv` |

## Implementation notes

- Employee token: use `Authorization: Bearer <employeeToken>` or `x-employee-session-token`.
- Admin token: use `Authorization: Bearer <adminToken>` or `x-admin-session-token`.
- Messenger token: use `Authorization: Bearer <messengerToken>` or `x-messenger-token`.
- For file upload flows, call `presign` first, upload to returned URL, then call `complete`.
