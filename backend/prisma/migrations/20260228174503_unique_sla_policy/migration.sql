/*
  Warnings:

  - A unique constraint covering the columns `[request_type,urgency,is_active]` on the table `sla_policies` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_request_type_urgency_is_active_key" ON "sla_policies"("request_type", "urgency", "is_active");
