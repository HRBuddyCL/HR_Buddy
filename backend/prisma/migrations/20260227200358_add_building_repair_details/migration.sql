-- CreateEnum
CREATE TYPE "BuildingSide" AS ENUM ('FRONT', 'BACK');

-- CreateTable
CREATE TABLE "building_repair_details" (
    "request_id" TEXT NOT NULL,
    "building" "BuildingSide" NOT NULL,
    "floor" INTEGER NOT NULL,
    "location_detail" TEXT NOT NULL,
    "problem_category_id" TEXT NOT NULL,
    "problem_category_other" TEXT,
    "description" TEXT NOT NULL,
    "additional_details" TEXT,

    CONSTRAINT "building_repair_details_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "building_repair_details_problem_category_id_idx" ON "building_repair_details"("problem_category_id");

-- AddForeignKey
ALTER TABLE "building_repair_details" ADD CONSTRAINT "building_repair_details_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_repair_details" ADD CONSTRAINT "building_repair_details_problem_category_id_fkey" FOREIGN KEY ("problem_category_id") REFERENCES "problem_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
