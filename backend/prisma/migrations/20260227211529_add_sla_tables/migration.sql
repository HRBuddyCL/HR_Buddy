-- CreateEnum
CREATE TYPE "SlaStatus" AS ENUM ('ON_TRACK', 'NEAR_BREACH', 'OVERDUE');

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "request_type" "RequestType" NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "start_within_minutes" INTEGER NOT NULL,
    "resolve_within_minutes" INTEGER NOT NULL,
    "yellow_threshold_percent" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_sla" (
    "request_id" TEXT NOT NULL,
    "sla_start_at" TIMESTAMP(3) NOT NULL,
    "sla_due_at" TIMESTAMP(3) NOT NULL,
    "sla_status" "SlaStatus" NOT NULL,
    "last_calculated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_sla_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "sla_policies_request_type_urgency_is_active_idx" ON "sla_policies"("request_type", "urgency", "is_active");

-- CreateIndex
CREATE INDEX "request_sla_sla_status_sla_due_at_idx" ON "request_sla"("sla_status", "sla_due_at");

-- AddForeignKey
ALTER TABLE "request_sla" ADD CONSTRAINT "request_sla_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
