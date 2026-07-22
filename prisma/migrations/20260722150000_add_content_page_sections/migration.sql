CREATE TABLE "page_sections" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "sectionType" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadSchemaVersion" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "page_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_sections_pageId_order_idx"
  ON "page_sections"("pageId", "order");

ALTER TABLE "page_sections"
  ADD CONSTRAINT "page_sections_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "pages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
