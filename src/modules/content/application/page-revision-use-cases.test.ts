import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type { ApprovedRole, RequestContext } from "@/shared/request-context";

import type { PageRevision } from "../domain/page-revision";
import type {
  PageRevisionRepository,
  RevisionPageState,
} from "./page-revision-repository";
import {
  movePageRevision,
  startPageDraft,
  updatePageDraftMetadata,
} from "./page-revision-use-cases";

const now = new Date("2026-07-26T21:00:00.000Z");

describe("page revision use cases", () => {
  it("copies the published revision into a private draft", async () => {
    const repository = new InMemoryRevisionRepository();

    const result = await startPageDraft(
      { revisions: repository },
      context("EDITOR"),
      { pageId: "page_1" },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { status: "DRAFT", revisionNumber: 2, title: "Published title" },
    });
    expect(repository.page.publishedRevisionId).toBe("revision_published");
    expect(repository.revisions.get("revision_published")?.status).toBe(
      "PUBLISHED",
    );
  });

  it("prevents an editor from approving a revision", async () => {
    const repository = repositoryWithDraft("IN_REVIEW");

    const result = await movePageRevision(
      { revisions: repository },
      context("EDITOR"),
      transitionInput("APPROVED"),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(repository.revisions.get("revision_draft")?.status).toBe(
      "IN_REVIEW",
    );
  });

  it("requires the exact page draft and expected version", async () => {
    const repository = repositoryWithDraft();

    const wrongPage = await updatePageDraftMetadata(
      { revisions: repository },
      context("EDITOR"),
      {
        pageId: "page_1",
        revisionId: "revision_published",
        expectedVersion: 1,
        title: "Forged",
        seoTitle: "",
        seoDescription: "",
        ogImageMediaId: "",
      },
    );
    const stale = await updatePageDraftMetadata(
      { revisions: repository },
      context("EDITOR"),
      {
        pageId: "page_1",
        revisionId: "revision_draft",
        expectedVersion: 99,
        title: "Stale",
        seoTitle: "",
        seoDescription: "",
        ogImageMediaId: "",
      },
    );

    expect(wrongPage).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(stale).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(repository.revisions.get("revision_draft")?.title).toBe(
      "Draft title",
    );
  });

  it("publishes only after review and preserves the former public revision", async () => {
    const repository = repositoryWithDraft("APPROVED");

    const result = await movePageRevision(
      { revisions: repository },
      context("WORLD_MANAGER"),
      transitionInput("PUBLISHED"),
    );

    expect(result).toMatchObject({ ok: true, value: { status: "PUBLISHED" } });
    expect(repository.page).toMatchObject({
      draftRevisionId: null,
      publishedRevisionId: "revision_draft",
    });
    expect(repository.revisions.get("revision_published")?.status).toBe(
      "SUPERSEDED",
    );
  });

  it("runs the complete draft, edit, review, approval and publication journey", async () => {
    const repository = new InMemoryRevisionRepository();
    const started = await startPageDraft(
      { revisions: repository },
      context("EDITOR"),
      { pageId: "page_1" },
    );
    expect(started.ok).toBe(true);

    const edited = await updatePageDraftMetadata(
      { revisions: repository },
      context("EDITOR"),
      {
        pageId: "page_1",
        revisionId: "revision_draft",
        expectedVersion: 1,
        title: "Ready for review",
        seoTitle: "Reviewed SEO title",
        seoDescription: "Reviewed SEO description",
        ogImageMediaId: "",
      },
    );
    expect(edited).toMatchObject({ ok: true, value: { version: 2 } });

    const reviewed = await movePageRevision(
      { revisions: repository },
      context("EDITOR"),
      transitionInput("IN_REVIEW", 2),
    );
    expect(reviewed).toMatchObject({
      ok: true,
      value: { status: "IN_REVIEW", version: 3 },
    });

    const approved = await movePageRevision(
      { revisions: repository },
      context("WORLD_MANAGER"),
      transitionInput("APPROVED", 3),
    );
    expect(approved).toMatchObject({
      ok: true,
      value: { status: "APPROVED", version: 4 },
    });

    const published = await movePageRevision(
      { revisions: repository },
      context("WORLD_MANAGER"),
      transitionInput("PUBLISHED", 4),
    );
    expect(published).toMatchObject({
      ok: true,
      value: { status: "PUBLISHED", version: 5 },
    });
    expect(repository.page).toMatchObject({
      draftRevisionId: null,
      publishedRevisionId: "revision_draft",
    });
    expect(repository.revisions.get("revision_published")?.status).toBe(
      "SUPERSEDED",
    );
  });
});

class InMemoryRevisionRepository implements PageRevisionRepository {
  page: RevisionPageState = {
    id: "page_1",
    worldKey: "pixel-digital",
    draftRevisionId: null,
    publishedRevisionId: "revision_published",
  };
  revisions = new Map<string, PageRevision>([
    ["revision_published", revision()],
  ]);

  async findPage(id: string) {
    return id === this.page.id ? this.page : null;
  }

  async findRevision(id: string) {
    return this.revisions.get(id) ?? null;
  }

  async createDraftFromPublished(input: {
    pageId: string;
    sourceRevisionId: string | null;
    actorId: string;
    now: Date;
  }) {
    const source = this.revisions.get(input.sourceRevisionId ?? "");
    const draft = revision({
      id: "revision_draft",
      status: "DRAFT",
      title: source?.title ?? "Untitled",
      revisionNumber: 2,
      createdById: input.actorId,
      createdAt: input.now,
      updatedAt: input.now,
    });
    this.revisions.set(draft.id, draft);
    this.page = { ...this.page, draftRevisionId: draft.id };
    return draft;
  }

  async saveDraft(input: { revision: PageRevision; expectedVersion: number }) {
    const current = this.revisions.get(input.revision.id);
    if (
      !current ||
      current.version !== input.expectedVersion ||
      this.page.draftRevisionId !== current.id
    ) {
      return false;
    }
    this.revisions.set(input.revision.id, input.revision);
    return true;
  }

  async saveTransition(input: {
    revision: PageRevision;
    expectedVersion: number;
    publish: boolean;
  }) {
    const current = this.revisions.get(input.revision.id);
    if (!current || current.version !== input.expectedVersion) return false;
    this.revisions.set(input.revision.id, input.revision);
    if (input.publish) {
      const previousId = this.page.publishedRevisionId;
      if (previousId) {
        const previous = this.revisions.get(previousId);
        if (previous) {
          this.revisions.set(previousId, { ...previous, status: "SUPERSEDED" });
        }
      }
      this.page = {
        ...this.page,
        draftRevisionId: null,
        publishedRevisionId: input.revision.id,
      };
    }
    return true;
  }
}

function repositoryWithDraft(status: PageRevision["status"] = "DRAFT") {
  const repository = new InMemoryRevisionRepository();
  repository.page = { ...repository.page, draftRevisionId: "revision_draft" };
  repository.revisions.set(
    "revision_draft",
    revision({ id: "revision_draft", status, title: "Draft title" }),
  );
  return repository;
}

function revision(overrides: Partial<PageRevision> = {}): PageRevision {
  return {
    id: "revision_published",
    pageId: "page_1",
    revisionNumber: 1,
    status: "PUBLISHED",
    title: "Published title",
    seoTitle: null,
    seoDescription: null,
    ogImageMediaId: null,
    version: 1,
    createdById: "author_1",
    reviewedById: "reviewer_1",
    publishedById: "publisher_1",
    reviewedAt: now,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function context(role: ApprovedRole): RequestContext {
  const clock: Clock = { now: () => new Date(now) };
  return {
    actor: {
      id: "actor_1",
      active: true,
      role,
      scopes: [{ type: "WORLD", worldKey: "pixel-digital" }],
    },
    correlationId: "correlation_1",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}

function transitionInput(target: PageRevision["status"], expectedVersion = 1) {
  return {
    pageId: "page_1",
    revisionId: "revision_draft",
    expectedVersion,
    target,
  };
}
