# Manual QA Checklist

Last updated: 2026-03-10

This checklist is for full regression before staging/production deploy.
Use together with `npm run smoke`.

## 1) Test setup

- Frontend env is set (`NEXT_PUBLIC_API_BASE_URL` points to target backend).
- Backend is running with migration completed.
- Seed/reference data exists (departments, categories, operators).
- Test accounts/tokens are ready:
  - Employee OTP inbox access.
  - Admin username/password.
  - One valid messenger magic link token.
- Browser cache/local storage is cleared before first run.

## 2) Employee create flow

### 2.1 Building request
- [ ] Open `/requests/new/building` and submit valid data.
- [ ] Success page shows request number.
- [ ] Required field validation blocks empty required fields.
- [ ] `other` category requires text.

### 2.2 Vehicle request
- [ ] Open `/requests/new/vehicle` and submit valid data.
- [ ] Success page shows request number.
- [ ] Required field validation works.
- [ ] `other` issue category requires text.

### 2.3 Messenger request
- [ ] Open `/requests/new/messenger` and submit valid data.
- [ ] Geo dropdown works in order: province -> district -> subdistrict -> postal code.
- [ ] If outside BKK metro = true, delivery service is required.
- [ ] If delivery service = OTHER, `deliveryServiceOther` is required.

### 2.4 Document request
- [ ] Open `/requests/new/document` and submit DIGITAL method.
- [ ] Open `/requests/new/document` and submit PICKUP method.
- [ ] Open `/requests/new/document` and submit POSTAL method.
- [ ] POSTAL requires full delivery address.
- [ ] DIGITAL/PICKUP must not send delivery address.

## 3) OTP and my requests flow

### 3.1 OTP gate
- [ ] `POST /auth-otp/send` flow works from UI.
- [ ] `POST /auth-otp/verify` flow works from UI.
- [ ] Invalid OTP shows clear error.
- [ ] Missing token redirects to `/auth/otp` from guarded pages.

### 3.2 My requests list
- [ ] `/my-requests` loads list after OTP verify.
- [ ] Filter by type/status works.
- [ ] Search works.
- [ ] Pagination works.
- [ ] Notifications list and `mark all read` work.

### 3.3 My request detail
- [ ] `/my-requests/[id]` shows service detail, attachments, and timeline.
- [ ] Cancel works only for NEW/APPROVED.
- [ ] Cancel reason required.
- [ ] Attachment upload flow works (presign -> upload -> complete).
- [ ] Uploaded file appears in attachment list.
- [ ] Attachment download URL works.

## 4) Messenger magic link flow

- [ ] `/messenger/link/[token]` loads request from token header.
- [ ] Status transition APPROVED -> IN_TRANSIT works.
- [ ] Status transition IN_TRANSIT -> DONE works.
- [ ] Pickup event submit works.
- [ ] Report problem submit works and requires note.
- [ ] Expired/invalid token shows safe error message.

## 5) Admin flow

### 5.1 Admin login/dashboard
- [ ] `/admin/login` authenticates valid credentials.
- [ ] Invalid credentials show clear error.
- [ ] `/admin` dashboard summary renders counts.
- [ ] Admin notifications load and mark-read works.

### 5.2 Admin requests table
- [ ] `/admin/requests` list loads.
- [ ] Filter/search/date-range works.
- [ ] CSV export works.

### 5.3 Admin request detail
- [ ] `/admin/requests/[id]` loads all detail sections.
- [ ] Allowed status transitions only.
- [ ] Operator is required when status updates.
- [ ] Document DONE guard works:
  - DIGITAL requires digital file attachment id.
  - PICKUP requires pickup note.
- [ ] Admin attachment upload works (presign -> upload -> complete).
- [ ] Admin attachment download works.

### 5.4 Admin settings
- [ ] `/admin/settings` loads all master data blocks.
- [ ] Create/update department works.
- [ ] Create/update problem category works.
- [ ] Create/update vehicle issue category works.
- [ ] Create/update operator works.

### 5.5 Admin audit
- [ ] `/admin/audit` activity log list loads.
- [ ] Filter by date/action/actor works.
- [ ] CSV export works.

## 6) Non-functional checks

### 6.1 Responsive
- [ ] Mobile width (360-430px) all key pages usable.
- [ ] Tablet width (768px) all key pages usable.
- [ ] Desktop width (>=1280px) all key pages usable.

### 6.2 Accessibility basics
- [ ] All inputs have visible labels.
- [ ] Keyboard-only navigation works on forms and actions.
- [ ] Focus styles are visible.
- [ ] Color contrast is readable on badges/messages.

### 6.3 Error handling
- [ ] API 4xx errors show useful messages.
- [ ] API 5xx errors show fallback messages.
- [ ] Loading states appear during async actions.
- [ ] Empty states are clear (no data/no notifications/no attachments).

## 7) Exit criteria

Release candidate is ready when:
- [ ] No blocker or critical bugs remain.
- [ ] All checklist items above pass.
- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run release:gate:strict` passes in target environment.

## 8) Bug report format

Use this format when a case fails:

- Case: (example: 3.3 Attachment upload)
- Environment: (local/staging + browser)
- Steps:
  1. ...
  2. ...
  3. ...
- Actual result:
- Expected result:
- Error message / screenshot:
- Severity: blocker | critical | major | minor

