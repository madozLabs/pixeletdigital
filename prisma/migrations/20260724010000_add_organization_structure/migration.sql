CREATE TABLE "departments" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

CREATE TABLE "teams" (
  "id" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teams_departmentId_name_key" ON "teams"("departmentId", "name");
CREATE INDEX "teams_departmentId_idx" ON "teams"("departmentId");
CREATE TABLE "job_positions" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_positions_title_key" ON "job_positions"("title");

CREATE TABLE "team_memberships" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "jobPositionId" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "team_memberships_userId_endedAt_idx" ON "team_memberships"("userId", "endedAt");
CREATE INDEX "team_memberships_teamId_endedAt_idx" ON "team_memberships"("teamId", "endedAt");
CREATE INDEX "team_memberships_jobPositionId_idx" ON "team_memberships"("jobPositionId");

ALTER TABLE "teams"
  ADD CONSTRAINT "teams_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "departments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_memberships"
  ADD CONSTRAINT "team_memberships_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_memberships"
  ADD CONSTRAINT "team_memberships_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "teams"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_memberships"
  ADD CONSTRAINT "team_memberships_jobPositionId_fkey"
  FOREIGN KEY ("jobPositionId") REFERENCES "job_positions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
