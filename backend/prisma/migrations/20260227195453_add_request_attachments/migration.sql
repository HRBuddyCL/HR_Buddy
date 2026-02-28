-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('IMAGE', 'VIDEO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "UploadedByRole" AS ENUM ('EMPLOYEE', 'ADMIN');

-- CreateTable
CREATE TABLE "request_attachments" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "file_kind" "FileKind" NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "public_url" TEXT,
    "uploaded_by_role" "UploadedByRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_attachments_request_id_created_at_idx" ON "request_attachments"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "request_attachments_storage_key_idx" ON "request_attachments"("storage_key");

-- AddForeignKey
ALTER TABLE "request_attachments" ADD CONSTRAINT "request_attachments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
