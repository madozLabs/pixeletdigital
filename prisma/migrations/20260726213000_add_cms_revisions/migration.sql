CREATE TYPE "PageRevisionStatus" AS ENUM (
  'DRAFT',
  'IN_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'SUPERSEDED',
  'ARCHIVED'
);

CREATE TYPE "MediaLifecycleState" AS ENUM ('DRAFT', 'APPROVED', 'ARCHIVED');
CREATE TYPE "MediaProcessingState" AS ENUM ('PENDING', 'READY', 'REJECTED');

ALTER TABLE "pages"
  ADD COLUMN "pageKind" TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "templateKey" TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "routePath" TEXT,
  ADD COLUMN "draftRevisionId" TEXT,
  ADD COLUMN "publishedRevisionId" TEXT,
  ADD COLUMN "serviceId" TEXT;

UPDATE "pages"
SET
  "pageKind" = CASE WHEN "pageType" = 'LANDING' THEN 'LANDING' ELSE 'STANDARD' END,
  "templateKey" = CASE WHEN "slug" = 'accueil' THEN 'HOME' ELSE "pageType" END,
  "routePath" = CASE
    WHEN "worldKey" = 'pixel-digital' AND "slug" = 'accueil' THEN '/'
    WHEN "worldKey" = 'pixel-digital' THEN '/' || "slug"
    WHEN "worldKey" = 'kwaliti-print' AND "slug" = 'accueil' THEN '/kwaliti-print'
    WHEN "worldKey" = 'kwaliti-print' THEN '/kwaliti-print/' || "slug"
    ELSE NULL
  END;

CREATE UNIQUE INDEX "pages_draftRevisionId_key" ON "pages"("draftRevisionId");
CREATE UNIQUE INDEX "pages_publishedRevisionId_key" ON "pages"("publishedRevisionId");
CREATE UNIQUE INDEX "pages_serviceId_key" ON "pages"("serviceId");
CREATE UNIQUE INDEX "pages_worldKey_routePath_key" ON "pages"("worldKey", "routePath");

CREATE TABLE "page_revisions" (
  "id" TEXT NOT NULL,
  "pageId" TEXT NOT NULL,
  "revisionNumber" INTEGER NOT NULL,
  "status" "PageRevisionStatus" NOT NULL,
  "title" TEXT NOT NULL,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT,
  "reviewedById" TEXT,
  "publishedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "page_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "page_revisions_pageId_revisionNumber_key"
  ON "page_revisions"("pageId", "revisionNumber");
CREATE INDEX "page_revisions_pageId_status_idx"
  ON "page_revisions"("pageId", "status");

ALTER TABLE "page_revisions"
  ADD CONSTRAINT "page_revisions_pageId_fkey"
  FOREIGN KEY ("pageId") REFERENCES "pages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pages"
  ADD CONSTRAINT "pages_draftRevisionId_fkey"
  FOREIGN KEY ("draftRevisionId") REFERENCES "page_revisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "pages_publishedRevisionId_fkey"
  FOREIGN KEY ("publishedRevisionId") REFERENCES "page_revisions"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pages"
  ADD CONSTRAINT "pages_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "services"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "page_revision_sections" (
  "id" TEXT NOT NULL,
  "revisionId" TEXT NOT NULL,
  "sectionKey" TEXT NOT NULL,
  "sectionType" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "payloadSchemaVersion" INTEGER NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "page_revision_sections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "page_revision_sections_revisionId_sectionKey_key"
  ON "page_revision_sections"("revisionId", "sectionKey");
CREATE INDEX "page_revision_sections_revisionId_order_idx"
  ON "page_revision_sections"("revisionId", "order");

ALTER TABLE "page_revision_sections"
  ADD CONSTRAINT "page_revision_sections_revisionId_fkey"
  FOREIGN KEY ("revisionId") REFERENCES "page_revisions"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "media_assets"
  ADD COLUMN "lifecycle" "MediaLifecycleState" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "processingState" "MediaProcessingState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "checksum" TEXT,
  ADD COLUMN "caption" TEXT,
  ADD COLUMN "credit" TEXT,
  ADD COLUMN "rightsStatement" TEXT,
  ADD COLUMN "rightsExpiresAt" TIMESTAMP(3);

UPDATE "media_assets"
SET "lifecycle" = 'APPROVED', "processingState" = 'READY';

CREATE TABLE "section_media_usages" (
  "id" TEXT NOT NULL,
  "sectionId" TEXT NOT NULL,
  "mediaId" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "section_media_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "section_media_usages_sectionId_slot_order_key"
  ON "section_media_usages"("sectionId", "slot", "order");
CREATE INDEX "section_media_usages_mediaId_idx"
  ON "section_media_usages"("mediaId");

ALTER TABLE "section_media_usages"
  ADD CONSTRAINT "section_media_usages_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "page_revision_sections"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "section_media_usages_mediaId_fkey"
  FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Materialize every currently public application route in the CMS inventory.
-- Public rendering continues to use the existing service projection until the
-- revision renderer reaches parity, so this backfill is additive and safe.
INSERT INTO "pages" (
  "id", "worldKey", "pageType", "pageKind", "templateKey", "routePath",
  "title", "slug", "lifecycle", "version", "publishedAt", "serviceId",
  "createdAt", "updatedAt"
)
SELECT
  'service-page:' || service."id",
  service."worldKey",
  'SERVICE',
  'SERVICE',
  'SERVICE_DETAIL',
  '/services/' || service."slug",
  service."name",
  service."slug",
  service."lifecycle",
  service."version",
  service."publishedAt",
  service."id",
  service."createdAt",
  service."updatedAt"
FROM "services" AS service
WHERE service."worldKey" = 'pixel-digital'
  AND NOT EXISTS (
    SELECT 1 FROM "pages" AS page WHERE page."serviceId" = service."id"
  );

INSERT INTO "pages" (
  "id", "worldKey", "pageType", "pageKind", "templateKey", "routePath",
  "title", "slug", "lifecycle", "version", "publishedAt", "createdAt", "updatedAt"
)
SELECT
  system_page."id",
  system_page."worldKey",
  'SYSTEM',
  'SYSTEM',
  system_page."templateKey",
  system_page."routePath",
  system_page."title",
  system_page."slug",
  'PUBLISHED'::"ContentLifecycleState",
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('system-page:pixel-digital:contact', 'pixel-digital', 'CONTACT', '/contact', 'Contact', 'contact'),
    ('system-page:kwaliti-print:devis', 'kwaliti-print', 'QUOTE', '/kwaliti-print/devis', 'Demande de devis', 'devis')
) AS system_page("id", "worldKey", "templateKey", "routePath", "title", "slug")
JOIN "worlds" AS world ON world."key" = system_page."worldKey"
WHERE NOT EXISTS (
  SELECT 1 FROM "pages" AS page
  WHERE page."worldKey" = system_page."worldKey"
    AND page."routePath" = system_page."routePath"
);

INSERT INTO "page_revisions" (
  "id", "pageId", "revisionNumber", "status", "title", "version",
  "publishedAt", "createdAt", "updatedAt"
)
SELECT
  'legacy:' || "id" || ':r1',
  "id",
  1,
  CASE "lifecycle"
    WHEN 'PUBLISHED' THEN 'PUBLISHED'::"PageRevisionStatus"
    WHEN 'IN_REVIEW' THEN 'IN_REVIEW'::"PageRevisionStatus"
    WHEN 'ARCHIVED' THEN 'ARCHIVED'::"PageRevisionStatus"
    ELSE 'DRAFT'::"PageRevisionStatus"
  END,
  "title",
  "version",
  "publishedAt",
  "createdAt",
  "updatedAt"
FROM "pages";

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'legacy:' || section."id",
  'legacy:' || section."pageId" || ':r1',
  section."id",
  section."sectionType",
  section."order",
  section."payload",
  section."payloadSchemaVersion",
  section."version",
  section."createdAt",
  section."updatedAt"
FROM "page_sections" AS section;

INSERT INTO "section_media_usages" (
  "id", "sectionId", "mediaId", "slot", "order", "createdAt"
)
SELECT
  'legacy:' || section."id" || ':media',
  'legacy:' || section."id",
  section."payload" ->> 'mediaId',
  'primary',
  0,
  section."createdAt"
FROM "page_sections" AS section
JOIN "media_assets" AS media
  ON media."id" = section."payload" ->> 'mediaId'
WHERE COALESCE(section."payload" ->> 'mediaId', '') <> '';

UPDATE "pages"
SET
  "publishedRevisionId" = CASE
    WHEN "lifecycle" = 'PUBLISHED' THEN 'legacy:' || "id" || ':r1'
    ELSE NULL
  END,
  "draftRevisionId" = CASE
    WHEN "lifecycle" IN ('DRAFT', 'IN_REVIEW') THEN 'legacy:' || "id" || ':r1'
    ELSE NULL
  END;
