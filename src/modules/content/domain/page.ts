export const PAGE_LIFECYCLE_STATES = [
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type PageLifecycleState = (typeof PAGE_LIFECYCLE_STATES)[number];

export type PageSlug = string & { readonly __brand: "PageSlug" };

export type PageDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_PAGE_TYPE"
  | "INVALID_TITLE"
  | "INVALID_SLUG"
  | "INVALID_TRANSITION";

export type PageDomainError = Readonly<{
  code: PageDomainErrorCode;
  message: string;
}>;

export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type Page = Readonly<{
  id: string;
  worldKey: string;
  pageType: string;
  title: string;
  slug: PageSlug;
  lifecycle: PageLifecycleState;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function createDraftPage(
  input: Readonly<{
    id: string;
    worldKey: string;
    pageType: string;
    title: string;
    slug: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<Page, PageDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Page id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const pageTypeResult = parsePageType(input.pageType);
  if (!pageTypeResult.ok) return pageTypeResult;

  const titleResult = parseTitle(input.title);
  if (!titleResult.ok) return titleResult;

  const slugResult = parseSlug(input.slug);
  if (!slugResult.ok) return slugResult;

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      pageType: pageTypeResult.value,
      title: titleResult.value,
      slug: slugResult.value,
      lifecycle: "DRAFT",
      version: 1,
      publishedAt: null,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editDraftPage(
  page: Page,
  changes: Readonly<{ title: string; slug: string }>,
  updatedAt: Date,
): Result<Page, PageDomainError> {
  if (page.lifecycle !== "DRAFT") {
    return transitionError(
      `Only a draft page can be edited directly, but lifecycle is ${page.lifecycle}.`,
    );
  }

  const titleResult = parseTitle(changes.title);
  if (!titleResult.ok) return titleResult;

  const slugResult = parseSlug(changes.slug);
  if (!slugResult.ok) return slugResult;

  return {
    ok: true,
    value: Object.freeze({
      ...page,
      title: titleResult.value,
      slug: slugResult.value,
      version: page.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function submitPageForReview(
  page: Page,
  updatedAt: Date,
): Result<Page, PageDomainError> {
  if (page.lifecycle !== "DRAFT") {
    return transitionError(
      `Only a draft page can be submitted for review, but lifecycle is ${page.lifecycle}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...page,
      lifecycle: "IN_REVIEW",
      version: page.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function rejectPage(
  page: Page,
  updatedAt: Date,
): Result<Page, PageDomainError> {
  if (page.lifecycle !== "IN_REVIEW") {
    return transitionError(
      `Only a page in review can be rejected, but lifecycle is ${page.lifecycle}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...page,
      lifecycle: "DRAFT",
      version: page.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function publishPage(
  page: Page,
  publishedAt: Date,
): Result<Page, PageDomainError> {
  if (page.lifecycle !== "IN_REVIEW") {
    return transitionError(
      `Only a page in review can be published, but lifecycle is ${page.lifecycle}.`,
    );
  }

  const timestamp = new Date(publishedAt);
  return {
    ok: true,
    value: Object.freeze({
      ...page,
      lifecycle: "PUBLISHED",
      version: page.version + 1,
      publishedAt: timestamp,
      updatedAt: timestamp,
    }),
  };
}

export function archivePage(
  page: Page,
  updatedAt: Date,
): Result<Page, PageDomainError> {
  if (page.lifecycle === "ARCHIVED") {
    return transitionError("Page is already archived.");
  }

  return {
    ok: true,
    value: Object.freeze({
      ...page,
      lifecycle: "ARCHIVED",
      version: page.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function isPageLifecycleState(
  value: string,
): value is PageLifecycleState {
  return PAGE_LIFECYCLE_STATES.includes(value as PageLifecycleState);
}

function parseWorldKey(rawWorldKey: string): Result<string, PageDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "Page worldKey must be a non-empty world stable key.",
    );
  }

  return { ok: true, value: worldKey };
}

function parsePageType(rawPageType: string): Result<string, PageDomainError> {
  const pageType = rawPageType.trim();
  if (!pageType || pageType.length > 64) {
    return failure(
      "INVALID_PAGE_TYPE",
      "Page type must contain between 1 and 64 characters.",
    );
  }

  return { ok: true, value: pageType };
}

function parseTitle(rawTitle: string): Result<string, PageDomainError> {
  const title = rawTitle.trim();
  if (!title || title.length > 160) {
    return failure(
      "INVALID_TITLE",
      "Page title must contain between 1 and 160 characters.",
    );
  }

  return { ok: true, value: title };
}

function parseSlug(rawSlug: string): Result<PageSlug, PageDomainError> {
  const slug = rawSlug.trim();
  if (slug.length < 1 || slug.length > 160 || !SLUG_PATTERN.test(slug)) {
    return failure(
      "INVALID_SLUG",
      "Page slug must use lowercase letters, digits, and internal hyphens.",
    );
  }

  return { ok: true, value: slug as PageSlug };
}

function transitionError(message: string): Result<never, PageDomainError> {
  return failure("INVALID_TRANSITION", message);
}

function failure(
  code: PageDomainErrorCode,
  message: string,
): Result<never, PageDomainError> {
  return { ok: false, error: { code, message } };
}
