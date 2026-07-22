import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import {
  createDraftPage,
  publishPage,
  submitPageForReview,
} from "../domain/page";
import { createPageSection, type PageSection } from "../domain/page-section";
import {
  addPageSection,
  editPageSection,
  listPageSections,
  removePageSection,
} from "./page-section-use-cases";
import { InMemoryPageRepository } from "./testing/in-memory-page-repository";
import { InMemoryPageSectionRepository } from "./testing/in-memory-page-section-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-15T10:30:00.000Z");

describe("addPageSection", () => {
  it("allows an editor to add a section to a draft page", async () => {
    const dependencies = dependenciesWithPage(draftPage());

    const result = await addPageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      validAddInput(),
    );

    expect(result).toMatchObject({
      ok: true,
      value: { sectionType: "HERO", version: 1 },
    });
    expect(dependencies.sections.savedSections).toHaveLength(1);
  });

  it("denies a reader from adding a section", async () => {
    const dependencies = dependenciesWithPage(draftPage());

    const result = await addPageSection(
      dependencies,
      context("READER", [{ type: "GLOBAL" }]),
      validAddInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(dependencies.sections.savedSections).toHaveLength(0);
  });

  it("returns CONFLICT when the page is not a draft", async () => {
    const dependencies = dependenciesWithPage(publishedPage());

    const result = await addPageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      validAddInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(dependencies.sections.savedSections).toHaveLength(0);
  });

  it("returns NOT_FOUND when the page does not exist", async () => {
    const dependencies = {
      sections: new InMemoryPageSectionRepository(),
      pages: new InMemoryPageRepository(),
    };

    const result = await addPageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      validAddInput(),
    );

    expect(result).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
  });

  it("rejects an invalid section type without saving", async () => {
    const dependencies = dependenciesWithPage(draftPage());

    const result = await addPageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { ...validAddInput(), sectionType: "hero" },
    );

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_SECTION_TYPE",
      },
    });
    expect(dependencies.sections.savedSections).toHaveLength(0);
  });
});

describe("listPageSections", () => {
  it("returns sections ordered for an authorized reader", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);
    const second = section(page.id, { id: "section_02", order: 1 });
    const first = section(page.id, { id: "section_01", order: 0 });
    await dependencies.sections.save(second);
    await dependencies.sections.save(first);

    const result = await listPageSections(
      dependencies,
      context("READER", [{ type: "GLOBAL" }]),
      { pageId: page.id },
    );

    expect(result).toMatchObject({
      ok: true,
      value: [{ id: "section_01" }, { id: "section_02" }],
    });
  });
});

describe("editPageSection", () => {
  it("edits a section on a draft page and bumps the version", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);
    const existing = section(page.id);
    await dependencies.sections.save(existing);

    const result = await editPageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: existing.id,
        expectedVersion: existing.version,
        sectionType: "CTA",
        order: 1,
        payload: { label: "Contact" },
        payloadSchemaVersion: 1,
      },
    );

    expect(result).toMatchObject({
      ok: true,
      value: { sectionType: "CTA", version: 2 },
    });
  });

  it("returns CONFLICT on a stale version", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);
    const existing = section(page.id);
    await dependencies.sections.save(existing);

    const result = await editPageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: existing.id,
        expectedVersion: existing.version + 1,
        sectionType: "CTA",
        order: 1,
        payload: {},
        payloadSchemaVersion: 1,
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it("returns CONFLICT when the parent page is not a draft", async () => {
    const page = publishedPage();
    const dependencies = dependenciesWithPage(page);
    const existing = section(page.id);
    await dependencies.sections.save(existing);

    const result = await editPageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      {
        id: existing.id,
        expectedVersion: existing.version,
        sectionType: "CTA",
        order: 1,
        payload: {},
        payloadSchemaVersion: 1,
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });
});

describe("removePageSection", () => {
  it("removes a section from a draft page", async () => {
    const page = draftPage();
    const dependencies = dependenciesWithPage(page);
    const existing = section(page.id);
    await dependencies.sections.save(existing);

    const result = await removePageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { id: existing.id, expectedVersion: existing.version },
    );

    expect(result).toMatchObject({ ok: true });
    expect(dependencies.sections.deletedIds).toEqual([existing.id]);
  });

  it("denies removal when the parent page is not a draft", async () => {
    const page = publishedPage();
    const dependencies = dependenciesWithPage(page);
    const existing = section(page.id);
    await dependencies.sections.save(existing);

    const result = await removePageSection(
      dependencies,
      context("EDITOR", [{ type: "GLOBAL" }]),
      { id: existing.id, expectedVersion: existing.version },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    expect(dependencies.sections.deletedIds).toHaveLength(0);
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

function validAddInput() {
  return {
    id: "section_01",
    pageId: "page_01",
    sectionType: "HERO",
    order: 0,
    payload: { headline: "Bienvenue" },
    payloadSchemaVersion: 1,
  };
}

function draftPage() {
  const result = createDraftPage({
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

function publishedPage() {
  const draft = draftPage();
  const inReview = submitPageForReview(draft, createdAt);
  if (!inReview.ok) throw new Error("expected submission to succeed");
  const published = publishPage(inReview.value, createdAt);
  if (!published.ok) throw new Error("expected publication to succeed");
  return published.value;
}

function section(
  pageId: string,
  overrides: Partial<{ id: string; order: number }> = {},
): PageSection {
  const result = createPageSection({
    id: overrides.id ?? "section_01",
    pageId,
    sectionType: "HERO",
    order: overrides.order ?? 0,
    payload: { headline: "Bienvenue" },
    payloadSchemaVersion: 1,
    createdAt,
    updatedAt: createdAt,
  });
  if (!result.ok) throw new Error("expected a valid section");
  return result.value;
}

function dependenciesWithPage(page: ReturnType<typeof draftPage>) {
  return {
    sections: new InMemoryPageSectionRepository(),
    pages: new InMemoryPageRepository([page]),
  };
}
