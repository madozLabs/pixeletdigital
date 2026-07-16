ALTER TYPE "AuditAction" ADD VALUE 'ACCESS_USER_CREATED';

ALTER TABLE "users"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "normalizedEmail" TEXT,
  ADD CONSTRAINT "users_employee_identity_pair_check"
    CHECK (
      ("displayName" IS NULL AND "normalizedEmail" IS NULL)
      OR (
        "displayName" IS NOT NULL
        AND "normalizedEmail" IS NOT NULL
        AND length(btrim("displayName")) > 0
        AND length("displayName") <= 255
        AND "normalizedEmail" = lower(btrim("normalizedEmail"))
        AND length("normalizedEmail") <= 320
        AND "normalizedEmail" LIKE '%_@_%'
      )
    );

CREATE UNIQUE INDEX "users_normalizedEmail_key"
  ON "users"("normalizedEmail");
