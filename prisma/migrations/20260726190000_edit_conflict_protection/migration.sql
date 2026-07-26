ALTER TABLE "projects" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "edit_presences" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "edit_presences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "edit_presences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "edit_presences_userId_entityType_entityId_key" ON "edit_presences"("userId", "entityType", "entityId");
CREATE INDEX "edit_presences_entityType_entityId_lastSeenAt_idx" ON "edit_presences"("entityType", "entityId", "lastSeenAt");
