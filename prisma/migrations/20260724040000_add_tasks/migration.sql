CREATE TYPE "TaskStatus" AS ENUM (
  'BACKLOG', 'TODO', 'IN_PROGRESS', 'BLOCKED',
  'REVIEW', 'DONE', 'CANCELLED'
);

CREATE TYPE "TaskPriority" AS ENUM (
  'LOW', 'NORMAL', 'HIGH', 'URGENT'
);

CREATE TABLE "tasks" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "parentTaskId" TEXT,
  "dependencyTaskId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
  "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
  "assigneeId" TEXT,
  "createdById" TEXT,
  "dueDate" TIMESTAMP(3),
  "estimatedMinutes" INTEGER,
  "actualMinutes" INTEGER,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_projectId_status_position_idx"
  ON "tasks"("projectId", "status", "position");
CREATE INDEX "tasks_assigneeId_status_idx"
  ON "tasks"("assigneeId", "status");
CREATE INDEX "tasks_parentTaskId_idx" ON "tasks"("parentTaskId");
CREATE INDEX "tasks_dependencyTaskId_idx" ON "tasks"("dependencyTaskId");
CREATE INDEX "tasks_dueDate_idx" ON "tasks"("dueDate");

ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentTaskId_fkey"
  FOREIGN KEY ("parentTaskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_dependencyTaskId_fkey"
  FOREIGN KEY ("dependencyTaskId") REFERENCES "tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
