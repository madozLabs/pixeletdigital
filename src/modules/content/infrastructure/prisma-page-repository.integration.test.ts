import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import {
  createDraftPage,
  publishPage,
  submitPageForReview,
  type Page,
} from "../domain/page";
import { PrismaPageRepository } from "./prisma-page-repository";

let client: PrismaClient;
let repository: PrismaPageRepository;
let worlds: PrismaWorldRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaPageRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaPageRepository", () => {
  it("persists and reloads a draft page through Prisma", async () => {
    const page = draftPage({ id: "page_test_01", slug: "agence" });

    await repository.save(page);
    const persisted = await repository.findById(page.id);

    expect(persisted).toEqual(page);
  });

  it("round-trips a page through review, publish and archive", async () => {
    const page = draftPage({ id: "page_test_02", slug: "kwaliti-print" });
    await repository.save(page);

    const inReview = submitPageForReview(page, page.updatedAt);
    if (!inReview.ok) throw new Error("expected submission to succeed");
    await repository.save(inReview.value);

    const published = publishPage(inReview.value, inReview.value.updatedAt);
    if (!published.ok) throw new Error("expected publication to succeed");
    await repository.save(published.value);

    const persisted = await repository.findById(page.id);
    expect(persisted).toEqual(published.value);
  });

  it("returns null for a missing page", async () => {
    expect(await repository.findById("missing-page")).toBeNull();
  });

  it("enforces unique active slug within a world and page type", async () => {
    const first = draftPage({ id: "page_test_03", slug: "unique-slug" });
    const duplicate = draftPage({ id: "page_test_04", slug: "unique-slug" });

    await repository.save(first);
    await expect(repository.save(duplicate)).rejects.toThrow();
  });

  it("rejects a page referencing an unknown world key", async () => {
    const orphan = draftPage({ id: "page_test_05", worldKey: "missing-world" });

    await expect(repository.save(orphan)).rejects.toThrow();
  });

  it("finds a published page by world and slug", async () => {
    const page = draftPage({ id: "page_test_06", slug: "published-lookup" });
    const inReview = submitPageForReview(page, page.updatedAt);
    if (!inReview.ok) throw new Error("expected submission to succeed");
    const published = publishPage(inReview.value, inReview.value.updatedAt);
    if (!published.ok) throw new Error("expected publication to succeed");
    await repository.save(published.value);

    const found = await repository.findPublishedByWorldAndSlug(
      "content-pages-test-world",
      "published-lookup",
    );

    expect(found).toEqual(published.value);
  });

  it("does not find a draft page by world and slug", async () => {
    const page = draftPage({ id: "page_test_07", slug: "draft-lookup" });
    await repository.save(page);

    const found = await repository.findPublishedByWorldAndSlug(
      "content-pages-test-world",
      "draft-lookup",
    );

    expect(found).toBeNull();
  });
});

function validWorld() {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createWorld({
    id: "world_page_test",
    key: "content-pages-test-world",
    displayName: "Pixel&Digital",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function draftPage(
  overrides: Partial<{ id: string; worldKey: string; slug: string }> = {},
): Page {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createDraftPage({
    id: overrides.id ?? "page_test_default",
    worldKey: overrides.worldKey ?? "content-pages-test-world",
    pageType: "STANDARD",
    title: "Agence",
    slug: overrides.slug ?? "agence-default",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
