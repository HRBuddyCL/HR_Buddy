-- CreateTable
CREATE TABLE "problem_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "helper_text" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "problem_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_issue_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicle_issue_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "problem_categories_name_key" ON "problem_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_issue_categories_name_key" ON "vehicle_issue_categories"("name");
