import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createClient } from "../domain/client";
import { createClientContact } from "../domain/client-contact";
import { PrismaClientContactRepository } from "./prisma-client-contact-repository";
import { PrismaClientRepository } from "./prisma-client-repository";

let client: PrismaClient;
let repository: PrismaClientContactRepository;
let clientId: string;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaClientContactRepository(client);
  const clients = new PrismaClientRepository(client);
  const worlds = new PrismaWorldRepository(client);
  const now = new Date("2026-07-23T00:00:00.000Z");

  const worldResult = createWorld({
    id: "world_client_contact_test",
    key: "client-contact-test-world",
    displayName: "Client Contact Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!worldResult.ok) throw new Error(worldResult.error.message);
  await worlds.save(worldResult.value);

  const clientResult = createClient({
    id: "client_contact_test_client",
    worldKey: "client-contact-test-world",
    name: "Client A",
    createdAt: now,
    updatedAt: now,
  });
  if (!clientResult.ok) throw new Error(clientResult.error.message);
  await clients.save(clientResult.value);
  clientId = clientResult.value.id;
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaClientContactRepository", () => {
  it("persists a contact and lists it by client", async () => {
    const contactResult = createClientContact({
      id: "client_contact_test_01",
      clientId,
      name: "Jane Doe",
      role: "Directrice marketing",
      email: "jane@example.com",
      isPrimary: true,
      createdAt: new Date("2026-07-23T00:00:00.000Z"),
      updatedAt: new Date("2026-07-23T00:00:00.000Z"),
    });
    if (!contactResult.ok) throw new Error("expected a valid contact");

    await repository.save(contactResult.value);
    const found = await repository.listByClient(clientId);

    expect(found.map((c) => c.id)).toContain("client_contact_test_01");
  });

  it("unsets the previous primary contact for a client", async () => {
    await repository.unsetPrimaryForClient(clientId);
    const found = await repository.listByClient(clientId);

    expect(found.every((contact) => !contact.isPrimary)).toBe(true);
  });
});
