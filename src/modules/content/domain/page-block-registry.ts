export const PAGE_BLOCK_TYPES = [
  "HERO",
  "RICH_TEXT",
  "MEDIA",
  "GALLERY",
  "FEATURE_GRID",
  "STEPS",
  "SERVICE_INDEX",
  "TESTIMONIAL",
  "CASE_STUDY",
  "FAQ",
  "CTA",
  "FORM",
  "BANNER",
  "COLUMNS",
  "STATS",
  "LOGO_CLOUD",
  "TEAM",
  "PORTFOLIO",
  "PRICING",
  "VIDEO",
  "CONTACT_INFO",
] as const;

export type PageBlockType = (typeof PAGE_BLOCK_TYPES)[number];
export type PageBlockCategory = "ESSENTIAL" | "CONTENT" | "PROOF" | "ACTION";
export type PageBlockFieldKind =
  "TEXT" | "TEXTAREA" | "URL" | "MEDIA" | "ITEMS";

export type PageBlockField = Readonly<{
  key: string;
  label: string;
  kind: PageBlockFieldKind;
  required?: boolean;
  help?: string;
}>;

export type PageBlockDefinition = Readonly<{
  type: PageBlockType;
  label: string;
  description: string;
  category: PageBlockCategory;
  fields: readonly PageBlockField[];
  defaultPayload: Readonly<Record<string, unknown>>;
}>;

const COMMON_COPY_FIELDS: readonly PageBlockField[] = [
  { key: "eyebrow", label: "Sur-titre", kind: "TEXT" },
  { key: "title", label: "Titre", kind: "TEXTAREA", required: true },
  { key: "text", label: "Texte", kind: "TEXTAREA" },
];

export const PAGE_BLOCK_REGISTRY: readonly PageBlockDefinition[] = [
  block(
    "HERO",
    "En-tête principal",
    "Grand titre, texte, action et visuel.",
    "ESSENTIAL",
    [
      ...COMMON_COPY_FIELDS,
      { key: "label", label: "Texte du bouton", kind: "TEXT" },
      { key: "href", label: "Lien du bouton", kind: "URL" },
      { key: "mediaId", label: "Image principale", kind: "MEDIA" },
    ],
  ),
  block(
    "RICH_TEXT",
    "Texte éditorial",
    "Titre et texte long pour raconter une idée.",
    "CONTENT",
    COMMON_COPY_FIELDS,
  ),
  block(
    "MEDIA",
    "Texte + média",
    "Image accompagnée d’un texte éditorial.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      { key: "mediaId", label: "Image", kind: "MEDIA", required: true },
    ],
  ),
  block(
    "GALLERY",
    "Galerie",
    "Collection d’images pour projets ou réalisations.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      { key: "mediaIds", label: "Images", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "FEATURE_GRID",
    "Grille d’atouts",
    "Liste visuelle d’avantages ou de capacités.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      { key: "items", label: "Éléments", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "STEPS",
    "Étapes",
    "Processus présenté dans un ordre clair.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      { key: "items", label: "Étapes", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "SERVICE_INDEX",
    "Catalogue de services",
    "Services publiés de l’univers, alimentés automatiquement.",
    "CONTENT",
    [
      { key: "eyebrow", label: "Sur-titre", kind: "TEXT" },
      { key: "title", label: "Titre", kind: "TEXTAREA" },
    ],
  ),
  block(
    "TESTIMONIAL",
    "Témoignage",
    "Citation approuvée et attribution vérifiable.",
    "PROOF",
    [
      { key: "quote", label: "Témoignage", kind: "TEXTAREA", required: true },
      {
        key: "attribution",
        label: "Attribution",
        kind: "TEXT",
        required: true,
      },
      { key: "mediaId", label: "Portrait ou logo", kind: "MEDIA" },
    ],
  ),
  block(
    "CASE_STUDY",
    "Étude de cas",
    "Contexte, intervention, résultat et preuve.",
    "PROOF",
    [
      ...COMMON_COPY_FIELDS,
      { key: "context", label: "Contexte", kind: "TEXTAREA", required: true },
      { key: "scope", label: "Intervention", kind: "TEXTAREA", required: true },
      { key: "outcome", label: "Résultat", kind: "TEXTAREA", required: true },
      { key: "mediaId", label: "Visuel", kind: "MEDIA" },
    ],
  ),
  block(
    "FAQ",
    "Questions fréquentes",
    "Questions et réponses repliables.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      {
        key: "items",
        label: "Questions et réponses",
        kind: "ITEMS",
        required: true,
      },
    ],
  ),
  block(
    "CTA",
    "Appel à l’action",
    "Bloc final avec bouton de conversion.",
    "ACTION",
    [
      ...COMMON_COPY_FIELDS,
      { key: "label", label: "Texte du bouton", kind: "TEXT", required: true },
      { key: "href", label: "Lien du bouton", kind: "URL", required: true },
    ],
  ),
  block(
    "FORM",
    "Formulaire",
    "Point de contact ou demande de devis.",
    "ACTION",
    [
      ...COMMON_COPY_FIELDS,
      {
        key: "formKey",
        label: "Type de formulaire",
        kind: "TEXT",
        required: true,
      },
      {
        key: "items",
        label: "Arguments de réassurance",
        kind: "ITEMS",
      },
    ],
  ),
  block(
    "BANNER",
    "Bandeau d’annonce",
    "Message court mis en avant avec lien optionnel.",
    "ACTION",
    [
      ...COMMON_COPY_FIELDS,
      { key: "label", label: "Texte du lien", kind: "TEXT" },
      { key: "href", label: "Lien", kind: "URL" },
    ],
  ),
  block(
    "COLUMNS",
    "Colonnes de contenu",
    "Deux à quatre contenus présentés côte à côte.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      { key: "items", label: "Colonnes", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "STATS",
    "Chiffres clés",
    "Indicateurs, volumes et résultats mesurables.",
    "PROOF",
    [
      ...COMMON_COPY_FIELDS,
      { key: "items", label: "Chiffres", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "LOGO_CLOUD",
    "Logos et partenaires",
    "Grille de logos clients, partenaires ou certifications.",
    "PROOF",
    [
      ...COMMON_COPY_FIELDS,
      { key: "mediaIds", label: "Logos", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "TEAM",
    "Équipe",
    "Présentation de personnes, rôles et expertises.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      { key: "items", label: "Membres", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "PORTFOLIO",
    "Portfolio",
    "Sélection visuelle de projets et réalisations.",
    "PROOF",
    [
      ...COMMON_COPY_FIELDS,
      { key: "mediaIds", label: "Projets", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "PRICING",
    "Offres et tarifs",
    "Comparaison structurée de formules ou niveaux de service.",
    "ACTION",
    [
      ...COMMON_COPY_FIELDS,
      { key: "items", label: "Offres", kind: "ITEMS", required: true },
    ],
  ),
  block(
    "VIDEO",
    "Vidéo",
    "Vidéo hébergée ou lien externe accompagné de texte.",
    "CONTENT",
    [
      ...COMMON_COPY_FIELDS,
      { key: "mediaId", label: "Fichier vidéo", kind: "MEDIA" },
      { key: "href", label: "Lien vidéo externe", kind: "URL" },
    ],
  ),
  block(
    "CONTACT_INFO",
    "Coordonnées",
    "Adresses, téléphone, horaires et informations pratiques.",
    "ACTION",
    [
      ...COMMON_COPY_FIELDS,
      { key: "items", label: "Coordonnées", kind: "ITEMS", required: true },
    ],
  ),
];

export function getPageBlockDefinition(
  type: string,
): PageBlockDefinition | null {
  if (type === "TEXT") {
    return (
      PAGE_BLOCK_REGISTRY.find(
        (definition) => definition.type === "RICH_TEXT",
      ) ?? null
    );
  }
  return (
    PAGE_BLOCK_REGISTRY.find((definition) => definition.type === type) ?? null
  );
}

export function createDefaultBlockPayload(
  type: PageBlockType,
): Readonly<Record<string, unknown>> {
  const definition = getPageBlockDefinition(type);
  if (!definition) throw new Error(`Unknown block type: ${type}`);
  return structuredClone(definition.defaultPayload);
}

export function validatePageBlock(
  type: string,
  payload: Readonly<Record<string, unknown>>,
): readonly string[] {
  const definition = getPageBlockDefinition(type);
  if (!definition) return ["Type de bloc inconnu."];
  const errors: string[] = [];
  for (const field of definition.fields) {
    const value = payload[field.key];
    if (field.required && isEmpty(value)) {
      errors.push(`${field.label} est requis.`);
    }
    if (
      field.kind === "URL" &&
      typeof value === "string" &&
      value.trim() &&
      !isSafeLink(value)
    ) {
      errors.push(
        `${field.label} doit être un lien interne, HTTPS, mailto ou tel.`,
      );
    }
    if (typeof value === "string" && value.length > 10_000) {
      errors.push(`${field.label} dépasse la longueur autorisée.`);
    }
  }
  return errors;
}

export function isPageBlockType(value: string): value is PageBlockType {
  return PAGE_BLOCK_TYPES.includes(value as PageBlockType);
}

function block(
  type: PageBlockType,
  label: string,
  description: string,
  category: PageBlockCategory,
  fields: readonly PageBlockField[],
): PageBlockDefinition {
  return {
    type,
    label,
    description,
    category,
    fields,
    defaultPayload: Object.fromEntries(
      fields.map((field) => [field.key, field.kind === "ITEMS" ? [] : ""]),
    ),
  };
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

function isSafeLink(value: string): boolean {
  return /^(\/|https:\/\/|mailto:|tel:|#)/i.test(value.trim());
}
