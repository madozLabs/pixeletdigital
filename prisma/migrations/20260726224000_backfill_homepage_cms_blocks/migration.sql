-- Materialize the remaining homepage copy as editable blocks while preserving
-- the current public text exactly. Published revisions are only enriched when
-- the deterministic block key does not already exist.

UPDATE "page_revision_sections" section
SET "order" = 5, "updatedAt" = CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE section."revisionId" = revision."id"
  AND page."worldKey" = 'pixel-digital'
  AND page."slug" = 'accueil'
  AND section."sectionType" = 'CTA';

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'home_manifesto_' || revision."id",
  revision."id",
  'manifesto',
  'RICH_TEXT',
  1,
  jsonb_build_object(
    'eyebrow', 'Notre façon de voir les choses',
    'title', E'Les likes paient rarement les factures.\nLes bonnes stratégies, si.',
    'text', ''
  ),
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE page."worldKey" = 'pixel-digital' AND page."slug" = 'accueil'
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'home_services_' || revision."id", revision."id", 'services',
  'SERVICE_INDEX', 2,
  jsonb_build_object(
    'eyebrow', 'Ce qu’on sait faire',
    'title', 'Une seule équipe pour faire avancer toute la marque.'
  ),
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE page."worldKey" = 'pixel-digital' AND page."slug" = 'accueil'
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'home_method_' || revision."id", revision."id", 'method', 'STEPS', 3,
  jsonb_build_object(
    'eyebrow', 'Une méthode simple',
    'title', 'On pense juste. On crée fort. On exécute proprement.',
    'text', '',
    'items', jsonb_build_array(
      jsonb_build_object('title', 'Comprendre', 'text', ''),
      jsonb_build_object('title', 'Positionner', 'text', ''),
      jsonb_build_object('title', 'Créer', 'text', ''),
      jsonb_build_object('title', 'Déployer', 'text', '')
    )
  ),
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE page."worldKey" = 'pixel-digital' AND page."slug" = 'accueil'
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'home_kwaliti_' || revision."id", revision."id", 'kwaliti-promo',
  'MEDIA', 4,
  jsonb_build_object(
    'eyebrow', 'Notre bras production',
    'title', 'Kwaliti Print transforme vos idées en objets qu’on remarque.',
    'text', '',
    'label', 'Découvrir Kwaliti Print',
    'href', '/kwaliti-print',
    'mediaId', ''
  ),
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE page."worldKey" = 'pixel-digital' AND page."slug" = 'accueil'
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;

UPDATE "page_revision_sections" section
SET "order" = 3, "updatedAt" = CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE section."revisionId" = revision."id"
  AND page."worldKey" = 'kwaliti-print'
  AND page."slug" = 'accueil'
  AND section."sectionType" = 'CTA';

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'kp_home_services_' || revision."id", revision."id", 'services',
  'SERVICE_INDEX', 1,
  jsonb_build_object(
    'eyebrow', 'Ce qu’on produit',
    'title', 'Des supports qui font exister votre marque dans le vrai monde.'
  ),
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE page."worldKey" = 'kwaliti-print' AND page."slug" = 'accueil'
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'kp_home_quality_' || revision."id", revision."id", 'quality',
  'FEATURE_GRID', 2,
  jsonb_build_object(
    'eyebrow', 'Notre exigence',
    'title', 'Le bon support. La bonne finition. Le bon délai.',
    'text', '',
    'items', jsonb_build_array(
      jsonb_build_object('title', 'Conseil matière', 'text', ''),
      jsonb_build_object('title', 'Contrôle des fichiers', 'text', ''),
      jsonb_build_object('title', 'Production suivie', 'text', ''),
      jsonb_build_object('title', 'Finition propre', 'text', '')
    )
  ),
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE page."worldKey" = 'kwaliti-print' AND page."slug" = 'accueil'
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;
