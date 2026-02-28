-- 1) ถ้า ADMIN ต้องมี operator_id ใน activity log
ALTER TABLE "request_activity_logs"
ADD CONSTRAINT "chk_admin_operator_required"
CHECK ("actor_role" <> 'ADMIN' OR "operator_id" IS NOT NULL);

-- 2) ปิดงานแล้วต้องมี closed_at
ALTER TABLE "requests"
ADD CONSTRAINT "chk_closed_at_when_closed"
CHECK (
  "status" NOT IN ('DONE','REJECTED','CANCELED')
  OR "closed_at" IS NOT NULL
);

-- 3) ถ้า cancel แล้วต้องมี cancel_reason
ALTER TABLE "requests"
ADD CONSTRAINT "chk_cancel_reason_when_canceled"
CHECK ("status" <> 'CANCELED' OR "cancel_reason" IS NOT NULL);