// Mirrors the "Matrice MVP" table in docs/02-product/ROLES_AND_PERMISSIONS.md.
// Kept as a read-only reference view; update both places together if the
// policy changes.

export const ROLES_MATRIX_COLUMNS = [
  "Super Admin",
  "Admin",
  "Responsable marque",
  "Éditeur",
  "Commercial",
  "Collaborateur",
  "Lecteur",
] as const;

export const ROLES_MATRIX_ROWS: ReadonlyArray<
  Readonly<{ domain: string; values: readonly string[] }>
> = [
  {
    domain: "Utilisateurs",
    values: [
      "gérer",
      "consulter/gérer hors super admin",
      "non",
      "non",
      "non",
      "non",
      "non",
    ],
  },
  {
    domain: "Rôles et sécurité",
    values: ["gérer", "consulter", "non", "non", "non", "non", "non"],
  },
  {
    domain: "Paramètres globaux",
    values: [
      "gérer",
      "modifier partiellement",
      "non",
      "non",
      "non",
      "non",
      "non",
    ],
  },
  {
    domain: "Univers de marque",
    values: [
      "gérer",
      "gérer",
      "gérer son univers",
      "consulter",
      "consulter",
      "consulter",
      "consulter",
    ],
  },
  {
    domain: "Pages et services",
    values: [
      "publier",
      "publier",
      "publier son univers",
      "créer/modifier",
      "consulter",
      "consulter",
      "consulter",
    ],
  },
  {
    domain: "Études de cas",
    values: [
      "publier",
      "publier",
      "publier son univers",
      "créer/modifier",
      "consulter",
      "contribuer si affecté",
      "consulter",
    ],
  },
  {
    domain: "Médias",
    values: [
      "gérer",
      "gérer",
      "gérer son univers",
      "importer/utiliser",
      "consulter",
      "importer si autorisé",
      "consulter",
    ],
  },
  {
    domain: "Leads et demandes",
    values: [
      "gérer",
      "gérer",
      "gérer son univers",
      "consulter si autorisé",
      "gérer",
      "consulter si affecté",
      "non",
    ],
  },
  {
    domain: "Notes commerciales",
    values: [
      "gérer",
      "gérer",
      "gérer son univers",
      "non",
      "gérer",
      "consulter si affecté",
      "non",
    ],
  },
  {
    domain: "Journal d'activité",
    values: [
      "consulter",
      "consulter partiellement",
      "consulter son univers",
      "non",
      "non",
      "non",
      "non",
    ],
  },
  {
    domain: "Calendrier éditorial",
    values: [
      "gérer",
      "gérer",
      "gérer son univers",
      "créer/modifier/marquer fait",
      "consulter",
      "consulter",
      "consulter",
    ],
  },
  {
    domain: "Facturation",
    values: ["gérer", "gérer", "gérer son univers", "non", "non", "non", "non"],
  },
];
