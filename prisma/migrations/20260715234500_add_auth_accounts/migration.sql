CREATE TABLE "auth_accounts" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerAccountId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_accounts_identity_nonempty_check"
    CHECK (length(btrim("provider")) > 0 AND length(btrim("providerAccountId")) > 0),
  CONSTRAINT "auth_accounts_identity_length_check"
    CHECK (length("provider") <= 255 AND length("providerAccountId") <= 255)
);

CREATE UNIQUE INDEX "auth_accounts_provider_providerAccountId_key"
  ON "auth_accounts"("provider", "providerAccountId");
CREATE INDEX "auth_accounts_userId_idx" ON "auth_accounts"("userId");

ALTER TABLE "auth_accounts"
  ADD CONSTRAINT "auth_accounts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
