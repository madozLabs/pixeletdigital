import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createWorld } from "@/modules/worlds/domain/world";
import { PrismaWorldRepository } from "@/modules/worlds/infrastructure/prisma-world-repository";

import { createDraftPage } from "../domain/page";
import { createPageSection, type PageSection } from "../domain/page-section";
import { PrismaPageRepository } from "./prisma-page-repository";
import { PrismaPageSectionRepository } from "./prisma-page-section-repository";

let client: PrismaClient;
let repository: PrismaPageSectionRepository;
let pages: PrismaPageRepository;
let worlds: PrismaWorldRepository;
let pageId: string;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL is required for database integration tests.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaPageSectionRepository(client);
  pages = new PrismaPageRepository(client);
  worlds = new PrismaWorldRepository(client);

  await worlds.save(validWorld());
  const page = draftPage();
  await pages.save(page);
  pageId = page.id;
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaPageSectionRepository", () => {
  it("persists and reloads a section with a structured payload", async () => {
    const section = validSection({ id: "section_test_01" });

    await repository.save(section);
    const persisted = await repository.findById(section.id);

    expect(persisted).toEqual(section);
  });

  it("lists sections for a page ordered by their position", async () => {
    const listPage = draftPage({
      id: "page_section_list_test",
      slug: "agence-list",
    });
    await pages.save(listPage);
    const second = validSection({
      id: "section_test_02",
      pageId: listPage.id,
      order: 1,
    });
    const first = validSection({
      id: "section_test_03",
      pageId: listPage.id,
      order: 0,
    });
    await repository.save(second);
    await repository.save(first);

    const found = await repository.listByPage(listPage.id);

    expect(found.map((section) => section.id)).toEqual([
      "section_test_03",
      "section_test_02",
    ]);
  });

  it("returns null for a missing section", async () => {
    expect(await repository.findById("missing-section")).toBeNull();
  });

  it("deletes a section", async () => {
    const section = validSection({ id: "section_test_04" });
    await repository.save(section);

    await repository.deleteById(section.id);

    expect(await repository.findById(section.id)).toBeNull();
  });

  it("rejects a section referencing an unknown page", async () => {
    const orphan = validSection({
      id: "section_test_05",
      pageId: "missing-page",
    });

    await expect(repository.save(orphan)).rejects.toThrow();
  });
});

function validWorld() {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createWorld({
    id: "world_section_test",
    key: "content-sections-test-world",
    displayName: "Sections Test World",
    mode: "ACTIVE",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function draftPage(overrides: Partial<{ id: string; slug: string }> = {}) {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createDraftPage({
    id: overrides.id ?? "page_section_test",
    worldKey: "content-sections-test-world",
    pageType: "STANDARD",
    title: "Agence",
    slug: overrides.slug ?? "agence",
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function validSection(
  overrides: Partial<{ id: string; pageId: string; order: number }> = {},
): PageSection {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const result = createPageSection({
    id: overrides.id ?? "section_test_default",
    pageId: overrides.pageId ?? pageId,
    sectionType: "HERO",
    order: overrides.order ?? 0,
    payload: { headline: "Bienvenue", nested: { count: 2 } },
    payloadSchemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}
