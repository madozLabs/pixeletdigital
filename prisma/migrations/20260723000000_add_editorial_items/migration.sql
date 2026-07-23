CREATE TYPE "EditorialItemStatus" AS ENUM ('PLANNED', 'DONE', 'CANCELLED');

CREATE TABLE "editorial_items" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "clientLabel" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "EditorialItemStatus" NOT NULL,
  "proofUrl" TEXT,
  "notes" TEXT,
  "realizedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "editorial_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "editorial_items_worldKey_scheduledFor_idx" ON "editorial_items"("worldKey", "scheduledFor");
CREATE INDEX "editorial_items_worldKey_status_idx" ON "editorial_items"("worldKey", "status");

ALTER TABLE "editorial_items"
  ADD CONSTRAINT "editorial_items_worldKey_fkey"
  FOREIGN KEY ("worldKey") REFERENCES "worlds"("key")
  ON DELETE RESTRICT ON UPDATE CASCADE;
