import { PrismaPg } from "@prisma/adapter-pg";

import { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  createDraftServiceFamily,
  listServiceFamilies,
} from "@/modules/content/application/service-family-use-cases";
import { PrismaServiceFamilyRepository } from "@/modules/content/infrastructure/prisma-service-family-repository";
import {
  approveServiceAsCurrent,
  createDraftService,
} from "@/modules/content/application/service-use-cases";
import { PrismaServiceRepository } from "@/modules/content/infrastructure/prisma-service-repository";
import { createWorld, parseWorldKey } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";
import type { RequestContext } from "@/shared/request-context";

const PLACEHOLDER_DESCRIPTION =
  "Description à rédiger — contenu en attente de validation éditoriale.";

type WorldSeed = Readonly<{ key: string; displayName: string }>;
type ServiceSeed = Readonly<{
  name: string;
  availabilityStatus: "CANDIDATE" | "CURRENT_STATED";
  approveAsCurrent: boolean;
}>;
type FamilySeed = Readonly<{
  world: WorldSeed;
  label: string;
  services: readonly ServiceSeed[];
}>;

const PIXEL_DIGITAL: WorldSeed = {
  key: "pixel-digital",
  displayName: "Pixel&Digital",
};
const KWALITI_PRINT: WorldSeed = {
  key: "kwaliti-print",
  displayName: "Kwaliti Print",
};

function stated(name: string): ServiceSeed {
  return { name, availabilityStatus: "CURRENT_STATED", approveAsCurrent: true };
}

function candidate(name: string): ServiceSeed {
  return { name, availabilityStatus: "CANDIDATE", approveAsCurrent: false };
}

const CATALOGUE: readonly FamilySeed[] = [
  {
    world: PIXEL_DIGITAL,
    label: "Communication & Branding",
    services: [
      "Création de logo",
      "Identité visuelle",
      "Charte graphique",
      "Supports de communication",
      "Flyers",
      "Affiches",
      "Brochures",
      "Dépliants",
      "Catalogues",
      "Cartes de visite",
      "Présentations",
      "Design publicitaire",
    ].map(stated),
  },
  {
    world: PIXEL_DIGITAL,
    label: "Développement Web",
    services: [
      "Site vitrine",
      "Site institutionnel",
      "E-commerce",
      "Landing pages",
      "Applications web",
      "Maintenance",
      "Hébergement",
      "Nom de domaine",
      "SEO",
    ].map(stated),
  },
  {
    world: PIXEL_DIGITAL,
    label: "Marketing Digital",
    services: [
      "Community Management",
      "Gestion des réseaux sociaux",
      "Création de contenus",
      "Campagnes sponsorisées",
      "Stratégie digitale",
    ].map(stated),
  },
  {
    world: PIXEL_DIGITAL,
    label: "Audiovisuel",
    services: [
      "Photographie",
      "Studio photo",
      "Couverture d'événements",
      "Photographie corporate",
      "Photographie produit",
      "Production vidéo",
      "Montage vidéo",
      "Motion Design",
      "Publicités vidéo",
      "Interviews",
    ].map(stated),
  },
  {
    world: KWALITI_PRINT,
    label: "Impression & Personnalisation",
    services: [
      ...[
        "Impression grand format",
        "Banderoles",
        "Bâches",
        "Vinyles",
        "Stickers",
        "Roll-up",
        "Kakémonos",
        "Enseignes",
        "Lettres 3D",
        "Signalétique",
        "Plaques professionnelles",
        "Personnalisation textile",
        "Mugs",
        "Gourdes",
        "Stylos",
        "Casquettes",
        "Porte-clés",
        "Trophées",
        "Objets publicitaires",
        "Gravure",
        "Découpe CNC",
      ].map(stated),
      // Conditional per owner: "si disponible au lancement" -- created now,
      // kept CANDIDATE (not owner-approved as current) until confirmed.
      candidate("Découpe laser"),
    ],
  },
];

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function systemContext(): RequestContext {
  return {
    actor: {
      id: "system-seed",
      active: true,
      role: "SUPER_ADMIN",
      scopes: [{ type: "GLOBAL" }],
    },
    correlationId: "seed-catalogue",
    clock: { now: () => new Date() },
    origin: { channel: "SYSTEM" },
  };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run the catalogue seed.");
  }

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
  const worlds = new PrismaWorldRepository(client);
  const families = new PrismaServiceFamilyRepository(client);
  const services = new PrismaServiceRepository(client);
  const context = systemContext();

  try {
    let createdWorlds = 0;
    let createdFamilies = 0;
    let createdServices = 0;
    let approvedServices = 0;

    for (const familySeed of CATALOGUE) {
      const world = await ensureWorld(worlds, familySeed.world);
      if (world.created) createdWorlds += 1;

      const family = await ensureFamily(
        { families, worlds },
        context,
        familySeed.world.key,
        familySeed.label,
      );
      if (family.created) createdFamilies += 1;

      for (const serviceSeed of familySeed.services) {
        const outcome = await ensureService(
          { services, worlds },
          context,
          familySeed.world.key,
          family.id,
          serviceSeed,
        );
        if (outcome.created) createdServices += 1;
        if (outcome.approved) approvedServices += 1;
      }
    }

    await ensureCmsRouteInventory(client);

    console.log(
      `Seed complete: ${createdWorlds} world(s), ${createdFamilies} family(ies), ${createdServices} service(s) created, ${approvedServices} approved as current. Re-running is safe -- existing records are left untouched.`,
    );
  } finally {
    await client.$disconnect();
  }
}

async function ensureCmsRouteInventory(client: PrismaClient): Promise<void> {
  const publicServices = await client.service.findMany({
    where: { worldKey: { in: ["pixel-digital", "kwaliti-print"] } },
  });
  for (const service of publicServices) {
    await ensureCmsPage(client, {
      id: `service-page:${service.id}`,
      worldKey: service.worldKey,
      pageType: "SERVICE",
      pageKind: "SERVICE",
      templateKey: "SERVICE_DETAIL",
      routePath:
        service.worldKey === "kwaliti-print"
          ? `/kwaliti-print/${service.slug}`
          : `/services/${service.slug}`,
      title: service.name,
      slug: service.slug,
      lifecycle: service.lifecycle,
      publishedAt: service.publishedAt,
      serviceId: service.id,
    });
  }

  await ensureCmsPage(client, {
    id: "home-page:pixel-digital",
    worldKey: "pixel-digital",
    pageType: "LANDING",
    pageKind: "LANDING",
    templateKey: "HOME",
    routePath: "/",
    title: "Accueil",
    slug: "accueil",
    lifecycle: "PUBLISHED",
    publishedAt: new Date(),
    serviceId: null,
    sections: homeSections("pixel-digital"),
  });
  await ensureCmsPage(client, {
    id: "home-page:kwaliti-print",
    worldKey: "kwaliti-print",
    pageType: "LANDING",
    pageKind: "LANDING",
    templateKey: "HOME",
    routePath: "/kwaliti-print",
    title: "Accueil",
    slug: "accueil",
    lifecycle: "PUBLISHED",
    publishedAt: new Date(),
    serviceId: null,
    sections: homeSections("kwaliti-print"),
  });

  await ensureCmsPage(client, {
    id: "system-page:pixel-digital:contact",
    worldKey: "pixel-digital",
    pageType: "SYSTEM",
    pageKind: "SYSTEM",
    templateKey: "CONTACT",
    routePath: "/contact",
    title: "Contact",
    slug: "contact",
    lifecycle: "PUBLISHED",
    publishedAt: new Date(),
    serviceId: null,
    sections: formPageSections("pixel-digital"),
  });
  await ensureCmsPage(client, {
    id: "system-page:kwaliti-print:devis",
    worldKey: "kwaliti-print",
    pageType: "SYSTEM",
    pageKind: "SYSTEM",
    templateKey: "QUOTE",
    routePath: "/kwaliti-print/devis",
    title: "Demande de devis",
    slug: "devis",
    lifecycle: "PUBLISHED",
    publishedAt: new Date(),
    serviceId: null,
    sections: formPageSections("kwaliti-print"),
  });
}

async function ensureCmsPage(
  client: PrismaClient,
  input: Readonly<{
    id: string;
    worldKey: string;
    pageType: string;
    pageKind: string;
    templateKey: string;
    routePath: string;
    title: string;
    slug: string;
    lifecycle: "DRAFT" | "IN_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
    publishedAt: Date | null;
    serviceId: string | null;
    sections?: readonly Readonly<{
      key: string;
      type: string;
      payload: Record<string, unknown>;
    }>[];
  }>,
): Promise<void> {
  const existing = await client.page.findFirst({
    where: {
      OR: [
        { id: input.id },
        { worldKey: input.worldKey, routePath: input.routePath },
      ],
    },
  });
  if (existing) return;

  await client.$transaction(async (transaction) => {
    const now = new Date();
    const { sections, ...pageInput } = input;
    await transaction.page.create({
      data: {
        ...pageInput,
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
    });
    const revisionId = `${input.id}:r1`;
    const revisionStatus =
      input.lifecycle === "PUBLISHED"
        ? "PUBLISHED"
        : input.lifecycle === "IN_REVIEW"
          ? "IN_REVIEW"
          : input.lifecycle === "ARCHIVED"
            ? "ARCHIVED"
            : "DRAFT";
    await transaction.pageRevision.create({
      data: {
        id: revisionId,
        pageId: input.id,
        revisionNumber: 1,
        status: revisionStatus,
        title: input.title,
        version: 1,
        publishedAt: input.publishedAt,
        createdAt: now,
        updatedAt: now,
        sections: sections
          ? {
              create: sections.map((section, order) => ({
                id: `${revisionId}:${section.key}`,
                sectionKey: section.key,
                sectionType: section.type,
                order,
                payload: section.payload as Prisma.InputJsonValue,
                payloadSchemaVersion: 1,
                version: 1,
                createdAt: now,
                updatedAt: now,
              })),
            }
          : undefined,
      },
    });
    await transaction.page.update({
      where: { id: input.id },
      data:
        revisionStatus === "PUBLISHED"
          ? { publishedRevisionId: revisionId }
          : { draftRevisionId: revisionId },
    });
  });
}

function homeSections(worldKey: string) {
  if (worldKey === "kwaliti-print") {
    return [
      {
        key: "hero",
        type: "HERO",
        payload: {
          eyebrow: "Impression · Personnalisation · Production",
          title: "Vos idées méritent de sortir de l’écran.",
          text: "Kwaliti Print transforme vos visuels en supports concrets, visibles et bien finis — du prototype à la série.",
          label: "Demander un devis",
          href: "/kwaliti-print/devis",
          mediaId: "",
        },
      },
      {
        key: "services",
        type: "SERVICE_INDEX",
        payload: {
          eyebrow: "Ce qu’on produit",
          title:
            "Des supports qui font exister votre marque dans le vrai monde.",
        },
      },
      {
        key: "quality",
        type: "FEATURE_GRID",
        payload: {
          eyebrow: "Notre exigence",
          title: "Le bon support. La bonne finition. Le bon délai.",
          text: "",
          items: [
            "Conseil matière",
            "Contrôle des fichiers",
            "Production suivie",
            "Finition propre",
          ].map((title) => ({ title, text: "" })),
        },
      },
      {
        key: "closing",
        type: "CTA",
        payload: {
          eyebrow: "Un besoin précis ou juste une idée ?",
          title: "On vous aide à choisir la bonne manière de l’imprimer.",
          text: "",
          label: "Obtenir un devis",
          href: "/kwaliti-print/devis",
        },
      },
    ];
  }
  return [
    {
      key: "hero",
      type: "HERO",
      payload: {
        eyebrow: "Agence créative & digitale",
        title: "Avec nous,\nvous allez\nprendre terrain.",
        text: "Nous construisons des marques visibles, crédibles et difficiles à oublier de la stratégie à l’exécution.",
        label: "Lancer un projet",
        href: "/contact",
        mediaId: "",
      },
    },
    {
      key: "manifesto",
      type: "RICH_TEXT",
      payload: {
        eyebrow: "Notre façon de voir les choses",
        title:
          "Les likes paient rarement les factures.\nLes bonnes stratégies, si.",
        text: "",
      },
    },
    {
      key: "services",
      type: "SERVICE_INDEX",
      payload: {
        eyebrow: "Ce qu’on sait faire",
        title: "Une seule équipe pour faire avancer toute la marque.",
      },
    },
    {
      key: "method",
      type: "STEPS",
      payload: {
        eyebrow: "Une méthode simple",
        title: "On pense juste. On crée fort. On exécute proprement.",
        text: "",
        items: ["Comprendre", "Positionner", "Créer", "Déployer"].map(
          (title) => ({ title, text: "" }),
        ),
      },
    },
    {
      key: "kwaliti-promo",
      type: "MEDIA",
      payload: {
        eyebrow: "Notre bras production",
        title: "Kwaliti Print transforme vos idées en objets qu’on remarque.",
        text: "",
        label: "Découvrir Kwaliti Print",
        href: "/kwaliti-print",
        mediaId: "",
      },
    },
    {
      key: "closing",
      type: "CTA",
      payload: {
        eyebrow:
          "Être partout ne sert à rien si personne ne se souvient de vous.",
        title: "Faisons quelque chose qu’on ne peut pas ignorer.",
        text: "",
        label: "Parler à Pixel&Digital",
        href: "/contact",
      },
    },
  ];
}

function formPageSections(worldKey: string) {
  if (worldKey === "kwaliti-print") {
    return [
      {
        key: "intro",
        type: "HERO",
        payload: {
          eyebrow: "Demande de devis",
          title:
            "Parlez-nous du support. On s’occupe de le rendre remarquable.",
          text: "Quantité, format, matière, délai, finition : donnez-nous les éléments disponibles. Nous vous aidons à cadrer le reste.",
          label: "",
          href: "",
          mediaId: "",
        },
      },
      {
        key: "quote-form",
        type: "FORM",
        payload: {
          eyebrow: "Votre besoin",
          title: "Décrivez le projet.",
          text: "",
          formKey: "kwaliti-quote",
          items: [
            "Réponse humaine",
            "Conseil sur le support",
            "Devis adapté au besoin",
          ].map((title) => ({ title, text: "" })),
        },
      },
    ];
  }
  return [
    {
      key: "intro",
      type: "HERO",
      payload: {
        eyebrow: "On parle de votre projet ?",
        title:
          "Vous avez le terrain. Nous apportons la stratégie et la force d’exécution.",
        text: "Dites-nous où vous en êtes, ce que vous voulez changer et ce que le projet doit produire concrètement.",
        label: "",
        href: "",
        mediaId: "",
      },
    },
    {
      key: "contact-form",
      type: "FORM",
      payload: {
        eyebrow: "Votre brief",
        title: "Parlons concret.",
        text: "",
        formKey: "contact",
        items: [
          "Réponse humaine",
          "Brief confidentiel",
          "Projet cadré avant production",
        ].map((title) => ({ title, text: "" })),
      },
    },
  ];
}

async function ensureWorld(
  worlds: PrismaWorldRepository,
  seed: WorldSeed,
): Promise<{ created: boolean }> {
  const keyResult = parseWorldKey(seed.key);
  if (!keyResult.ok) throw new Error(keyResult.error.message);

  const existing = await worlds.findByKey(keyResult.value);
  if (existing) return { created: false };

  const now = new Date();
  const created = createWorld({
    id: `world_${slugify(seed.key)}`,
    key: seed.key,
    displayName: seed.displayName,
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!created.ok) throw new Error(created.error.message);

  await worlds.save(created.value);
  return { created: true };
}

async function ensureFamily(
  dependencies: Parameters<typeof listServiceFamilies>[0],
  context: RequestContext,
  worldKey: string,
  label: string,
): Promise<{ id: string; created: boolean }> {
  const existingResult = await listServiceFamilies(dependencies, context, {
    worldKey,
  });
  if (!existingResult.ok) {
    throw new Error(
      `Failed to list service families: ${existingResult.error.message}`,
    );
  }

  const existing = existingResult.value.find(
    (family) => family.label === label,
  );
  if (existing) return { id: existing.id, created: false };

  const id = `family_${slugify(worldKey)}_${slugify(label)}`;
  const created = await createDraftServiceFamily(dependencies, context, {
    id,
    worldKey,
    label,
    order: existingResult.value.length,
  });
  if (!created.ok) {
    throw new Error(
      `Failed to create service family "${label}": ${created.error.message}`,
    );
  }

  return { id: created.value.id, created: true };
}

async function ensureService(
  dependencies: Parameters<typeof createDraftService>[0],
  context: RequestContext,
  worldKey: string,
  familyId: string,
  seed: ServiceSeed,
): Promise<{ created: boolean; approved: boolean }> {
  const id = `service_${slugify(worldKey)}_${slugify(seed.name)}`;
  const existing = await dependencies.services.findById(id);
  if (existing) return { created: false, approved: false };

  const created = await createDraftService(dependencies, context, {
    id,
    worldKey,
    familyId,
    name: seed.name,
    slug: slugify(seed.name),
    description: PLACEHOLDER_DESCRIPTION,
    availabilityStatus: seed.availabilityStatus,
  });
  if (!created.ok) {
    throw new Error(
      `Failed to create service "${seed.name}": ${created.error.message}`,
    );
  }

  if (!seed.approveAsCurrent) return { created: true, approved: false };

  const approved = await approveServiceAsCurrent(dependencies, context, {
    id: created.value.id,
    expectedVersion: created.value.version,
  });
  if (!approved.ok) {
    throw new Error(
      `Failed to approve service "${seed.name}": ${approved.error.message}`,
    );
  }

  return { created: true, approved: true };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
