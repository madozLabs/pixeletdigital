ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONTENT_SITE_IDENTITY_PUBLISHED';
ALTER TYPE "AuditTargetType" ADD VALUE IF NOT EXISTS 'SITE_SETTINGS';

CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "worldKey" TEXT NOT NULL,
    "draftRevisionId" TEXT,
    "publishedRevisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings_revisions" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "PageRevisionStatus" NOT NULL,
    "config" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "reviewedById" TEXT,
    "publishedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_settings_revisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_identity_media_usages" (
    "id" TEXT NOT NULL,
    "revisionId" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "slot" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "site_identity_media_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "site_settings_worldKey_key" ON "site_settings"("worldKey");
CREATE UNIQUE INDEX "site_settings_draftRevisionId_key" ON "site_settings"("draftRevisionId");
CREATE UNIQUE INDEX "site_settings_publishedRevisionId_key" ON "site_settings"("publishedRevisionId");
CREATE UNIQUE INDEX "site_settings_revisions_settingsId_revisionNumber_key" ON "site_settings_revisions"("settingsId", "revisionNumber");
CREATE INDEX "site_settings_revisions_settingsId_status_idx" ON "site_settings_revisions"("settingsId", "status");
CREATE UNIQUE INDEX "site_identity_media_usages_revisionId_slot_key" ON "site_identity_media_usages"("revisionId", "slot");
CREATE INDEX "site_identity_media_usages_mediaId_idx" ON "site_identity_media_usages"("mediaId");

ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_worldKey_fkey" FOREIGN KEY ("worldKey") REFERENCES "worlds"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_settings_revisions" ADD CONSTRAINT "site_settings_revisions_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "site_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_draftRevisionId_fkey" FOREIGN KEY ("draftRevisionId") REFERENCES "site_settings_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_publishedRevisionId_fkey" FOREIGN KEY ("publishedRevisionId") REFERENCES "site_settings_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_identity_media_usages" ADD CONSTRAINT "site_identity_media_usages_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "site_settings_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "site_identity_media_usages" ADD CONSTRAINT "site_identity_media_usages_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "site_settings" ("id", "worldKey", "createdAt", "updatedAt")
SELECT 'site_settings_' || "key", "key", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "worlds"
ON CONFLICT ("worldKey") DO NOTHING;

INSERT INTO "site_settings_revisions" (
  "id", "settingsId", "revisionNumber", "status", "config", "version", "createdAt", "updatedAt", "publishedAt"
)
SELECT
  'site_identity_revision_' || w."key",
  s."id",
  1,
  'PUBLISHED'::"PageRevisionStatus",
  jsonb_build_object(
    'siteName', w."displayName",
    'tagline', CASE WHEN w."key" = 'kwaliti-print' THEN 'Impression · Personnalisation · Production' ELSE 'Agence créative & digitale' END,
    'logoMediaId', '',
    'faviconMediaId', '',
    'headingFont', CASE WHEN w."key" = 'kwaliti-print' THEN 'BALOO' ELSE 'OUTFIT' END,
    'bodyFont', CASE WHEN w."key" = 'kwaliti-print' THEN 'MANROPE' ELSE 'OUTFIT' END,
    'navigationItems', '[]'::jsonb,
    'footerText', '',
    'contactLabel', CASE WHEN w."key" = 'kwaliti-print' THEN 'Demander un devis' ELSE 'Nous contacter' END,
    'contactHref', CASE WHEN w."key" = 'kwaliti-print' THEN '/kwaliti-print/devis' ELSE '/contact' END
  ),
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "worlds" w
JOIN "site_settings" s ON s."worldKey" = w."key"
ON CONFLICT ("settingsId", "revisionNumber") DO NOTHING;

UPDATE "site_settings" s
SET "publishedRevisionId" = r."id"
FROM "site_settings_revisions" r
WHERE r."settingsId" = s."id" AND r."revisionNumber" = 1 AND s."publishedRevisionId" IS NULL;
