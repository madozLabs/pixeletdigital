import { describe, expect, it } from "vitest";

import {
  archivePage,
  createDraftPage,
  editDraftPage,
  publishPage,
  rejectPage,
  restorePage,
  submitPageForReview,
} from "./page";

const now = new Date("2026-07-15T00:00:00.000Z");
const later = new Date("2026-07-16T00:00:00.000Z");

function validInput() {
  return {
    id: "page_01",
    worldKey: "pixel-digital",
    pageType: "STANDARD",
    title: "Agence",
    slug: "agence",
    createdAt: now,
    updatedAt: now,
  };
}

function draftPage() {
  const result = createDraftPage(validInput());
  if (!result.ok) throw new Error("expected a valid draft page");
  return result.value;
}

describe("createDraftPage", () => {
  it("creates a page in the DRAFT lifecycle with version 1", () => {
    const result = createDraftPage(validInput());

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "DRAFT", version: 1, publishedAt: null },
    });
  });

  it("normalizes surrounding whitespace on title and slug", () => {
    const result = createDraftPage({
      ...validInput(),
      title: " Agence ",
      slug: " agence ",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { title: "Agence", slug: "agence" },
    });
  });

  it("rejects an empty worldKey", () => {
    const result = createDraftPage({ ...validInput(), worldKey: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_WORLD_KEY" },
    });
  });

  it("rejects an empty page type", () => {
    const result = createDraftPage({ ...validInput(), pageType: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_PAGE_TYPE" },
    });
  });

  it("rejects an empty title", () => {
    const result = createDraftPage({ ...validInput(), title: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TITLE" },
    });
  });

  it.each([
    "Agence",
    "-agence",
    "agence-",
    "agence--publique",
    "agence publique",
  ])("rejects an invalid slug %s", (slug) => {
    const result = createDraftPage({ ...validInput(), slug });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SLUG" },
    });
  });
});

describe("editDraftPage", () => {
  it("updates title and slug and bumps the version", () => {
    const result = editDraftPage(
      draftPage(),
      { title: "Agence digitale", slug: "agence-digitale" },
      later,
    );

    expect(result).toMatchObject({
      ok: true,
      value: { title: "Agence digitale", slug: "agence-digitale", version: 2 },
    });
  });

  it("rejects editing a page that is not a draft", () => {
    const submitted = submitPageForReview(draftPage(), later);
    if (!submitted.ok) throw new Error("expected submission to succeed");

    const result = editDraftPage(
      submitted.value,
      { title: "X", slug: "x" },
      later,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });

  it("rejects an invalid slug on edit", () => {
    const result = editDraftPage(
      draftPage(),
      { title: "Agence", slug: "Agence" },
      later,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SLUG" },
    });
  });
});

describe("page lifecycle transitions", () => {
  it("moves a draft page to IN_REVIEW", () => {
    const result = submitPageForReview(draftPage(), later);

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "IN_REVIEW", version: 2 },
    });
  });

  it("rejects submitting a page that is not a draft", () => {
    const inReview = submitPageForReview(draftPage(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");

    const result = submitPageForReview(inReview.value, later);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });

  it("returns a rejected page in review back to DRAFT", () => {
    const inReview = submitPageForReview(draftPage(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");

    const result = rejectPage(inReview.value, later);

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "DRAFT", version: 3 },
    });
  });

  it("rejects rejecting a page that is not in review", () => {
    const result = rejectPage(draftPage(), later);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });

  it("publishes a page in review and sets publishedAt", () => {
    const inReview = submitPageForReview(draftPage(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");

    const result = publishPage(inReview.value, later);

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "PUBLISHED", version: 3, publishedAt: later },
    });
  });

  it("rejects publishing a page that is not in review", () => {
    const result = publishPage(draftPage(), later);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });

  it("archives a draft, in-review, or published page", () => {
    expect(archivePage(draftPage(), later)).toMatchObject({
      ok: true,
      value: { lifecycle: "ARCHIVED" },
    });

    const inReview = submitPageForReview(draftPage(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");
    expect(archivePage(inReview.value, later)).toMatchObject({
      ok: true,
      value: { lifecycle: "ARCHIVED" },
    });

    const published = publishPage(inReview.value, later);
    if (!published.ok) throw new Error("expected publication to succeed");
    expect(archivePage(published.value, later)).toMatchObject({
      ok: true,
      value: { lifecycle: "ARCHIVED" },
    });
  });

  it("rejects archiving an already archived page", () => {
    const archived = archivePage(draftPage(), later);
    if (!archived.ok) throw new Error("expected archival to succeed");

    const result = archivePage(archived.value, later);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("restorePage", () => {
  it("reconstructs a page in any controlled lifecycle state", () => {
    const result = restorePage({
      ...validInput(),
      lifecycle: "PUBLISHED",
      version: 3,
      publishedAt: later,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "PUBLISHED", version: 3, publishedAt: later },
    });
  });

  it("round-trips a page through its lifecycle transitions", () => {
    const inReview = submitPageForReview(draftPage(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");
    const published = publishPage(inReview.value, later);
    if (!published.ok) throw new Error("expected publication to succeed");

    const restored = restorePage(published.value);

    expect(restored).toEqual({ ok: true, value: published.value });
  });

  it("rejects a lifecycle outside the controlled vocabulary", () => {
    const result = restorePage({
      ...validInput(),
      lifecycle: "DELETED",
      version: 1,
      publishedAt: null,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_LIFECYCLE_STATE" },
    });
  });

  it.each([0, -1, 1.5])("rejects an invalid version %s", (version) => {
    const result = restorePage({
      ...validInput(),
      lifecycle: "DRAFT",
      version,
      publishedAt: null,
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_VERSION" },
    });
  });
});
