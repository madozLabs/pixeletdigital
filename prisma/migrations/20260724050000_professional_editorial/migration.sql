CREATE TYPE "EditorialContentType" AS ENUM ('POST', 'STORY', 'REEL', 'VIDEO', 'ARTICLE', 'EMAIL', 'AD', 'OTHER');
CREATE TYPE "EditorialItemStatus_new" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'CLIENT_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'CANCELLED');

ALTER TABLE "editorial_items" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "editorial_items"
  ALTER COLUMN "status" TYPE "EditorialItemStatus_new"
  USING (CASE
    WHEN "status"::text = 'PLANNED' THEN 'DRAFT'
    WHEN "status"::text = 'DONE' THEN 'PUBLISHED'
    ELSE 'CANCELLED'
  END)::"EditorialItemStatus_new";
DROP TYPE "EditorialItemStatus";
ALTER TYPE "EditorialItemStatus_new" RENAME TO "EditorialItemStatus";

ALTER TABLE "editorial_items"
  ADD COLUMN "clientId" TEXT,
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "reviewerId" TEXT,
  ADD COLUMN "contentType" "EditorialContentType" NOT NULL DEFAULT 'POST',
  ADD COLUMN "brief" TEXT,
  ADD COLUMN "productionDueAt" TIMESTAMP(3),
  ADD COLUMN "internalApprovedAt" TIMESTAMP(3),
  ADD COLUMN "clientApprovedAt" TIMESTAMP(3);
CREATE INDEX "editorial_items_clientId_status_idx" ON "editorial_items"("clientId", "status");
CREATE INDEX "editorial_items_projectId_idx" ON "editorial_items"("projectId");
CREATE INDEX "editorial_items_ownerId_status_idx" ON "editorial_items"("ownerId", "status");

ALTER TABLE "editorial_items"
  ADD CONSTRAINT "editorial_items_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "editorial_items"
  ADD CONSTRAINT "editorial_items_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "editorial_items"
  ADD CONSTRAINT "editorial_items_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "editorial_items"
  ADD CONSTRAINT "editorial_items_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
