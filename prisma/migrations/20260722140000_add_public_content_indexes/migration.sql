CREATE INDEX "pages_worldKey_slug_lifecycle_idx"
  ON "pages"("worldKey", "slug", "lifecycle");

CREATE INDEX "services_worldKey_lifecycle_availabilityStatus_idx"
  ON "services"("worldKey", "lifecycle", "availabilityStatus");
