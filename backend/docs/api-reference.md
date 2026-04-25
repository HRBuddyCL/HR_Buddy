# HR-Buddy Backend API Reference

Last updated: 2026-03-10

This file documents the API endpoints currently implemented in `backend/src`.

## 1) Authentication Model

| Access mode               | How to send token                                                            | Used by                                                 |
| ------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| Public                    | No token                                                                     | health, reference, geo, OTP send/verify, request create |
| Employee session          | `Authorization: Bearer <employeeSessionToken>` or `x-employee-session-token` | employee request/attachment/notification endpoints      |
| Admin session             | `Authorization: Bearer <adminSessionToken>` or `x-admin-session-token`       | admin endpoints                                         |
| Messenger token           | `Authorization: Bearer <messengerToken>` or `x-messenger-token`              | messenger link endpoints                                |
| Health token (production) | `x-health-token`                                                             | `/health/db`, `/health/ready` in production mode        |

## 2) Response and Error Shape

- Domain/business errors usually return:

```json
{
  "statusCode": 400,
  "code": "SOME_ERROR_CODE",
  "message": "Human-readable message"
}
```

- DTO validation errors usually return:

```json
{
  "statusCode": 400,
  "message": ["field must be ..."],
  "error": "Bad Request"
}
```

For full error catalog, see `backend/docs/error-contract.md`.

## 3) Health Endpoints

| Method | Path            | Auth                                                     | Purpose                          | Key input                            |
| ------ | --------------- | -------------------------------------------------------- | -------------------------------- | ------------------------------------ |
| GET    | `/health`       | Public                                                   | Basic liveness check             | -                                    |
| GET    | `/health/db`    | Public in non-production, `x-health-token` in production | DB connectivity check            | `x-health-token` header (production) |
| GET    | `/health/ready` | Public in non-production, `x-health-token` in production | Readiness check for dependencies | `x-health-token` header (production) |

## 4) OTP Endpoints

| Method | Path               | Auth   | Purpose                                     | Key input                   |
| ------ | ------------------ | ------ | ------------------------------------------- | --------------------------- |
| POST   | `/auth-otp/send`   | Public | Send OTP for employee self-access           | `phone`, `email`            |
| POST   | `/auth-otp/verify` | Public | Verify OTP and issue employee session token | `phone`, `email`, `otpCode` |

Request DTOs:

- `backend/src/modules/auth-otp/dto/send-otp.dto.ts`
- `backend/src/modules/auth-otp/dto/verify-otp.dto.ts`

## 5) Request Creation (Public)

| Method | Path                  | Auth   | Purpose                          | Key input                                                                                                                                     |
| ------ | --------------------- | ------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/requests/building`  | Public | Create building repair request   | `employeeName`, `departmentId`, `phone`, `urgency`, `building`, `floor`, `locationDetail`, `problemCategoryId`, `description`                 |
| POST   | `/requests/vehicle`   | Public | Create vehicle repair request    | `employeeName`, `departmentId`, `phone`, `urgency`, `vehiclePlate`, `issueCategoryId`, `symptom`                                              |
| POST   | `/requests/messenger` | Public | Create messenger booking request | `employeeName`, `departmentId`, `phone`, `urgency`, `pickupDatetime`, `itemType`, `itemDescription`, `outsideBkkMetro`, `sender`, `receiver`  |
| POST   | `/requests/document`  | Public | Create document request          | `employeeName`, `departmentId`, `phone`, `urgency`, `siteNameRaw`, `documentDescription`, `purpose`, `deliveryMethod` (`neededDate` optional) |

Request DTOs:

- `backend/src/modules/requests/dto/create-building-request.dto.ts`
- `backend/src/modules/requests/dto/create-vehicle-request.dto.ts`
- `backend/src/modules/requests/dto/create-messenger-request.dto.ts`
- `backend/src/modules/requests/dto/create-document-request.dto.ts`

## 6) Employee Session Endpoints

| Method | Path                                                   | Auth             | Purpose                                     | Key input                                                                    |
| ------ | ------------------------------------------------------ | ---------------- | ------------------------------------------- | ---------------------------------------------------------------------------- |
| GET    | `/requests/my`                                         | Employee session | List employee requests                      | Query: `type`, `status`, `q`, `sortBy`, `sortOrder`, `page`, `limit`         |
| GET    | `/requests/:id`                                        | Employee session | Get request detail                          | Path `id`                                                                    |
| PATCH  | `/requests/:id/cancel`                                 | Employee session | Cancel request                              | Path `id`, body `reason`                                                     |
| POST   | `/requests/:id/attachments/presign`                    | Employee session | Generate upload ticket/presigned upload URL | Path `id`, body `fileKind`, `fileName`, `mimeType`, `fileSize`               |
| POST   | `/requests/:id/attachments/complete`                   | Employee session | Confirm uploaded file by token              | Path `id`, body `uploadToken`                                                |
| GET    | `/requests/:id/attachments/:attachmentId/download-url` | Employee session | Generate attachment download URL            | Path `id`, `attachmentId`                                                    |
| POST   | `/requests/:id/attachments`                            | Employee session | Legacy direct attachment record create      | Path `id`, body `fileKind`, `fileName`, `mimeType`, `fileSize`, `storageKey` |
| GET    | `/notifications/my`                                    | Employee session | List employee notifications                 | Query: `isRead`, `eventType`, `page`, `limit`                                |
| PATCH  | `/notifications/my/:id/read`                           | Employee session | Mark single notification as read            | Path `id`                                                                    |
| PATCH  | `/notifications/my/read-all`                           | Employee session | Mark all employee notifications as read     | -                                                                            |

Request DTOs:

- `backend/src/modules/requests/dto/my-requests.query.dto.ts`
- `backend/src/modules/requests/dto/cancel-request.dto.ts`
- `backend/src/modules/attachments/dto/create-attachment-upload-ticket.dto.ts`
- `backend/src/modules/attachments/dto/complete-attachment-upload.dto.ts`
- `backend/src/modules/attachments/dto/create-attachment.dto.ts`
- `backend/src/modules/notifications/dto/notification-list.query.dto.ts`

## 7) Messenger Link Endpoints

| Method | Path                             | Auth            | Purpose                                 | Key input                      |
| ------ | -------------------------------- | --------------- | --------------------------------------- | ------------------------------ |
| GET    | `/messenger/link`                | Messenger token | Read request info from magic link token | Token header or bearer token   |
| PATCH  | `/messenger/link/status`         | Messenger token | Update messenger request status         | Body `status`, optional `note` |
| POST   | `/messenger/link/report-problem` | Messenger token | Report problem from messenger           | Body `note`                    |
| POST   | `/messenger/link/pickup-event`   | Messenger token | Record pickup event (non-status event)  | Optional `note`                |

Request DTOs:

- `backend/src/modules/messenger/dto/messenger-status-update.dto.ts`
- `backend/src/modules/messenger/dto/messenger-problem-report.dto.ts`
- `backend/src/modules/messenger/dto/messenger-pickup-event.dto.ts`

## 8) Admin Auth Endpoints

| Method | Path                 | Auth          | Purpose                                   | Key input              |
| ------ | -------------------- | ------------- | ----------------------------------------- | ---------------------- |
| POST   | `/admin/auth/login`  | Public        | Login admin and issue admin session token | `username`, `password` |
| POST   | `/admin/auth/logout` | Admin session | Revoke current admin session              | Admin token            |
| GET    | `/admin/auth/me`     | Admin session | Get current admin session info            | Admin token            |

Request DTO:

- `backend/src/modules/admin-auth/dto/admin-login.dto.ts`

## 9) Admin Request Management

| Method | Path                                                         | Auth          | Purpose                                      | Key input                                                                                                           |
| ------ | ------------------------------------------------------------ | ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/requests`                                            | Admin session | List requests with filters                   | Query: `type`, `status`, `createdDateFrom`, `createdDateTo`, `closedDateFrom`, `closedDateTo`, `q`, `page`, `limit` |
| GET    | `/admin/requests/report/summary`                             | Admin session | Summary report for dashboard                 | Query: `type`, `status`, `createdDateFrom`, `createdDateTo`, `closedDateFrom`, `closedDateTo`, `q`                  |
| GET    | `/admin/requests/export/csv`                                 | Admin session | Export request list as CSV                   | Query: filter fields + `limit` (max 5000)                                                                           |
| GET    | `/admin/requests/:id`                                        | Admin session | Get request detail for admin                 | Path `id`                                                                                                           |
| PATCH  | `/admin/requests/:id/status`                                 | Admin session | Change request status                        | Path `id`, body `status`, `operatorId`, optional `note`, `pickupNote`, `digitalFileAttachmentId`                    |
| POST   | `/admin/requests/:id/attachments/presign`                    | Admin session | Generate admin upload ticket/presigned URL   | Path `id`, body `fileKind`, `fileName`, `mimeType`, `fileSize`                                                      |
| POST   | `/admin/requests/:id/attachments/complete`                   | Admin session | Confirm admin upload by token                | Path `id`, body `uploadToken`                                                                                       |
| GET    | `/admin/requests/:id/attachments/:attachmentId/download-url` | Admin session | Generate admin attachment download URL       | Path `id`, `attachmentId`                                                                                           |
| POST   | `/admin/requests/:id/attachments`                            | Admin session | Legacy direct admin attachment record create | Path `id`, body `fileKind`, `fileName`, `mimeType`, `fileSize`, `storageKey`                                        |

Request DTOs:

- `backend/src/modules/admin-requests/dto/admin-request-action.dto.ts`
- `backend/src/modules/admin-requests/dto/admin-requests.query.dto.ts`
- `backend/src/modules/admin-requests/dto/admin-requests-report.query.dto.ts`
- `backend/src/modules/admin-requests/dto/admin-requests-export.query.dto.ts`

## 10) Admin Settings (Master Data)

| Method | Path                                           | Auth          | Purpose                       | Key input                                                 |
| ------ | ---------------------------------------------- | ------------- | ----------------------------- | --------------------------------------------------------- |
| GET    | `/admin/settings/departments`                  | Admin session | List departments              | Query `isActive`, `q`                                     |
| POST   | `/admin/settings/departments`                  | Admin session | Create department             | Body `name`, optional `isActive`                          |
| PATCH  | `/admin/settings/departments/:id`              | Admin session | Update department             | Path `id`, body optional `name`, `isActive`               |
| DELETE | `/admin/settings/departments/:id`              | Admin session | Delete department             | Path `id`                                                  |
| GET    | `/admin/settings/problem-categories`           | Admin session | List problem categories       | Query `isActive`, `q`                                     |
| POST   | `/admin/settings/problem-categories`           | Admin session | Create problem category       | Body `name`, optional `helperText`, `isActive`            |
| PATCH  | `/admin/settings/problem-categories/:id`       | Admin session | Update problem category       | Path `id`, body optional `name`, `helperText`, `isActive` |
| DELETE | `/admin/settings/problem-categories/:id`       | Admin session | Delete problem category       | Path `id`                                                  |
| GET    | `/admin/settings/vehicle-issue-categories`     | Admin session | List vehicle issue categories | Query `isActive`, `q`                                     |
| POST   | `/admin/settings/vehicle-issue-categories`     | Admin session | Create vehicle issue category | Body `name`, optional `isActive`                          |
| PATCH  | `/admin/settings/vehicle-issue-categories/:id` | Admin session | Update vehicle issue category | Path `id`, body optional `name`, `isActive`               |
| DELETE | `/admin/settings/vehicle-issue-categories/:id` | Admin session | Delete vehicle issue category | Path `id`                                                  |
| GET    | `/admin/settings/operators`                    | Admin session | List operators                | Query `isActive`, `q`                                     |
| POST   | `/admin/settings/operators`                    | Admin session | Create operator               | Body `displayName`, optional `isActive`                   |
| PATCH  | `/admin/settings/operators/:id`                | Admin session | Update operator               | Path `id`, body optional `displayName`, `isActive`        |
| DELETE | `/admin/settings/operators/:id`                | Admin session | Delete operator               | Path `id`                                                  |

## 11) Admin Audit Endpoints

| Method | Path                                    | Auth          | Purpose                  | Key input                                                                                                        |
| ------ | --------------------------------------- | ------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| GET    | `/admin/audit/activity-logs`            | Admin session | List audit/activity logs | Query: `action`, `actorRole`, `operatorId`, `requestId`, `requestNo`, `dateFrom`, `dateTo`, `q`, `page`, `limit` |
| GET    | `/admin/audit/activity-logs/export/csv` | Admin session | Export audit logs as CSV | Query: same filters + `limit` (max 10000)                                                                        |

## 12) Admin Notifications Endpoints

| Method | Path                            | Auth          | Purpose                                | Key input                                     |
| ------ | ------------------------------- | ------------- | -------------------------------------- | --------------------------------------------- |
| GET    | `/admin/notifications`          | Admin session | List admin notifications               | Query: `isRead`, `eventType`, `page`, `limit` |
| PATCH  | `/admin/notifications/:id/read` | Admin session | Mark single admin notification as read | Path `id`                                     |
| PATCH  | `/admin/notifications/read-all` | Admin session | Mark all admin notifications as read   | -                                             |

## 13) Maintenance / PDPA Endpoints

| Method | Path                                             | Auth          | Purpose                                                | Key input                                     |
| ------ | ------------------------------------------------ | ------------- | ------------------------------------------------------ | --------------------------------------------- |
| POST   | `/admin/maintenance/retention/run`               | Admin session | Trigger retention purge manually                       | -                                             |
| POST   | `/admin/maintenance/pdpa/requests/:id/anonymize` | Admin session | Anonymize one eligible request                         | Path `id`, body `operatorId`, `reason`        |
| POST   | `/admin/maintenance/pdpa/subjects/anonymize`     | Admin session | Anonymize eligible requests by subject (`phone+email`) | Body `operatorId`, `phone`, `email`, `reason` |

Request DTOs:

- `backend/src/modules/maintenance/dto/anonymize-request.dto.ts`
- `backend/src/modules/maintenance/dto/anonymize-subject.dto.ts`

## 14) Public Reference Endpoints

| Method | Path                                  | Auth   | Purpose                          | Key input             |
| ------ | ------------------------------------- | ------ | -------------------------------- | --------------------- |
| GET    | `/reference/departments`              | Public | List departments for forms       | Query `isActive`, `q` |
| GET    | `/reference/problem-categories`       | Public | List building problem categories | Query `isActive`, `q` |
| GET    | `/reference/vehicle-issue-categories` | Public | List vehicle issue categories    | Query `isActive`, `q` |
| GET    | `/reference/operators`                | Public | List operators (if needed in UI) | Query `isActive`, `q` |

## 15) Public Geo Endpoints

| Method | Path                | Auth   | Purpose                                              | Key input                                              |
| ------ | ------------------- | ------ | ---------------------------------------------------- | ------------------------------------------------------ |
| GET    | `/geo/provinces`    | Public | List provinces                                       | -                                                      |
| GET    | `/geo/districts`    | Public | List districts in province                           | Query `province` (required)                            |
| GET    | `/geo/subdistricts` | Public | List subdistricts in province+district               | Query `province`, `district` (required)                |
| GET    | `/geo/postal-code`  | Public | Resolve postal code by province+district+subdistrict | Query `province`, `district`, `subdistrict` (required) |

## 16) Local Mock Attachment Storage (Dev/Internal)

These routes are for local mock storage provider in non-production only.

| Method | Path                                 | Auth                                                       | Purpose                                 | Key input                                                              |
| ------ | ------------------------------------ | ---------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| PUT    | `/storage/mock/upload/:storageKey`   | Presigned query signature + loopback-only + local provider | Upload binary to local mock storage     | Path `storageKey`, query `expiresAt`, `signature`, request body bytes  |
| GET    | `/storage/mock/download/:storageKey` | Presigned query signature + loopback-only + local provider | Download binary from local mock storage | Path `storageKey`, query `expiresAt`, `signature`, optional `fileName` |

## 17) Notes for Frontend Integration

- Employee token can be sent with either:
  - `Authorization: Bearer <token>`
  - `x-employee-session-token: <token>`
- Admin token can be sent with either:
  - `Authorization: Bearer <token>`
  - `x-admin-session-token: <token>`
- Messenger token can be sent with either:
  - `Authorization: Bearer <token>`
  - `x-messenger-token: <token>`
- In production, health endpoints may require `x-health-token` depending on runtime config.

## 18) Source of Truth

This document summarizes current implementation. Source of truth is controller/DTO code in:

- `backend/src/modules/**/` and `backend/src/app.controller.ts`

If endpoint contracts change, update this file in the same PR.
