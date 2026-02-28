-- CreateEnum
CREATE TYPE "RecipientRole" AS ENUM ('EMPLOYEE', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationEventType" AS ENUM ('APPROVED', 'REJECTED', 'DONE', 'CANCELED', 'SLA_NEAR', 'SLA_OVERDUE', 'MESSENGER_BOOKED', 'PROBLEM_REPORTED');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "recipient_role" "RecipientRole" NOT NULL,
    "recipient_phone" TEXT,
    "request_id" TEXT,
    "event_type" "NotificationEventType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notifications_recipient_role_is_read_created_at_idx" ON "notifications"("recipient_role", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_phone_is_read_created_at_idx" ON "notifications"("recipient_phone", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "notifications_request_id_created_at_idx" ON "notifications"("request_id", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
