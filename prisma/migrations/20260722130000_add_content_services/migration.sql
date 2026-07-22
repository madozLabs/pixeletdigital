ALTER TYPE "PageLifecycleState" RENAME TO "ContentLifecycleState";

CREATE TYPE "ServiceAvailabilityStatus" AS ENUM (
  'CANDIDATE',
  'CURRENT_STATED',
  'APPROVED_CURRENT',
  'FUTURE_ONLY',
  'WITHDRAWN'
);

CREATE TABLE "services" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "familyId" TEXT,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "availabilityStatus" "ServiceAvailabilityStatus" NOT NULL,
  "lifecycle" "ContentLifecycleState" NOT NULL,
  "version" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "services_worldKey_lifecycle_idx"
  ON "services"("worldKey", "lifecycle");
CREATE INDEX "services_worldKey_availabilityStatus_idx"
  ON "services"("worldKey", "availabilityStatus");

ALTER TABLE "services"
  ADD CONSTRAINT "services_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;
