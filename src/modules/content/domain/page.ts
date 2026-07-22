import {
  archive,
  isContentLifecycleState,
  publish,
  reject,
  submitForReview,
  type ContentLifecycleState,
  type Result,
} from "./content-lifecycle";

export type { Result } from "./content-lifecycle";
export type PageLifecycleState = ContentLifecycleState;
export type PageSlug = string & { readonly __brand: "PageSlug" };

export type PageDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_PAGE_TYPE"
  | "INVALID_TITLE"
  | "INVALID_SLUG"
  | "INVALID_LIFECYCLE_STATE"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

export type PageDomainError = Readonly<{
  code: PageDomainErrorCode;
  message: string;
}>;

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
const ENTITY_LABEL = "page";

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

export function restorePage(
  input: Readonly<{
    id: string;
    worldKey: string;
    pageType: string;
    title: string;
    slug: string;
    lifecycle: string;
    version: number;
    publishedAt: Date | null;
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

  if (!isContentLifecycleState(input.lifecycle)) {
    return failure(
      "INVALID_LIFECYCLE_STATE",
      "Page lifecycle is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "Page version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      pageType: pageTypeResult.value,
      title: titleResult.value,
      slug: slugResult.value,
      lifecycle: input.lifecycle,
      version: input.version,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
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
    return failure(
      "INVALID_TRANSITION",
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
  return submitForReview(page, updatedAt, ENTITY_LABEL);
}

export function rejectPage(
  page: Page,
  updatedAt: Date,
): Result<Page, PageDomainError> {
  return reject(page, updatedAt, ENTITY_LABEL);
}

export function publishPage(
  page: Page,
  publishedAt: Date,
): Result<Page, PageDomainError> {
  return publish(page, publishedAt, ENTITY_LABEL);
}

export function archivePage(
  page: Page,
  updatedAt: Date,
): Result<Page, PageDomainError> {
  return archive(page, updatedAt, ENTITY_LABEL);
}

export function isPageLifecycleState(
  value: string,
): value is PageLifecycleState {
  return isContentLifecycleState(value);
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

function failure(
  code: PageDomainErrorCode,
  message: string,
): Result<never, PageDomainError> {
  return { ok: false, error: { code, message } };
}
