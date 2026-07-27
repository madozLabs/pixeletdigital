-- Complete the CMS route inventory for Kwaliti Print services. The initial
-- revision migration intentionally covered only Pixel&Digital services.

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
  '/kwaliti-print/' || service."slug",
  service."name",
  service."slug",
  service."lifecycle",
  service."version",
  service."publishedAt",
  service."id",
  service."createdAt",
  service."updatedAt"
FROM "services" service
WHERE service."worldKey" = 'kwaliti-print'
  AND NOT EXISTS (
    SELECT 1 FROM "pages" page WHERE page."serviceId" = service."id"
  );

INSERT INTO "page_revisions" (
  "id", "pageId", "revisionNumber", "status", "title", "version",
  "publishedAt", "createdAt", "updatedAt"
)
SELECT
  'legacy:' || page."id" || ':r1',
  page."id",
  1,
  CASE page."lifecycle"
    WHEN 'PUBLISHED' THEN 'PUBLISHED'::"PageRevisionStatus"
    WHEN 'IN_REVIEW' THEN 'IN_REVIEW'::"PageRevisionStatus"
    WHEN 'ARCHIVED' THEN 'ARCHIVED'::"PageRevisionStatus"
    ELSE 'DRAFT'::"PageRevisionStatus"
  END,
  page."title",
  page."version",
  page."publishedAt",
  page."createdAt",
  page."updatedAt"
FROM "pages" page
WHERE page."worldKey" = 'kwaliti-print'
  AND page."pageKind" = 'SERVICE'
  AND NOT EXISTS (
    SELECT 1 FROM "page_revisions" revision
    WHERE revision."pageId" = page."id"
  );

UPDATE "pages" page
SET
  "publishedRevisionId" = CASE
    WHEN page."lifecycle" = 'PUBLISHED'
      THEN 'legacy:' || page."id" || ':r1'
    ELSE NULL
  END,
  "draftRevisionId" = CASE
    WHEN page."lifecycle" IN ('DRAFT', 'IN_REVIEW')
      THEN 'legacy:' || page."id" || ':r1'
    ELSE NULL
  END
WHERE page."worldKey" = 'kwaliti-print'
  AND page."pageKind" = 'SERVICE'
  AND EXISTS (
    SELECT 1 FROM "page_revisions" revision
    WHERE revision."id" = 'legacy:' || page."id" || ':r1'
  );
