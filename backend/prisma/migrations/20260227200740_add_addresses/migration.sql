-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "subdistrict" TEXT NOT NULL,
    "postal_code" TEXT NOT NULL,
    "house_no" TEXT NOT NULL,
    "soi" TEXT,
    "road" TEXT,
    "extra" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addresses_province_district_subdistrict_idx" ON "addresses"("province", "district", "subdistrict");

-- CreateIndex
CREATE INDEX "addresses_postal_code_idx" ON "addresses"("postal_code");
