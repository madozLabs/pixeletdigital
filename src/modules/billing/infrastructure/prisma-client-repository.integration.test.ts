import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { archiveClient, createClient, type Client } from "../domain/client";
import { PrismaClientRepository } from "./prisma-client-repository";

let client: PrismaClient;
let repository: PrismaClientRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaClientRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaClientRepository", () => {
  it("persists and reloads a client", async () => {
    const record = validClient({ id: "billing_client_test_01" });

    await repository.save(record);
    const persisted = await repository.findById(record.id);

    expect(persisted).toEqual(record);
  });

  it("persists a status transition", async () => {
    const record = validClient({ id: "billing_client_test_02" });
    await repository.save(record);
    const archived = archiveClient(
      record,
      new Date("2026-07-23T10:00:00.000Z"),
    );
    if (!archived.ok) throw new Error("expected archive to succeed");

    await repository.save(archived.value);
    const persisted = await repository.findById(record.id);

    expect(persisted).toEqual(archived.value);
  });

  it("lists clients for a world ordered by name", async () => {
    await repository.save(
      validClient({ id: "billing_client_test_03", name: "Zeta" }),
    );
    await repository.save(
      validClient({ id: "billing_client_test_04", name: "Alpha" }),
    );

    const found = await repository.listByWorld("billing-test-world");

    const indexAlpha = found.findIndex(
      (c) => c.id === "billing_client_test_04",
    );
    const indexZeta = found.findIndex((c) => c.id === "billing_client_test_03");
    expect(indexAlpha).toBeGreaterThanOrEqual(0);
    expect(indexZeta).toBeGreaterThanOrEqual(0);
    expect(indexAlpha).toBeLessThan(indexZeta);
  });

  it("returns null for a missing client", async () => {
    expect(await repository.findById("missing-billing-client")).toBeNull();
  });

  it("rejects a client referencing an unknown world key", async () => {
    const orphan = validClient({
      id: "billing_client_test_05",
      worldKey: "missing-world",
    });

    await expect(repository.save(orphan)).rejects.toThrow();
  });

  it("persists and reloads the professional fields", async () => {
    const now = new Date("2026-07-23T00:00:00.000Z");
    const created = createClient({
      id: "billing_client_test_06",
      worldKey: "billing-test-world",
      name: "Client Pro",
      legalName: "Client Pro SARL",
      industry: "Distribution",
      website: "https://client-pro.example.com",
      logoUrl: "https://client-pro.example.com/logo.png",
      notes: "Signé en juillet 2026.",
      createdAt: now,
      updatedAt: now,
    });
    if (!created.ok) throw new Error("expected a valid client");

    await repository.save(created.value);
    const persisted = await repository.findById(created.value.id);

    expect(persisted).toEqual(created.value);
  });
});

function validWorld() {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createWorld({
    id: "world_billing_client_test",
    key: "billing-test-world",
    displayName: "Billing Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validClient(
  overrides: Partial<{ id: string; worldKey: string; name: string }> = {},
): Client {
  const now = new Date("2026-07-23T00:00:00.000Z");
  const result = createClient({
    id: overrides.id ?? "billing_client_test_default",
    worldKey: overrides.worldKey ?? "billing-test-world",
    name: overrides.name ?? "Client A",
    email: "client@example.com",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
