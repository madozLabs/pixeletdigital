-- AlterTable
ALTER TABLE "page_revisions" ADD COLUMN     "ogImageMediaId" TEXT;

-- CreateIndex
CREATE INDEX "page_revisions_ogImageMediaId_idx" ON "page_revisions"("ogImageMediaId");

-- AddForeignKey
ALTER TABLE "page_revisions" ADD CONSTRAINT "page_revisions_ogImageMediaId_fkey" FOREIGN KEY ("ogImageMediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
