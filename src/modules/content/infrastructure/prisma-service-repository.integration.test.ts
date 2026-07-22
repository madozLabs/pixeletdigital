import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import {
  approveServiceAsCurrent,
  createDraftService,
  publishService,
  submitServiceForReview,
  type Service,
} from "../domain/service";
import { PrismaServiceRepository } from "./prisma-service-repository";

let client: PrismaClient;
let repository: PrismaServiceRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaServiceRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaServiceRepository", () => {
  it("persists and reloads a draft service through Prisma", async () => {
    const service = draftService({ id: "service_test_01" });

    await repository.save(service);
    const persisted = await repository.findById(service.id);

    expect(persisted).toEqual(service);
  });

  it("round-trips a service through approval", async () => {
    const service = draftService({ id: "service_test_02" });
    await repository.save(service);

    const approved = approveServiceAsCurrent(service, service.updatedAt);
    if (!approved.ok) throw new Error("expected approval to succeed");
    await repository.save(approved.value);

    const persisted = await repository.findById(service.id);
    expect(persisted).toEqual(approved.value);
  });

  it("persists a null familyId", async () => {
    const service = draftService({ id: "service_test_03" });

    await repository.save(service);
    const persisted = await repository.findById(service.id);

    expect(persisted?.familyId).toBeNull();
  });

  it("returns null for a missing service", async () => {
    expect(await repository.findById("missing-service")).toBeNull();
  });

  it("rejects a service referencing an unknown world key", async () => {
    const orphan = draftService({
      id: "service_test_04",
      worldKey: "missing-world",
    });

    await expect(repository.save(orphan)).rejects.toThrow();
  });

  it("lists only published, approved-current services for a world", async () => {
    const approved = draftService({ id: "service_test_05" });
    const approvedResult = approveServiceAsCurrent(
      approved,
      approved.updatedAt,
    );
    if (!approvedResult.ok) throw new Error("expected approval to succeed");
    const inReview = submitServiceForReview(
      approvedResult.value,
      approvedResult.value.updatedAt,
    );
    if (!inReview.ok) throw new Error("expected submission to succeed");
    const published = publishService(inReview.value, inReview.value.updatedAt);
    if (!published.ok) throw new Error("expected publication to succeed");
    await repository.save(published.value);

    const candidate = draftService({ id: "service_test_06" });
    await repository.save(candidate);

    const found = await repository.listApprovedCurrentByWorld(
      "content-services-test-world",
    );

    expect(found.map((service) => service.id)).toEqual([published.value.id]);
  });
});

function validWorld() {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createWorld({
    id: "world_service_test",
    key: "content-services-test-world",
    displayName: "Services Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function draftService(
  overrides: Partial<{ id: string; worldKey: string }> = {},
): Service {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createDraftService({
    id: overrides.id ?? "service_test_default",
    worldKey: overrides.worldKey ?? "content-services-test-world",
    name: "Personalized Gadgets",
    description: "Custom-printed promotional gadgets.",
    availabilityStatus: "CURRENT_STATED",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
