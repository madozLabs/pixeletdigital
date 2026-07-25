-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_REVIEW', 'QUALIFIED', 'UNQUALIFIED', 'CLOSED');

-- CreateEnum
CREATE TYPE "LeadActivityType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTE_ADDED', 'NEXT_ACTION_SET', 'NEXT_ACTION_COMPLETED');

-- CreateEnum
CREATE TYPE "NextActionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeadNoteVisibility" AS ENUM ('INTERNAL');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "ownerUserId" TEXT,
    "closedOutcome" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_enquiries" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "enquiryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_enquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "visibility" "LeadNoteVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "next_actions" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "NextActionStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "next_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "LeadActivityType" NOT NULL,
    "actorId" TEXT,
    "detail" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_worldKey_status_idx" ON "leads"("worldKey", "status");

-- CreateIndex
CREATE INDEX "leads_worldKey_email_idx" ON "leads"("worldKey", "email");

-- CreateIndex
CREATE INDEX "leads_ownerUserId_idx" ON "leads"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_enquiries_leadId_key" ON "lead_enquiries"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_enquiries_enquiryId_key" ON "lead_enquiries"("enquiryId");

-- CreateIndex
CREATE INDEX "lead_notes_leadId_createdAt_idx" ON "lead_notes"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "next_actions_leadId_idx" ON "next_actions"("leadId");

-- CreateIndex
CREATE INDEX "next_actions_ownerUserId_status_dueDate_idx" ON "next_actions"("ownerUserId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_occurredAt_idx" ON "lead_activities"("leadId", "occurredAt");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_enquiries" ADD CONSTRAINT "lead_enquiries_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_enquiries" ADD CONSTRAINT "lead_enquiries_enquiryId_fkey" FOREIGN KEY ("enquiryId") REFERENCES "enquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "next_actions" ADD CONSTRAINT "next_actions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

