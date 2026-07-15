import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

import { createWorld, type World } from "../domain/world";
import { PrismaWorldRepository } from "./prisma-world-repository";

let client: PrismaClient;
let repository: PrismaWorldRepository;

beforeAll(() => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaWorldRepository(client);
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaWorldRepository", () => {
  it("persists and reloads a valid World through Prisma", async () => {
    const world = validWorld({ id: "world_test_01", key: "test-world" });

    await repository.save(world);
    const persisted = await repository.findByKey(world.key);

    expect(persisted).toEqual(
      expect.objectContaining({
        id: world.id,
        key: world.key,
        displayName: world.displayName,
        mode: world.mode,
      }),
    );
  });

  it("updates governed fields for the same opaque id", async () => {
    const initial = validWorld({ id: "world_test_02", key: "editable-world" });
    await repository.save(initial);

    const updated = validWorld({
      id: initial.id,
      key: initial.key,
      displayName: "Updated World",
      mode: "INACTIVE",
    });
    await repository.save(updated);

    expect(await repository.findByKey(initial.key)).toEqual(
      expect.objectContaining({
        displayName: "Updated World",
        mode: "INACTIVE",
      }),
    );
  });

  it("enforces stable key uniqueness at the database boundary", async () => {
    const first = validWorld({ id: "world_test_03", key: "unique-world" });
    const duplicate = validWorld({ id: "world_test_04", key: first.key });

    await repository.save(first);
    await expect(repository.save(duplicate)).rejects.toThrow();
  });
});

function validWorld(
  overrides: Partial<{
    id: string;
    key: string;
    displayName: string;
    mode: "ACTIVE" | "TEASER" | "INACTIVE";
  }> = {},
): World {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createWorld({
    id: overrides.id ?? "world_test_default",
    key: overrides.key ?? "default-world",
    displayName: overrides.displayName ?? "Test World",
    mode: overrides.mode ?? "TEASER",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
