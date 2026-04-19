/*
  Warnings:

  - The primary key for the `request_no_counters` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "messenger_booking_details" DROP CONSTRAINT "messenger_booking_details_sender_address_id_fkey";

-- AlterTable
ALTER TABLE "abuse_rate_limit_counters" ALTER COLUMN "window_start_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "blocked_until" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "request_no_counters" DROP CONSTRAINT "request_no_counters_pkey",
ALTER COLUMN "counter_date" SET DATA TYPE TEXT,
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ADD CONSTRAINT "request_no_counters_pkey" PRIMARY KEY ("counter_date");

-- AddForeignKey
ALTER TABLE "messenger_booking_details" ADD CONSTRAINT "messenger_booking_details_sender_address_id_fkey" FOREIGN KEY ("sender_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_abuse_rate_limit_counters_scope_updated_at" RENAME TO "abuse_rate_limit_counters_scope_updated_at_idx";

-- RenameIndex
ALTER INDEX "idx_abuse_rate_limit_counters_updated_at" RENAME TO "abuse_rate_limit_counters_updated_at_idx";
