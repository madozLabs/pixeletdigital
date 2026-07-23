import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import {
  createDraftEditorialItem,
  markEditorialItemDone,
  type EditorialItem,
} from "../domain/editorial-item";
import { PrismaEditorialItemRepository } from "./prisma-editorial-item-repository";

let client: PrismaClient;
let repository: PrismaEditorialItemRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaEditorialItemRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaEditorialItemRepository", () => {
  it("persists and reloads a planned item", async () => {
    const item = validItem({ id: "editorial_test_01" });

    await repository.save(item);
    const persisted = await repository.findById(item.id);

    expect(persisted).toEqual(item);
  });

  it("persists a done item with proof link and realizedAt", async () => {
    const planned = validItem({ id: "editorial_test_02" });
    const doneResult = markEditorialItemDone(
      planned,
      "https://instagram.com/p/abc",
      new Date("2026-07-23T10:00:00.000Z"),
    );
    if (!doneResult.ok) throw new Error("expected transition to succeed");

    await repository.save(doneResult.value);
    const persisted = await repository.findById("editorial_test_02");

    expect(persisted).toEqual(doneResult.value);
  });

  it("lists items for a world ordered by scheduledFor", async () => {
    const later = validItem({
      id: "editorial_test_03",
      scheduledFor: new Date("2026-08-01T00:00:00.000Z"),
    });
    const earlier = validItem({
      id: "editorial_test_04",
      scheduledFor: new Date("2026-07-24T00:00:00.000Z"),
    });
    await repository.save(later);
    await repository.save(earlier);

    const found = await repository.listByWorld("editorial-test-world");

    const index04 = found.findIndex((item) => item.id === "editorial_test_04");
    const index03 = found.findIndex((item) => item.id === "editorial_test_03");
    expect(index04).toBeGreaterThanOrEqual(0);
    expect(index03).toBeGreaterThanOrEqual(0);
    expect(index04).toBeLessThan(index03);
  });

  it("returns null for a missing item", async () => {
    expect(await repository.findById("missing-editorial-item")).toBeNull();
  });

  it("rejects an item referencing an unknown world key", async () => {
    const orphan = validItem({
      id: "editorial_test_05",
      worldKey: "missing-world",
    });

    await expect(repository.save(orphan)).rejects.toThrow();
  });
});

function validWorld() {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createWorld({
    id: "world_editorial_test",
    key: "editorial-test-world",
    displayName: "Editorial Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validItem(
  overrides: Partial<{ id: string; worldKey: string; scheduledFor: Date }> = {},
): EditorialItem {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createDraftEditorialItem({
    id: overrides.id ?? "editorial_test_default",
    worldKey: overrides.worldKey ?? "editorial-test-world",
    clientLabel: "Client A",
    channel: "Instagram",
    title: "Post produit",
    scheduledFor:
      overrides.scheduledFor ?? new Date("2026-07-25T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
