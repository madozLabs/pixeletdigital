import { describe, expect, it } from "vitest";

import {
  archiveServiceFamily,
  createDraftServiceFamily,
  editDraftServiceFamily,
  publishServiceFamily,
  rejectServiceFamily,
  restoreServiceFamily,
  submitServiceFamilyForReview,
} from "./service-family";

const now = new Date("2026-07-22T00:00:00.000Z");
const later = new Date("2026-07-23T00:00:00.000Z");

function validInput() {
  return {
    id: "family_01",
    worldKey: "pixel-digital",
    label: "Communication & Branding",
    order: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function draftFamily() {
  const result = createDraftServiceFamily(validInput());
  if (!result.ok) throw new Error("expected a valid draft family");
  return result.value;
}

describe("createDraftServiceFamily", () => {
  it("creates a family with version 1 and DRAFT lifecycle", () => {
    const result = createDraftServiceFamily(validInput());

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "DRAFT", version: 1, order: 0 },
    });
  });

  it("rejects an empty label", () => {
    const result = createDraftServiceFamily({ ...validInput(), label: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_LABEL" },
    });
  });

  it.each([-1, 1.5])("rejects an invalid order %s", (order) => {
    const result = createDraftServiceFamily({ ...validInput(), order });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ORDER" },
    });
  });
});

describe("editDraftServiceFamily", () => {
  it("updates label and order and bumps the version", () => {
    const result = editDraftServiceFamily(
      draftFamily(),
      { label: "Branding", order: 1 },
      later,
    );

    expect(result).toMatchObject({
      ok: true,
      value: { label: "Branding", version: 2 },
    });
  });

  it("rejects editing a family that is not a draft", () => {
    const submitted = submitServiceFamilyForReview(draftFamily(), later);
    if (!submitted.ok) throw new Error("expected submission to succeed");

    const result = editDraftServiceFamily(
      submitted.value,
      { label: "X", order: 0 },
      later,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("lifecycle transitions", () => {
  it("submits, publishes and archives a family", () => {
    const inReview = submitServiceFamilyForReview(draftFamily(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");
    expect(inReview.value.lifecycle).toBe("IN_REVIEW");

    const published = publishServiceFamily(inReview.value, later);
    if (!published.ok) throw new Error("expected publication to succeed");
    expect(published.value).toMatchObject({
      lifecycle: "PUBLISHED",
      publishedAt: later,
    });

    const archived = archiveServiceFamily(published.value, later);
    expect(archived).toMatchObject({
      ok: true,
      value: { lifecycle: "ARCHIVED" },
    });
  });

  it("returns a rejected family back to DRAFT", () => {
    const inReview = submitServiceFamilyForReview(draftFamily(), later);
    if (!inReview.ok) throw new Error("expected submission to succeed");

    const result = rejectServiceFamily(inReview.value, later);

    expect(result).toMatchObject({ ok: true, value: { lifecycle: "DRAFT" } });
  });
});

describe("restoreServiceFamily", () => {
  it("reconstructs a family in any controlled lifecycle state", () => {
    const result = restoreServiceFamily({
      ...validInput(),
      lifecycle: "PUBLISHED",
      version: 3,
      publishedAt: later,
    });

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "PUBLISHED", version: 3 },
    });
  });

  it("rejects an invalid lifecycle", () => {
    const result = restoreServiceFamily({
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
});
