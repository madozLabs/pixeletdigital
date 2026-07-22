import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  archivePage as archivePageDomain,
  createDraftPage as createDraftPageDomain,
  editDraftPage as editDraftPageDomain,
  publishPage as publishPageDomain,
  rejectPage as rejectPageDomain,
  submitPageForReview as submitPageForReviewDomain,
  type Page,
  type PageDomainError,
  type Result,
} from "../domain/page";
import type { ContentApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayMutateContent,
  mayReviewContent,
  requireActiveActor,
} from "./content-authorization";
import type { PageRepository } from "./page-repository";

export type ContentDependencies = Readonly<{
  pages: PageRepository;
  worlds: WorldRepository;
}>;

export type CreateDraftPageInput = Readonly<{
  id: string;
  worldKey: string;
  pageType: string;
  title: string;
  slug: string;
}>;

export async function createDraftPage(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: CreateDraftPageInput,
): Promise<Result<Page, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_WORLD_KEY",
        message: worldKeyResult.error.message,
      },
    };
  }

  if (!mayMutateContent(actor) || !hasWorldScope(actor, worldKeyResult.value)) {
    return forbidden();
  }

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }
  if (world.mode === "INACTIVE") return forbidden();

  const now = context.clock.now();
  const pageResult = createDraftPageDomain({
    id: input.id,
    worldKey: world.key,
    pageType: input.pageType,
    title: input.title,
    slug: input.slug,
    createdAt: now,
    updatedAt: now,
  });
  if (!pageResult.ok) return validationFailure(pageResult.error);

  await dependencies.pages.save(pageResult.value);
  return { ok: true, value: pageResult.value };
}

export type GetPageByIdInput = Readonly<{ id: string }>;

export async function getPageById(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: GetPageByIdInput,
): Promise<Result<Page, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const page = await dependencies.pages.findById(input.id);
  if (!page) return notFound();
  if (!hasWorldScope(actorResult.value, page.worldKey)) return forbidden();

  return { ok: true, value: page };
}

export type EditDraftPageInput = Readonly<{
  id: string;
  expectedVersion: number;
  title: string;
  slug: string;
}>;

export async function editDraftPage(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: EditDraftPageInput,
): Promise<Result<Page, ContentApplicationError>> {
  return withMutablePage(
    dependencies,
    context,
    input,
    mayMutateContent,
    (page, now) =>
      editDraftPageDomain(page, { title: input.title, slug: input.slug }, now),
  );
}

export type SubmitPageForReviewInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function submitPageForReview(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: SubmitPageForReviewInput,
): Promise<Result<Page, ContentApplicationError>> {
  return withMutablePage(
    dependencies,
    context,
    input,
    mayMutateContent,
    (page, now) => submitPageForReviewDomain(page, now),
  );
}

export type RejectPageInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function rejectPage(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: RejectPageInput,
): Promise<Result<Page, ContentApplicationError>> {
  return withMutablePage(
    dependencies,
    context,
    input,
    mayReviewContent,
    (page, now) => rejectPageDomain(page, now),
  );
}

export type PublishPageInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function publishPage(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: PublishPageInput,
): Promise<Result<Page, ContentApplicationError>> {
  return withMutablePage(
    dependencies,
    context,
    input,
    mayReviewContent,
    (page, now) => publishPageDomain(page, now),
  );
}

export type ArchivePageInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function archivePage(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: ArchivePageInput,
): Promise<Result<Page, ContentApplicationError>> {
  return withMutablePage(
    dependencies,
    context,
    input,
    mayReviewContent,
    (page, now) => archivePageDomain(page, now),
  );
}

async function withMutablePage(
  dependencies: ContentDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  isAuthorizedRole: (actor: NonNullable<RequestContext["actor"]>) => boolean,
  transition: (page: Page, now: Date) => Result<Page, PageDomainError>,
): Promise<Result<Page, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const page = await dependencies.pages.findById(input.id);
  if (!page) return notFound();

  if (!isAuthorizedRole(actor) || !hasWorldScope(actor, page.worldKey)) {
    return forbidden();
  }

  if (page.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The page has changed since it was last read.",
      },
    };
  }

  const transitioned = transition(page, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.pages.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

function notFound(): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Page was not found." },
  };
}

function validationFailure(
  error: PageDomainError,
): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
