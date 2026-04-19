ALTER TABLE "otp_sessions"
ADD COLUMN "blocked_until" TIMESTAMP(3);

CREATE INDEX "otp_sessions_blocked_until_idx"
ON "otp_sessions"("blocked_until");
