CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "AccessRole" AS ENUM (
  'SUPER_ADMIN',
  'ADMIN',
  'WORLD_MANAGER',
  'EDITOR',
  'SALES',
  'CONTRIBUTOR',
  'READER'
);
CREATE TYPE "AssignmentScopeType" AS ENUM ('GLOBAL', 'WORLD');

CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "status" "UserStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_assignments" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "AccessRole" NOT NULL,
  "scopeType" "AssignmentScopeType" NOT NULL,
  "worldId" TEXT,
  "validFrom" TIMESTAMP(3) NOT NULL,
  "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "role_assignments_interval_check"
    CHECK ("validUntil" IS NULL OR "validUntil" > "validFrom"),
  CONSTRAINT "role_assignments_scope_check"
    CHECK (
      ("scopeType" = 'GLOBAL' AND "worldId" IS NULL)
      OR ("scopeType" = 'WORLD' AND "worldId" IS NOT NULL)
    )
);

CREATE INDEX "role_assignments_userId_validFrom_validUntil_idx"
  ON "role_assignments"("userId", "validFrom", "validUntil");
CREATE INDEX "role_assignments_worldId_idx"
  ON "role_assignments"("worldId");

ALTER TABLE "role_assignments"
  ADD CONSTRAINT "role_assignments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_assignments"
  ADD CONSTRAINT "role_assignments_worldId_fkey"
  FOREIGN KEY ("worldId") REFERENCES "worlds"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
