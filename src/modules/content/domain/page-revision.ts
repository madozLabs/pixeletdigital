import type { Result } from "./content-lifecycle";

export const PAGE_REVISION_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "PUBLISHED",
  "SUPERSEDED",
  "ARCHIVED",
] as const;

export type PageRevisionStatus = (typeof PAGE_REVISION_STATUSES)[number];

export type PageRevision = Readonly<{
  id: string;
  pageId: string;
  revisionNumber: number;
  status: PageRevisionStatus;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  version: number;
  createdById: string | null;
  reviewedById: string | null;
  publishedById: string | null;
  reviewedAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type PageRevisionErrorCode =
  "INVALID_TRANSITION" | "INVALID_TITLE" | "INVALID_SEO";

export type PageRevisionError = Readonly<{
  code: PageRevisionErrorCode;
  message: string;
}>;

const TRANSITIONS: Readonly<
  Partial<Record<PageRevisionStatus, readonly PageRevisionStatus[]>>
> = {
  DRAFT: ["IN_REVIEW"],
  IN_REVIEW: ["DRAFT", "APPROVED"],
  APPROVED: ["PUBLISHED", "DRAFT"],
  PUBLISHED: ["SUPERSEDED", "ARCHIVED"],
};

export function editPageRevision(
  revision: PageRevision,
  input: Readonly<{
    title: string;
    seoTitle: string;
    seoDescription: string;
  }>,
  now: Date,
): Result<PageRevision, PageRevisionError> {
  if (revision.status !== "DRAFT") {
    return failure(
      "INVALID_TRANSITION",
      "Only a draft revision can be edited.",
    );
  }
  const title = input.title.trim();
  if (!title || title.length > 160) {
    return failure(
      "INVALID_TITLE",
      "Revision title must contain 1-160 characters.",
    );
  }
  const seoTitle = input.seoTitle.trim();
  const seoDescription = input.seoDescription.trim();
  if (seoTitle.length > 70 || seoDescription.length > 180) {
    return failure(
      "INVALID_SEO",
      "SEO title or description exceeds its limit.",
    );
  }
  return {
    ok: true,
    value: Object.freeze({
      ...revision,
      title,
      seoTitle: seoTitle || null,
      seoDescription: seoDescription || null,
      version: revision.version + 1,
      updatedAt: new Date(now),
    }),
  };
}

export function transitionPageRevision(
  revision: PageRevision,
  target: PageRevisionStatus,
  actorId: string,
  now: Date,
): Result<PageRevision, PageRevisionError> {
  if (!TRANSITIONS[revision.status]?.includes(target)) {
    return failure(
      "INVALID_TRANSITION",
      `Revision cannot transition from ${revision.status} to ${target}.`,
    );
  }
  const reviewChange = target === "APPROVED";
  const publicationChange = target === "PUBLISHED";
  return {
    ok: true,
    value: Object.freeze({
      ...revision,
      status: target,
      reviewedById: reviewChange ? actorId : revision.reviewedById,
      reviewedAt: reviewChange ? new Date(now) : revision.reviewedAt,
      publishedById: publicationChange ? actorId : revision.publishedById,
      publishedAt: publicationChange ? new Date(now) : revision.publishedAt,
      version: revision.version + 1,
      updatedAt: new Date(now),
    }),
  };
}

function failure(
  code: PageRevisionError["code"],
  message: string,
): Result<never, PageRevisionError> {
  return { ok: false, error: { code, message } };
}
