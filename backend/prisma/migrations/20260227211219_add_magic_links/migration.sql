-- CreateTable
CREATE TABLE "magic_links" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "magic_links_expires_at_idx" ON "magic_links"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_request_id_key" ON "magic_links"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_token_hash_key" ON "magic_links"("token_hash");

-- AddForeignKey
ALTER TABLE "magic_links" ADD CONSTRAINT "magic_links_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
