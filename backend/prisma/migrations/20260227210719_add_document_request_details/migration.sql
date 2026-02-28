-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('DIGITAL', 'POSTAL', 'PICKUP');

-- CreateTable
CREATE TABLE "document_request_details" (
    "request_id" TEXT NOT NULL,
    "site_name_raw" TEXT NOT NULL,
    "site_name_normalized" TEXT NOT NULL,
    "document_description" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "needed_date" TIMESTAMP(3) NOT NULL,
    "delivery_method" "DeliveryMethod" NOT NULL,
    "note" TEXT,
    "delivery_address_id" TEXT,
    "digital_file_attachment_id" TEXT,
    "pickup_note" TEXT,

    CONSTRAINT "document_request_details_pkey" PRIMARY KEY ("request_id")
);

-- CreateIndex
CREATE INDEX "document_request_details_delivery_method_idx" ON "document_request_details"("delivery_method");

-- AddForeignKey
ALTER TABLE "document_request_details" ADD CONSTRAINT "document_request_details_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_request_details" ADD CONSTRAINT "document_request_details_delivery_address_id_fkey" FOREIGN KEY ("delivery_address_id") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_request_details" ADD CONSTRAINT "document_request_details_digital_file_attachment_id_fkey" FOREIGN KEY ("digital_file_attachment_id") REFERENCES "request_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
