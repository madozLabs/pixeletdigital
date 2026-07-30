-- Final revision cutover. Abort instead of dropping legacy data unless every
-- legacy section has an equivalent section in the page's active revision.
CREATE TABLE "page_block_deletions" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "sectionType" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadSchemaVersion" INTEGER NOT NULL,
  "mediaUsages" JSONB NOT NULL,
  "deletedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restoredAt" TIMESTAMP(3),
  CONSTRAINT "page_block_deletions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "page_block_deletions_pageId_revisionId_createdAt_idx"
  ON "page_block_deletions"("pageId", "revisionId", "createdAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "page_sections" legacy
    WHERE NOT EXISTS (
      SELECT 1
      FROM "page_revisions" revision
      JOIN "page_revision_sections" current
        ON current."revisionId" = revision."id"
      WHERE revision."pageId" = legacy."pageId"
        AND current."sectionKey" = legacy."id"
        AND current."sectionType" = legacy."sectionType"
        AND current."order" = legacy."order"
        AND current."payload" = legacy."payload"
        AND current."payloadSchemaVersion" = legacy."payloadSchemaVersion"
    )
  ) THEN
    RAISE EXCEPTION 'PAGE_REVISION_PARITY_FAILED';
  END IF;
END $$;

DROP TABLE "page_sections";
