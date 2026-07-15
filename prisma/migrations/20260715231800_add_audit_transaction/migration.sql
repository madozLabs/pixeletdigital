CREATE TYPE "AuditAction" AS ENUM (
  'ACCESS_USER_ACTIVATED',
  'ACCESS_USER_DEACTIVATED',
  'ACCESS_ROLE_ASSIGNED',
  'ACCESS_ROLE_REVOKED'
);
CREATE TYPE "AuditTargetType" AS ENUM ('USER', 'ROLE_ASSIGNMENT');
CREATE TYPE "AuditResult" AS ENUM ('SUCCEEDED');
CREATE TYPE "RequestOriginChannel" AS ENUM ('WORKSPACE', 'SYSTEM');

CREATE TABLE "audit_events" (
  "id" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" "AuditAction" NOT NULL,
  "targetType" "AuditTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "result" "AuditResult" NOT NULL,
  "correlationId" TEXT NOT NULL,
  "originChannel" "RequestOriginChannel" NOT NULL,
  "worldId" TEXT,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_events_occurredAt_idx"
  ON "audit_events"("occurredAt");
CREATE INDEX "audit_events_actorId_occurredAt_idx"
  ON "audit_events"("actorId", "occurredAt");
CREATE INDEX "audit_events_targetType_targetId_occurredAt_idx"
  ON "audit_events"("targetType", "targetId", "occurredAt");
CREATE INDEX "audit_events_worldId_occurredAt_idx"
  ON "audit_events"("worldId", "occurredAt");

ALTER TABLE "audit_events"
  ADD CONSTRAINT "audit_events_worldId_fkey"
  FOREIGN KEY ("worldId") REFERENCES "worlds"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
