import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import {
  archiveCatalogueItem,
  createCatalogueItem,
  type CatalogueItem,
} from "../domain/catalogue-item";
import { PrismaCatalogueItemRepository } from "./prisma-catalogue-item-repository";

let client: PrismaClient;
let repository: PrismaCatalogueItemRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaCatalogueItemRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaCatalogueItemRepository", () => {
  it("persists and reloads an item", async () => {
    const record = validItem({ id: "billing_catalogue_test_01" });

    await repository.save(record);
    const persisted = await repository.findById(record.id);

    expect(persisted).toEqual(record);
  });

  it("persists a status transition", async () => {
    const record = validItem({ id: "billing_catalogue_test_02" });
    await repository.save(record);
    const archived = archiveCatalogueItem(
      record,
      new Date("2026-07-23T10:00:00.000Z"),
    );
    if (!archived.ok) throw new Error("expected archive to succeed");

    await repository.save(archived.value);
    const persisted = await repository.findById(record.id);

    expect(persisted).toEqual(archived.value);
  });

  it("lists items for a world", async () => {
    await repository.save(validItem({ id: "billing_catalogue_test_03" }));

    const found = await repository.listByWorld("billing-catalogue-test-world");

    expect(found.map((i) => i.id)).toContain("billing_catalogue_test_03");
  });

  it("returns null for a missing item", async () => {
    expect(await repository.findById("missing-catalogue-item")).toBeNull();
  });

  it("rejects an item referencing an unknown world key", async () => {
    const orphan = validItem({
      id: "billing_catalogue_test_04",
      worldKey: "missing-world",
    });

    await expect(repository.save(orphan)).rejects.toThrow();
  });
});

function validWorld() {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createWorld({
    id: "world_billing_catalogue_test",
    key: "billing-catalogue-test-world",
    displayName: "Billing Catalogue Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validItem(
  overrides: Partial<{ id: string; worldKey: string }> = {},
): CatalogueItem {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createCatalogueItem({
    id: overrides.id ?? "billing_catalogue_test_default",
    worldKey: overrides.worldKey ?? "billing-catalogue-test-world",
    label: "Création de logo",
    kind: "SERVICE",
    unitPriceCents: 45000,
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
