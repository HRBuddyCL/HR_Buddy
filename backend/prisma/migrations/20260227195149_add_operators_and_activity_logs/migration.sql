-- CreateEnum
CREATE TYPE "ActorRole" AS ENUM ('EMPLOYEE', 'ADMIN', 'MESSENGER');

-- CreateEnum
CREATE TYPE "ActivityAction" AS ENUM ('CREATE', 'APPROVE', 'REJECT', 'STATUS_CHANGE', 'CANCEL', 'UPLOAD_ATTACHMENT', 'REPORT_PROBLEM', 'MESSENGER_PICKUP_EVENT');

-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_activity_logs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "action" "ActivityAction" NOT NULL,
    "from_status" "RequestStatus",
    "to_status" "RequestStatus",
    "note" TEXT,
    "actor_role" "ActorRole" NOT NULL,
    "operator_id" TEXT,
    "actor_display_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_activity_logs_request_id_created_at_idx" ON "request_activity_logs"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "request_activity_logs_operator_id_created_at_idx" ON "request_activity_logs"("operator_id", "created_at");

-- AddForeignKey
ALTER TABLE "request_activity_logs" ADD CONSTRAINT "request_activity_logs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_activity_logs" ADD CONSTRAINT "request_activity_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;
