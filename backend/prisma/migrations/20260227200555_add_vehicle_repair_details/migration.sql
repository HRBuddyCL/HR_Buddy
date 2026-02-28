-- CreateTable
CREATE TABLE "vehicle_repair_details" (
    "request_id" TEXT NOT NULL,
    "vehicle_plate" TEXT NOT NULL,
    "issue_category_id" TEXT NOT NULL,
    "issue_category_other" TEXT,
    "symptom" TEXT NOT NULL,
    "additional_details" TEXT,

    CONSTRAINT "vehicle_repair_details_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "vehicle_repair_details_issue_category_id_idx" ON "vehicle_repair_details"("issue_category_id");

-- AddForeignKey
ALTER TABLE "vehicle_repair_details" ADD CONSTRAINT "vehicle_repair_details_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_repair_details" ADD CONSTRAINT "vehicle_repair_details_issue_category_id_fkey" FOREIGN KEY ("issue_category_id") REFERENCES "vehicle_issue_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
