/*
  Warnings:

  - A unique constraint covering the columns `[display_name]` on the table `operators` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "operators_display_name_key" ON "operators"("display_name");
