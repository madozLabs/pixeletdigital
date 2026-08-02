-- AlterTable
ALTER TABLE "page_revisions" ADD COLUMN     "snapshotCursor" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "page_revision_snapshots" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sections" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_revision_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "page_revision_snapshots_revisionId_sequence_key" ON "page_revision_snapshots"("revisionId", "sequence");

-- AddForeignKey
ALTER TABLE "page_revision_snapshots" ADD CONSTRAINT "page_revision_snapshots_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "page_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
