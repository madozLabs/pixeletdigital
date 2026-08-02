import type { RequestContext } from "@/shared/request-context";

import type { ContentApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayMutateContent,
  mayReviewContent,
  requireActiveActor,
} from "./content-authorization";
import type { PageRevisionRepository } from "./page-revision-repository";
import {
  editPageRevision,
  transitionPageRevision,
  type PageRevision,
  type PageRevisionStatus,
} from "../domain/page-revision";
import type { Result } from "../domain/content-lifecycle";

type Dependencies = Readonly<{ revisions: PageRevisionRepository }>;

export async function startPageDraft(
  dependencies: Dependencies,
  context: RequestContext,
  input: Readonly<{ pageId: string }>,
): Promise<Result<PageRevision, ContentApplicationError>> {
  const access = await mutablePage(dependencies, context, input.pageId, false);
  if (!access.ok) return access;
  if (access.value.page.draftRevisionId) {
    const existing = await dependencies.revisions.findRevision(
      access.value.page.draftRevisionId,
    );
    if (existing) return { ok: true, value: existing };
  }
  return {
    ok: true,
    value: await dependencies.revisions.createDraftFromPublished({
      pageId: input.pageId,
      sourceRevisionId: access.value.page.publishedRevisionId,
      actorId: access.value.actor.id,
      now: context.clock.now(),
    }),
  };
}

export async function updatePageDraftMetadata(
  dependencies: Dependencies,
  context: RequestContext,
  input: Readonly<{
    pageId: string;
    revisionId: string;
    expectedVersion: number;
    title: string;
    seoTitle: string;
    seoDescription: string;
    ogImageMediaId: string;
  }>,
): Promise<Result<PageRevision, ContentApplicationError>> {
  const access = await mutablePage(dependencies, context, input.pageId, false);
  if (!access.ok) return access;
  if (access.value.page.draftRevisionId !== input.revisionId) return conflict();
  const revision = await dependencies.revisions.findRevision(input.revisionId);
  if (!revision || revision.pageId !== input.pageId) return notFound();
  if (revision.version !== input.expectedVersion) return conflict();
  const edited = editPageRevision(revision, input, context.clock.now());
  if (!edited.ok) return validation(edited.error.code, edited.error.message);
  const saved = await dependencies.revisions.saveDraft({
    revision: edited.value,
    expectedVersion: input.expectedVersion,
  });
  return saved ? edited : conflict();
}

export async function movePageRevision(
  dependencies: Dependencies,
  context: RequestContext,
  input: Readonly<{
    pageId: string;
    revisionId: string;
    expectedVersion: number;
    target: PageRevisionStatus;
  }>,
): Promise<Result<PageRevision, ContentApplicationError>> {
  const reviewAction = input.target !== "IN_REVIEW";
  const access = await mutablePage(
    dependencies,
    context,
    input.pageId,
    reviewAction,
  );
  if (!access.ok) return access;
  if (access.value.page.draftRevisionId !== input.revisionId) return conflict();
  const revision = await dependencies.revisions.findRevision(input.revisionId);
  if (!revision || revision.pageId !== input.pageId) return notFound();
  if (revision.version !== input.expectedVersion) return conflict();
  const transitioned = transitionPageRevision(
    revision,
    input.target,
    access.value.actor.id,
    context.clock.now(),
  );
  if (!transitioned.ok) {
    return validation(transitioned.error.code, transitioned.error.message);
  }
  const saved = await dependencies.revisions.saveTransition({
    revision: transitioned.value,
    expectedVersion: input.expectedVersion,
    publish: input.target === "PUBLISHED",
  });
  return saved ? transitioned : conflict();
}

async function mutablePage(
  dependencies: Dependencies,
  context: RequestContext,
  pageId: string,
  review: boolean,
) {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const page = await dependencies.revisions.findPage(pageId);
  if (!page) return notFound();
  const roleAllowed = review
    ? mayReviewContent(actorResult.value)
    : mayMutateContent(actorResult.value);
  if (!roleAllowed || !hasWorldScope(actorResult.value, page.worldKey)) {
    return forbidden();
  }
  return { ok: true as const, value: { actor: actorResult.value, page } };
}

function conflict(): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: { code: "CONFLICT", message: "The revision has changed." },
  };
}

function notFound(): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "The revision was not found." },
  };
}

function validation(
  validationCode: "INVALID_TRANSITION" | "INVALID_TITLE" | "INVALID_SEO",
  message: string,
): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: { code: "VALIDATION_ERROR", validationCode, message },
  };
}
