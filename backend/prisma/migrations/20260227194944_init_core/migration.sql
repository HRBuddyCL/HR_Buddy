-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('BUILDING', 'VEHICLE', 'MESSENGER', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('NEW', 'APPROVED', 'IN_PROGRESS', 'IN_TRANSIT', 'DONE', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Urgency" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "request_no" TEXT NOT NULL,
    "type" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL,
    "urgency" "Urgency" NOT NULL,
    "employee_name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "latest_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancel_reason" TEXT,
    "hr_close_note" TEXT,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "requests_request_no_key" ON "requests"("request_no");

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
