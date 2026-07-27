-- Make the existing Contact and Devis system pages genuinely editable while
-- retaining their code-owned form behaviour and current public copy.

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'form_intro_' || revision."id", revision."id", 'intro', 'HERO', 0,
  CASE page."worldKey"
    WHEN 'kwaliti-print' THEN jsonb_build_object(
      'eyebrow', 'Demande de devis',
      'title', 'Parlez-nous du support. On s’occupe de le rendre remarquable.',
      'text', 'Quantité, format, matière, délai, finition : donnez-nous les éléments disponibles. Nous vous aidons à cadrer le reste.',
      'label', '', 'href', '', 'mediaId', ''
    )
    ELSE jsonb_build_object(
      'eyebrow', 'On parle de votre projet ?',
      'title', 'Vous avez le terrain. Nous apportons la stratégie et la force d’exécution.',
      'text', 'Dites-nous où vous en êtes, ce que vous voulez changer et ce que le projet doit produire concrètement.',
      'label', '', 'href', '', 'mediaId', ''
    )
  END,
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE (page."worldKey" = 'pixel-digital' AND page."slug" = 'contact')
   OR (page."worldKey" = 'kwaliti-print' AND page."slug" = 'devis')
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;

INSERT INTO "page_revision_sections" (
  "id", "revisionId", "sectionKey", "sectionType", "order", "payload",
  "payloadSchemaVersion", "version", "createdAt", "updatedAt"
)
SELECT
  'form_widget_' || revision."id", revision."id", 'form', 'FORM', 1,
  CASE page."worldKey"
    WHEN 'kwaliti-print' THEN jsonb_build_object(
      'eyebrow', 'Votre besoin',
      'title', 'Décrivez le projet.',
      'text', '',
      'formKey', 'kwaliti-quote',
      'items', jsonb_build_array(
        jsonb_build_object('title', 'Réponse humaine', 'text', ''),
        jsonb_build_object('title', 'Conseil sur le support', 'text', ''),
        jsonb_build_object('title', 'Devis adapté au besoin', 'text', '')
      )
    )
    ELSE jsonb_build_object(
      'eyebrow', 'Votre brief',
      'title', 'Parlons concret.',
      'text', '',
      'formKey', 'contact',
      'items', jsonb_build_array(
        jsonb_build_object('title', 'Réponse humaine', 'text', ''),
        jsonb_build_object('title', 'Brief confidentiel', 'text', ''),
        jsonb_build_object('title', 'Projet cadré avant production', 'text', '')
      )
    )
  END,
  1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "page_revisions" revision
JOIN "pages" page ON page."id" = revision."pageId"
WHERE (page."worldKey" = 'pixel-digital' AND page."slug" = 'contact')
   OR (page."worldKey" = 'kwaliti-print' AND page."slug" = 'devis')
ON CONFLICT ("revisionId", "sectionKey") DO NOTHING;
