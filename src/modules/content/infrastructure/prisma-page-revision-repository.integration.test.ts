import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";

import { transitionPageRevision } from "../domain/page-revision";
import { PrismaPageRevisionRepository } from "./prisma-page-revision-repository";

let client: PrismaClient;
let repository: PrismaPageRevisionRepository;

beforeAll(async () => {
  const connectionString = process.env.TEST_DATABASE_URL;
  if (!connectionString) throw new Error("TEST_DATABASE_URL is required.");
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  repository = new PrismaPageRevisionRepository(client);
  await client.world.create({
    data: {
      id: "world_revision_repository_test",
      key: "revision-repository-test",
      displayName: "Revision repository test",
      mode: "ACTIVE",
    },
  });
});

afterAll(async () => {
  await client.$disconnect();
});

describe("PrismaPageRevisionRepository", () => {
  it("clones published sections and atomically promotes the reviewed draft", async () => {
    const createdAt = new Date("2026-07-26T20:00:00.000Z");
    await client.page.create({
      data: {
        id: "page_revision_repository_test",
        worldKey: "revision-repository-test",
        pageType: "STANDARD",
        title: "Public title",
        slug: "revision-test",
        lifecycle: "PUBLISHED",
        version: 1,
        publishedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
      },
    });
    await client.pageRevision.create({
      data: {
        id: "revision_repository_published",
        pageId: "page_revision_repository_test",
        revisionNumber: 1,
        status: "PUBLISHED",
        title: "Public title",
        version: 1,
        publishedAt: createdAt,
        createdAt,
        updatedAt: createdAt,
        sections: {
          create: {
            id: "revision_repository_section",
            sectionKey: "hero",
            sectionType: "HERO",
            order: 0,
            payload: { title: "Public hero" },
            payloadSchemaVersion: 1,
            version: 1,
            createdAt,
            updatedAt: createdAt,
          },
        },
      },
    });
    await client.page.update({
      where: { id: "page_revision_repository_test" },
      data: { publishedRevisionId: "revision_repository_published" },
    });

    const draft = await repository.createDraftFromPublished({
      pageId: "page_revision_repository_test",
      sourceRevisionId: "revision_repository_published",
      actorId: "editor_test",
      now: new Date("2026-07-26T21:00:00.000Z"),
    });
    const cloned = await client.pageRevision.findUniqueOrThrow({
      where: { id: draft.id },
      include: { sections: true },
    });
    expect(cloned).toMatchObject({
      status: "DRAFT",
      revisionNumber: 2,
      sections: [{ sectionKey: "hero", payload: { title: "Public hero" } }],
    });
    expect(cloned.sections[0]?.id).not.toBe("revision_repository_section");

    // Editing the draft must not leak into the currently published revision.
    await client.pageRevisionSection.update({
      where: { id: cloned.sections[0]!.id },
      data: {
        payload: { title: "Composed draft hero" },
        version: { increment: 1 },
      },
    });
    expect(
      await client.pageRevisionSection.findUniqueOrThrow({
        where: { id: "revision_repository_section" },
        select: { payload: true },
      }),
    ).toEqual({ payload: { title: "Public hero" } });

    // Optimistic locking rejects a stale browser before any transition.
    expect(
      await repository.saveTransition({
        revision: { ...draft, status: "IN_REVIEW", version: draft.version + 1 },
        expectedVersion: 99,
        publish: false,
      }),
    ).toBe(false);

    let current = draft;
    for (const target of ["IN_REVIEW", "APPROVED", "PUBLISHED"] as const) {
      const changed = transitionPageRevision(
        current,
        target,
        "reviewer_test",
        new Date("2026-07-26T22:00:00.000Z"),
      );
      expect(changed.ok).toBe(true);
      if (!changed.ok) throw new Error(changed.error.message);
      expect(
        await repository.saveTransition({
          revision: changed.value,
          expectedVersion: current.version,
          publish: target === "PUBLISHED",
        }),
      ).toBe(true);
      current = changed.value;
    }

    expect(
      await client.page.findUniqueOrThrow({
        where: { id: "page_revision_repository_test" },
        select: { draftRevisionId: true, publishedRevisionId: true },
      }),
    ).toEqual({ draftRevisionId: null, publishedRevisionId: draft.id });
    expect(
      await client.pageRevision.findUniqueOrThrow({
        where: { id: "revision_repository_published" },
        select: { status: true },
      }),
    ).toEqual({ status: "SUPERSEDED" });
    expect(
      await client.pageRevisionSection.findFirstOrThrow({
        where: { revisionId: draft.id, sectionKey: "hero" },
        select: { payload: true },
      }),
    ).toEqual({ payload: { title: "Composed draft hero" } });
  });
});
