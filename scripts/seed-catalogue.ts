import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";
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

    console.log(
      `Seed complete: ${createdWorlds} world(s), ${createdFamilies} family(ies), ${createdServices} service(s) created, ${approvedServices} approved as current. Re-running is safe -- existing records are left untouched.`,
    );
  } finally {
    await client.$disconnect();
  }
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
