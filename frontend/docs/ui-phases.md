# UI Implementation Phases

Last updated: 2026-03-10

## Phase 1 - Foundation

Scope:
- App shell and base layout
- Shared components (form fields, button, alert, badge, table, modal)
- API client setup and typed service layer
- Token storage strategy per role (employee/admin/messenger)
- Error/loading/empty states standardization

Definition of done:
- Shared UI primitives ready for all major pages
- API client supports auth header injection
- App can switch environment URL safely

## Phase 2 - Employee Create Request Flow

Scope:
- `/`
- `/requests/new/building`
- `/requests/new/vehicle`
- `/requests/new/messenger`
- `/requests/new/document`
- `/requests/success/[requestNo]`

Definition of done:
- Four request forms submit successfully
- Field validation and user guidance are complete
- Success page receives and displays request number

## Phase 3 - OTP and Tracking Flow

Scope:
- `/auth/otp`
- `/my-requests`
- `/my-requests/[id]`

Definition of done:
- OTP send/verify works end-to-end
- Employee token persists and expires correctly
- Request detail supports cancel and attachments

## Phase 4 - Messenger Flow

Scope:
- `/messenger/link/[token]`

Definition of done:
- Magic link token resolves request context
- Messenger can update status, report issue, and send pickup event

## Phase 5 - Admin Core Flow

Scope:
- `/admin/login`
- `/admin`
- `/admin/requests`
- `/admin/requests/[id]`

Definition of done:
- Admin login/logout/me are functional
- Dashboard summary renders correctly
- Admin can update status with operator selection

## Phase 6 - Admin Settings and Audit

Scope:
- `/admin/settings`
- `/admin/audit`

Definition of done:
- CRUD-like flows for master data are working
- Audit filters and CSV export are usable

## Phase 7 - QA and Polish

Scope:
- Responsive layout pass (mobile/tablet/desktop)
- Accessibility and keyboard navigation
- Error boundary and edge-case validation
- End-to-end sanity tests for core journeys

Definition of done:
- Zero P0/P1 UI defects in core paths
- Core journeys tested with real backend responses
