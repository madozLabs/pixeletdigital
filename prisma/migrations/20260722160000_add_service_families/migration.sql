CREATE TABLE "service_families" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "lifecycle" "ContentLifecycleState" NOT NULL,
  "version" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_families_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_families_worldKey_order_idx"
  ON "service_families"("worldKey", "order");
CREATE INDEX "service_families_worldKey_lifecycle_idx"
  ON "service_families"("worldKey", "lifecycle");

ALTER TABLE "service_families"
  ADD CONSTRAINT "service_families_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "services_familyId_idx"
  ON "services"("familyId");

ALTER TABLE "services"
  ADD CONSTRAINT "services_familyId_fkey"
  FOREIGN KEY ("familyId") REFERENCES "service_families"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
