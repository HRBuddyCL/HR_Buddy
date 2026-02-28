-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('DOCUMENT', 'PACKAGE');

-- CreateEnum
CREATE TYPE "DeliveryService" AS ENUM ('POST', 'NAKHONCHAI_AIR', 'OTHER');

-- CreateTable
CREATE TABLE "messenger_booking_details" (
    "request_id" TEXT NOT NULL,
    "pickup_datetime" TIMESTAMP(3) NOT NULL,
    "item_type" "ItemType" NOT NULL,
    "item_description" TEXT NOT NULL,
    "outside_bkk_metro" BOOLEAN NOT NULL,
    "delivery_service" "DeliveryService",
    "delivery_service_other" TEXT,
    "sender_address_id" TEXT NOT NULL,
    "receiver_address_id" TEXT NOT NULL,

    CONSTRAINT "messenger_booking_details_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "messenger_booking_details_pickup_datetime_idx" ON "messenger_booking_details"("pickup_datetime");

-- CreateIndex
CREATE INDEX "messenger_booking_details_outside_bkk_metro_idx" ON "messenger_booking_details"("outside_bkk_metro");

-- AddForeignKey
ALTER TABLE "messenger_booking_details" ADD CONSTRAINT "messenger_booking_details_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messenger_booking_details" ADD CONSTRAINT "messenger_booking_details_sender_address_id_fkey" FOREIGN KEY ("sender_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messenger_booking_details" ADD CONSTRAINT "messenger_booking_details_receiver_address_id_fkey" FOREIGN KEY ("receiver_address_id") REFERENCES "addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
