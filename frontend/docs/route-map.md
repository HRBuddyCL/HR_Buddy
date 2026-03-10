# Frontend Route Map

Last updated: 2026-03-10

This route map is aligned with backend API contracts in `D:\HR-buddy\backend\docs\api-reference.md`.

| URL Path | User Role | Purpose | Phase |
|---|---|---|---|
| `/` | Public | Entry page and service chooser | 2 |
| `/requests/new/building` | Public | Building repair request form | 2 |
| `/requests/new/vehicle` | Public | Vehicle repair request form | 2 |
| `/requests/new/messenger` | Public | Messenger booking request form | 2 |
| `/requests/new/document` | Public | Document request form | 2 |
| `/requests/success/[requestNo]` | Public | Success confirmation | 2 |
| `/auth/otp` | Public | OTP send and verify | 3 |
| `/my-requests` | Employee session | List own requests | 3 |
| `/my-requests/[id]` | Employee session | Request detail and actions | 3 |
| `/messenger/link/[token]` | Messenger token | Messenger status update via magic link | 4 |
| `/admin/login` | Public | Admin login | 5 |
| `/admin` | Admin session | Dashboard summary and SLA overview | 5 |
| `/admin/requests` | Admin session | Request management table | 5 |
| `/admin/requests/[id]` | Admin session | Request detail + status actions | 5 |
| `/admin/settings` | Admin session | Master data management | 6 |
| `/admin/audit` | Admin session | Activity logs and CSV export | 6 |

## Route guard notes

- Employee pages require employee session token from OTP flow.
- Admin pages require admin session token.
- Messenger page requires messenger token from magic link.
- Health endpoints are backend-only and not a frontend page.
