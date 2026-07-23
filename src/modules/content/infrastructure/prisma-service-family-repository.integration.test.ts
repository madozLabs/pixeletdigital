import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createDraftService } from "../domain/service";
import {
  createDraftServiceFamily,
  publishServiceFamily,
  submitServiceFamilyForReview,
  type ServiceFamily,
} from "../domain/service-family";
import { PrismaServiceFamilyRepository } from "./prisma-service-family-repository";
import { PrismaServiceRepository } from "./prisma-service-repository";

let client: PrismaClient;
let repository: PrismaServiceFamilyRepository;
let services: PrismaServiceRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaServiceFamilyRepository(client);
  services = new PrismaServiceRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaServiceFamilyRepository", () => {
  it("persists and reloads a draft family", async () => {
    const family = validFamily({ id: "family_test_01", order: 0 });

    await repository.save(family);
    const persisted = await repository.findById(family.id);

    expect(persisted).toEqual(family);
  });

  it("lists families for a world ordered by position", async () => {
    const second = validFamily({ id: "family_test_02", order: 1 });
    const first = validFamily({ id: "family_test_03", order: 0 });
    await repository.save(second);
    await repository.save(first);

    const found = await repository.listByWorld("service-families-test-world");

    expect(found.map((f) => f.id)).toContain("family_test_02");
    expect(found.map((f) => f.id)).toContain("family_test_03");
    const index03 = found.findIndex((f) => f.id === "family_test_03");
    const index02 = found.findIndex((f) => f.id === "family_test_02");
    expect(index03).toBeLessThan(index02);
  });

  it("returns null for a missing family", async () => {
    expect(await repository.findById("missing-family")).toBeNull();
  });

  it("rejects a family referencing an unknown world key", async () => {
    const orphan = validFamily({
      id: "family_test_04",
      worldKey: "missing-world",
    });

    await expect(repository.save(orphan)).rejects.toThrow();
  });

  it("allows a service to reference an existing family and rejects an unknown one", async () => {
    const family = validFamily({ id: "family_test_05", order: 0 });
    await repository.save(family);

    const serviceResult = createDraftService({
      id: "service_family_test_01",
      worldKey: "service-families-test-world",
      familyId: family.id,
      name: "Création de logo",
      slug: "creation-de-logo-01",
      description: "Identité visuelle sur mesure.",
      availabilityStatus: "CURRENT_STATED",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
      updatedAt: new Date("2026-07-22T00:00:00.000Z"),
    });
    if (!serviceResult.ok) throw new Error(serviceResult.error.message);
    await expect(services.save(serviceResult.value)).resolves.not.toThrow();

    const orphanServiceResult = createDraftService({
      id: "service_family_test_02",
      worldKey: "service-families-test-world",
      familyId: "missing-family",
      name: "Création de logo",
      slug: "creation-de-logo-02",
      description: "Identité visuelle sur mesure.",
      availabilityStatus: "CURRENT_STATED",
      createdAt: new Date("2026-07-22T00:00:00.000Z"),
      updatedAt: new Date("2026-07-22T00:00:00.000Z"),
    });
    if (!orphanServiceResult.ok)
      throw new Error(orphanServiceResult.error.message);
    await expect(services.save(orphanServiceResult.value)).rejects.toThrow();
  });

  it("lists only published families for a world", async () => {
    const draft = validFamily({ id: "family_test_06", order: 0 });
    await repository.save(draft);

    const toPublish = validFamily({ id: "family_test_07", order: 1 });
    const inReview = submitServiceFamilyForReview(
      toPublish,
      toPublish.updatedAt,
    );
    if (!inReview.ok) throw new Error("expected submission to succeed");
    const published = publishServiceFamily(
      inReview.value,
      inReview.value.updatedAt,
    );
    if (!published.ok) throw new Error("expected publication to succeed");
    await repository.save(published.value);

    const found = await repository.listPublishedByWorld(
      "service-families-test-world",
    );

    expect(found.map((f) => f.id)).toContain("family_test_07");
    expect(found.map((f) => f.id)).not.toContain("family_test_06");
  });
});

function validWorld() {
  const now = new Date("2026-07-22T00:00:00.000Z");
  const result = createWorld({
    id: "world_service_family_test",
    key: "service-families-test-world",
    displayName: "Service Families Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validFamily(
  overrides: Partial<{ id: string; worldKey: string; order: number }> = {},
): ServiceFamily {
  const now = new Date("2026-07-22T00:00:00.000Z");
  const result = createDraftServiceFamily({
    id: overrides.id ?? "family_test_default",
    worldKey: overrides.worldKey ?? "service-families-test-world",
    label: "Communication & Branding",
    order: overrides.order ?? 0,
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
