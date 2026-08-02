import { describe, expect, it } from "vitest";

import {
  editPageRevision,
  transitionPageRevision,
  type PageRevision,
} from "./page-revision";

const revision = (status: PageRevision["status"]): PageRevision => ({
  id: "revision-1",
  pageId: "page-1",
  revisionNumber: 1,
  status,
  title: "Page",
  seoTitle: null,
  seoDescription: null,
  ogImageMediaId: null,
  version: 1,
  createdById: "editor-1",
  reviewedById: null,
  publishedById: null,
  reviewedAt: null,
  publishedAt: null,
  createdAt: new Date("2026-07-26T00:00:00Z"),
  updatedAt: new Date("2026-07-26T00:00:00Z"),
});

describe("page revision", () => {
  it("edits only drafts and validates SEO limits", () => {
    expect(
      editPageRevision(
        revision("DRAFT"),
        {
          title: "Nouvelle page",
          seoTitle: "SEO",
          seoDescription: "Résumé",
          ogImageMediaId: "",
        },
        new Date("2026-07-27T00:00:00Z"),
      ).ok,
    ).toBe(true);
    expect(
      editPageRevision(
        revision("PUBLISHED"),
        { title: "Non", seoTitle: "", seoDescription: "", ogImageMediaId: "" },
        new Date(),
      ).ok,
    ).toBe(false);
  });

  it("enforces draft, review, approval and publication order", () => {
    expect(
      transitionPageRevision(
        revision("DRAFT"),
        "IN_REVIEW",
        "editor",
        new Date(),
      ).ok,
    ).toBe(true);
    expect(
      transitionPageRevision(
        revision("IN_REVIEW"),
        "APPROVED",
        "manager",
        new Date(),
      ).ok,
    ).toBe(true);
    expect(
      transitionPageRevision(
        revision("APPROVED"),
        "PUBLISHED",
        "manager",
        new Date(),
      ).ok,
    ).toBe(true);
    expect(
      transitionPageRevision(
        revision("DRAFT"),
        "PUBLISHED",
        "manager",
        new Date(),
      ).ok,
    ).toBe(false);
  });
});
