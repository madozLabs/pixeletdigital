-- AlterTable
ALTER TABLE "page_revisions" ADD COLUMN     "scheduledPublishAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "page_revisions_status_scheduledPublishAt_idx" ON "page_revisions"("status", "scheduledPublishAt");
