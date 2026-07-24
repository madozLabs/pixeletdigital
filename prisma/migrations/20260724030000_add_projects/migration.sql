CREATE TYPE "ProjectStatus" AS ENUM (
  'PLANNED',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED'
);

CREATE TYPE "ProjectPriority" AS ENUM (
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
);

CREATE TABLE "projects" (
  "id" TEXT NOT NULL,
  "worldKey" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNED',
  "priority" "ProjectPriority" NOT NULL DEFAULT 'NORMAL',
  "projectManagerId" TEXT,
  "teamId" TEXT,
  "budgetCents" INTEGER,
  "startDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "progress" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "projects_worldKey_status_idx" ON "projects"("worldKey", "status");
CREATE INDEX "projects_clientId_status_idx" ON "projects"("clientId", "status");
CREATE INDEX "projects_projectManagerId_idx" ON "projects"("projectManagerId");
CREATE INDEX "projects_teamId_idx" ON "projects"("teamId");
CREATE INDEX "projects_dueDate_idx" ON "projects"("dueDate");

ALTER TABLE "projects" ADD CONSTRAINT "projects_worldKey_fkey"
FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_projectManagerId_fkey"
FOREIGN KEY ("projectManagerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "projects" ADD CONSTRAINT "projects_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
