-- Repair revisions that were initialized with Pixel&Digital's identity while
-- belonging to the Kwaliti Print world. User-selected media, menus and contact
-- settings are deliberately preserved.
UPDATE "site_settings_revisions" revision
SET
  "config" = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          revision."config",
          '{siteName}',
          to_jsonb('Kwaliti Print'::text),
          true
        ),
        '{tagline}',
        to_jsonb('Impression · Personnalisation · Production'::text),
        true
      ),
      '{headingFont}',
      to_jsonb('BALOO'::text),
      true
    ),
    '{bodyFont}',
    to_jsonb('MANROPE'::text),
    true
  ),
  "version" = revision."version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "site_settings" settings
WHERE
  settings."id" = revision."settingsId"
  AND settings."worldKey" = 'kwaliti-print'
  AND revision."config" ->> 'siteName' = 'Pixel&Digital';

UPDATE "site_settings"
SET "updatedAt" = CURRENT_TIMESTAMP
WHERE "worldKey" = 'kwaliti-print';
