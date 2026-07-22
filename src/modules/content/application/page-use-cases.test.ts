import { describe, expect, it } from "vitest";

import { createWorld } from "@/modules/worlds/domain/world";
import { InMemoryWorldRepository } from "@/modules/worlds/application/testing/in-memory-world-repository";
import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import {
  createDraftPage as createDraftPageDomain,
  type Page,
} from "../domain/page";
import {
  archivePage,
  createDraftPage,
  editDraftPage,
  getPageById,
  publishPage,
  rejectPage,
  submitPageForReview,
} from "./page-use-cases";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-15T10:30:00.000Z");

describe("createDraftPage", () => {
  it.each<ApprovedRole>(["SUPER_ADMIN", "ADMIN", "WORLD_MANAGER", "EDITOR"])(
    "allows %s with a matching world scope to create a draft",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftPage(
        dependencies,
        context(role, [{ type: "WORLD", worldKey: "pixel-digital" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({
        ok: true,
        value: { lifecycle: "DRAFT", version: 1, worldKey: "pixel-digital" },
      });
      expect(dependencies.pages.savedPages).toHaveLength(1);
    },
  );

  it.each<ApprovedRole>(["SALES", "CONTRIBUTOR", "READER"])(
    "denies %s even with global scope without saving",
    async (role) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftPage(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        validCreateInput(),
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
      expect(dependencies.pages.savedPages).toHaveLength(0);
    },
  );

  it("denies EDITOR without a matching world scope", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await createDraftPage(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: "kwaliti-print" }]),
      validCreateInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });

  it.each([
    ["missing actor", anonymousContext()],
    ["inactive actor", context("EDITOR", [{ type: "GLOBAL" }], false)],
  ])(
    "returns UNAUTHENTICATED for a %s without side effects",
    async (_, requestContext) => {
      const dependencies = dependenciesWithWorld();

      const result = await createDraftPage(
        dependencies,
        requestContext as RequestContext,
        validCreateInput(),
      );

      expect(result).toMatchObject({
        ok: false,
        error: { code: "UNAUTHENTICATED" },
      });
      expect(dependencies.pages.savedPages).toHaveLength(0);
    },
  );

  it("returns VALIDATION_ERROR for an invalid worldKey", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await createDraftPage(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { ...validCreateInput(), worldKey: "Invalid Key" },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_WORLD_KEY" },
    });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });

  it("returns NOT_FOUND when the world does not exist", async () => {
    const dependencies = {
      pages: new InMemoryPageRepository(),
      worlds: new InMemoryWorldRepository(),
    };

    const result = await createDraftPage(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      validCreateInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });

  it("denies drafting a page for an INACTIVE world", async () => {
    const dependencies = dependenciesWithWorld({ mode: "INACTIVE" });

    const result = await createDraftPage(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      validCreateInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });

  it("rejects an invalid title without saving", async () => {
    const dependencies = dependenciesWithWorld();

    const result = await createDraftPage(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { ...validCreateInput(), title: "   " },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_TITLE" },
    });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });
});

describe("getPageById", () => {
  it.each<ApprovedRole>([
    "SUPER_ADMIN",
    "ADMIN",
    "WORLD_MANAGER",
    "EDITOR",
    "SALES",
    "CONTRIBUTOR",
    "READER",
  ])("allows %s to read with a matching world scope", async (role) => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await getPageById(
      dependencies,
      context(role, [{ type: "WORLD", worldKey: page.worldKey }]),
      { id: page.id },
    );

    expect(result).toEqual({ ok: true, value: page });
  });

  it("returns UNAUTHENTICATED without reading", async () => {
    const dependencies = dependenciesWithPage(draftPage());

    const result = await getPageById(dependencies, anonymousContext(), {
      id: "missing",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(dependencies.pages.foundIds).toHaveLength(0);
  });

  it("returns NOT_FOUND for a missing page", async () => {
    const dependencies = dependenciesWithPage(draftPage());

    const result = await getPageById(
      dependencies,
      context("READER", [{ type: "GLOBAL" }]),
      {
        id: "missing",
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("returns FORBIDDEN when scopes do not cover the page's world", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await getPageById(
      dependencies,
      context("READER", [{ type: "WORLD", worldKey: "other-world" }]),
      { id: page.id },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("submitPageForReview", () => {
  it("moves a draft page to IN_REVIEW for an authorized editor", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await submitPageForReview(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: page.worldKey }]),
      { id: page.id, expectedVersion: page.version },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "IN_REVIEW" },
    });
    expect(dependencies.pages.savedPages).toHaveLength(1);
  });

  it("returns CONFLICT on a stale version without saving", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await submitPageForReview(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { id: page.id, expectedVersion: page.version + 1 },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });

  it("returns FORBIDDEN for a reader without saving", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await submitPageForReview(
      dependencies,
      context("READER", [{ type: "GLOBAL" }]),
      {
        id: page.id,
        expectedVersion: page.version,
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });
});

describe("rejectPage and publishPage", () => {
  it("allows a WORLD_MANAGER to reject a page in review back to DRAFT", async () => {
    const page = inReviewPage();
    const dependencies = dependenciesWithPage(page);

    const result = await rejectPage(
      dependencies,
      context("WORLD_MANAGER", [{ type: "WORLD", worldKey: page.worldKey }]),
      { id: page.id, expectedVersion: page.version },
    );

    expect(result).toMatchObject({ ok: true, value: { lifecycle: "DRAFT" } });
  });

  it("denies an EDITOR from publishing", async () => {
    const page = inReviewPage();
    const dependencies = dependenciesWithPage(page);

    const result = await publishPage(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: page.worldKey }]),
      { id: page.id, expectedVersion: page.version },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });

  it("allows an ADMIN to publish a page in review", async () => {
    const page = inReviewPage();
    const dependencies = dependenciesWithPage(page);

    const result = await publishPage(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: page.id,
        expectedVersion: page.version,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "PUBLISHED", publishedAt: clockTime },
    });
  });

  it("surfaces a domain transition error as VALIDATION_ERROR", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await publishPage(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        id: page.id,
        expectedVersion: page.version,
      },
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "VALIDATION_ERROR", validationCode: "INVALID_TRANSITION" },
    });
    expect(dependencies.pages.savedPages).toHaveLength(0);
  });
});

describe("editDraftPage and archivePage", () => {
  it("edits a draft page and bumps the version", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await editDraftPage(
      dependencies,
      context("EDITOR", [{ type: "WORLD", worldKey: page.worldKey }]),
      {
        id: page.id,
        expectedVersion: page.version,
        title: "Nouveau titre",
        slug: "nouveau-titre",
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: {
        title: "Nouveau titre",
        slug: "nouveau-titre",
        version: page.version + 1,
      },
    });
  });

  it("archives a draft page for an authorized reviewer", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);

    const result = await archivePage(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      {
        id: page.id,
        expectedVersion: page.version,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "ARCHIVED" },
    });
  });

  it("returns NOT_FOUND when archiving a missing page", async () => {
    const dependencies = dependenciesWithPage(draftPage());

    const result = await archivePage(
      dependencies,
      context("SUPER_ADMIN", [{ type: "GLOBAL" }]),
      {
        id: "missing",
        expectedVersion: 1,
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });
});

function fixedClock(): Clock {
  return { now: () => clockTime };
}

function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[],
  active = true,
  clock: Clock = fixedClock(),
): RequestContext {
  return {
    actor: { id: "user_01", active, role, scopes },
    correlationId: "correlation_01",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}

function anonymousContext(clock: Clock = fixedClock()): RequestContext {
  return {
    actor: null,
    correlationId: "correlation_01",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}

function validCreateInput() {
  return {
    id: "page_01",
    worldKey: "pixel-digital",
    pageType: "STANDARD",
    title: "Agence",
    slug: "agence",
  };
}

function draftPage(): Page {
  const result = createDraftPageDomain({
    id: "page_01",
    worldKey: "pixel-digital",
    pageType: "STANDARD",
    title: "Agence",
    slug: "agence",
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid draft page");
  return result.value;
}

function inReviewPage(): Page {
  const page = draftPage();
  return { ...page, lifecycle: "IN_REVIEW", version: page.version + 1 };
}

function dependenciesWithWorld(
  overrides: Partial<{ mode: "ACTIVE" | "TEASER" | "INACTIVE" }> = {},
) {
  const world = createWorld({
    id: "world_01",
    key: "pixel-digital",
    displayName: "Pixel&Digital",
    mode: overrides.mode ?? "ACTIVE",
    createdAt,
    updatedAt: createdAt,
  });
  if (!world.ok) throw new Error("expected a valid world");

  return {
    pages: new InMemoryPageRepository(),
    worlds: new InMemoryWorldRepository([world.value]),
  };
}

function dependenciesWithPage(page: Page) {
  return {
    pages: new InMemoryPageRepository([page]),
    worlds: new InMemoryWorldRepository(),
  };
}
