import { describe, expect, it } from "vitest";

import {
  createPageSection,
  editPageSection,
  restorePageSection,
} from "./page-section";

const now = new Date("2026-07-15T00:00:00.000Z");
const later = new Date("2026-07-16T00:00:00.000Z");

function validInput() {
  return {
    id: "section_01",
    pageId: "page_01",
    sectionType: "HERO",
    order: 0,
    payload: { headline: "Bienvenue" },
    payloadSchemaVersion: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe("createPageSection", () => {
  it("creates a section with version 1", () => {
    const result = createPageSection(validInput());

    expect(result).toMatchObject({
      ok: true,
      value: { sectionType: "HERO", order: 0, version: 1 },
    });
  });

  it.each(["hero", "Hero", "HERO SECTION", "1HERO", "H"])(
    "rejects an invalid section type %s",
    (sectionType) => {
      const result = createPageSection({ ...validInput(), sectionType });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_SECTION_TYPE" },
      });
    },
  );

  it("accepts an underscore-separated section type", () => {
    const result = createPageSection({
      ...validInput(),
      sectionType: "SERVICE_LIST",
    });

    expect(result).toMatchObject({
      ok: true,
      value: { sectionType: "SERVICE_LIST" },
    });
  });

  it.each([-1, 1.5])("rejects an invalid order %s", (order) => {
    const result = createPageSection({ ...validInput(), order });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_ORDER" },
    });
  });

  it.each([null, "text", ["a", "b"], 42])(
    "rejects a non-object payload",
    (payload) => {
      const result = createPageSection({
        ...validInput(),
        payload: payload as never,
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_PAYLOAD" },
      });
    },
  );

  it.each([0, -1, 1.5])(
    "rejects an invalid payload schema version %s",
    (payloadSchemaVersion) => {
      const result = createPageSection({
        ...validInput(),
        payloadSchemaVersion,
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "INVALID_PAYLOAD_SCHEMA_VERSION" },
      });
    },
  );

  it("rejects an empty pageId", () => {
    const result = createPageSection({ ...validInput(), pageId: "   " });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_PAGE_ID" },
    });
  });
});

describe("editPageSection", () => {
  function section() {
    const result = createPageSection(validInput());
    if (!result.ok) throw new Error("expected a valid section");
    return result.value;
  }

  it("updates fields and bumps the version", () => {
    const result = editPageSection(
      section(),
      {
        sectionType: "CTA",
        order: 2,
        payload: { label: "Contact" },
        payloadSchemaVersion: 2,
      },
      later,
    );

    expect(result).toMatchObject({
      ok: true,
      value: { sectionType: "CTA", order: 2, version: 2 },
    });
  });

  it("rejects an invalid section type on edit", () => {
    const result = editPageSection(
      section(),
      { sectionType: "cta", order: 0, payload: {}, payloadSchemaVersion: 1 },
      later,
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_SECTION_TYPE" },
    });
  });
});

describe("restorePageSection", () => {
  it("reconstructs a section with an arbitrary persisted version", () => {
    const result = restorePageSection({ ...validInput(), version: 5 });

    expect(result).toMatchObject({ ok: true, value: { version: 5 } });
  });

  it("rejects a non-positive version", () => {
    const result = restorePageSection({ ...validInput(), version: 0 });

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_VERSION" },
    });
  });
});
