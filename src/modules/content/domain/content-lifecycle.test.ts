import { describe, expect, it } from "vitest";

import {
  archive,
  publish,
  reject,
  submitForReview,
  type Lifecycled,
} from "./content-lifecycle";

const now = new Date("2026-07-15T00:00:00.000Z");
const later = new Date("2026-07-16T00:00:00.000Z");

function entity(overrides: Partial<Lifecycled> = {}): Lifecycled {
  return {
    lifecycle: "DRAFT",
    version: 1,
    publishedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

describe("submitForReview", () => {
  it("moves a draft entity to IN_REVIEW and bumps the version", () => {
    const result = submitForReview(entity(), later, "page");

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "IN_REVIEW", version: 2 },
    });
  });

  it("rejects submitting an entity that is not a draft", () => {
    const result = submitForReview(
      entity({ lifecycle: "IN_REVIEW" }),
      later,
      "page",
    );

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("reject", () => {
  it("returns an in-review entity back to DRAFT", () => {
    const result = reject(
      entity({ lifecycle: "IN_REVIEW", version: 2 }),
      later,
      "page",
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "DRAFT", version: 3 },
    });
  });

  it("rejects rejecting an entity that is not in review", () => {
    const result = reject(entity(), later, "page");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("publish", () => {
  it("publishes an in-review entity and sets publishedAt", () => {
    const result = publish(
      entity({ lifecycle: "IN_REVIEW", version: 2 }),
      later,
      "page",
    );

    expect(result).toMatchObject({
      ok: true,
      value: { lifecycle: "PUBLISHED", version: 3, publishedAt: later },
    });
  });

  it("rejects publishing an entity that is not in review", () => {
    const result = publish(entity(), later, "page");

    expect(result).toMatchObject({
      ok: false,
      error: { code: "INVALID_TRANSITION" },
    });
  });
});

describe("archive", () => {
  it.each(["DRAFT", "IN_REVIEW", "PUBLISHED"] as const)(
    "archives an entity in lifecycle %s",
    (lifecycle) => {
      const result = archive(entity({ lifecycle }), later, "page");

      expect(result).toMatchObject({
        ok: true,
        value: { lifecycle: "ARCHIVED" },
      });
    },
  );

  it("rejects archiving an already archived entity", () => {
    const result = archive(entity({ lifecycle: "ARCHIVED" }), later, "service");

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "INVALID_TRANSITION",
        message: "Service is already archived.",
      },
    });
  });
});
