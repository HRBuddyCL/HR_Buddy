-- CreateTable
CREATE TABLE "otp_sessions" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp_code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_access_sessions" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "session_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_access_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_sessions_phone_email_created_at_idx" ON "otp_sessions"("phone", "email", "created_at");

-- CreateIndex
CREATE INDEX "otp_sessions_expires_at_idx" ON "otp_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "employee_access_sessions_phone_email_expires_at_idx" ON "employee_access_sessions"("phone", "email", "expires_at");

-- CreateIndex
CREATE INDEX "employee_access_sessions_expires_at_idx" ON "employee_access_sessions"("expires_at");
