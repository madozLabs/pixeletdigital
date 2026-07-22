ALTER TABLE "services"
  ADD COLUMN "slug" TEXT NOT NULL;

CREATE UNIQUE INDEX "services_worldKey_slug_key"
  ON "services"("worldKey", "slug");
CREATE INDEX "services_worldKey_slug_lifecycle_idx"
  ON "services"("worldKey", "slug", "lifecycle");
