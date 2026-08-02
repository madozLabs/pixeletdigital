-- AlterTable
ALTER TABLE "editorial_items" ADD COLUMN     "linkedPageId" TEXT;

-- CreateIndex
CREATE INDEX "editorial_items_linkedPageId_idx" ON "editorial_items"("linkedPageId");

-- AddForeignKey
ALTER TABLE "editorial_items" ADD CONSTRAINT "editorial_items_linkedPageId_fkey" FOREIGN KEY ("linkedPageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
