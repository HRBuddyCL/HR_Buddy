CREATE TABLE IF NOT EXISTS "admin_sessions" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "session_token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "admin_sessions_session_token_hash_key"
ON "admin_sessions"("session_token_hash");

CREATE INDEX IF NOT EXISTS "admin_sessions_username_expires_at_idx"
ON "admin_sessions"("username", "expires_at");

CREATE INDEX IF NOT EXISTS "admin_sessions_expires_at_idx"
ON "admin_sessions"("expires_at");

CREATE INDEX IF NOT EXISTS "admin_sessions_revoked_at_idx"
ON "admin_sessions"("revoked_at");
