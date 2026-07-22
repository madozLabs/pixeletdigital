import type { RequestContext } from "@/shared/request-context";

import {
  createPageSection as createPageSectionDomain,
  editPageSection as editPageSectionDomain,
  type PageSection,
  type PageSectionDomainError,
  type PageSectionPayload,
  type Result,
} from "../domain/page-section";
import type { ContentApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayMutateContent,
  requireActiveActor,
} from "./content-authorization";
import type { PageRepository } from "./page-repository";
import type { PageSectionRepository } from "./page-section-repository";

export type PageSectionDependencies = Readonly<{
  sections: PageSectionRepository;
  pages: PageRepository;
}>;

export type AddPageSectionInput = Readonly<{
  id: string;
  pageId: string;
  sectionType: string;
  order: number;
  payload: PageSectionPayload;
  payloadSchemaVersion: number;
}>;

export async function addPageSection(
  dependencies: PageSectionDependencies,
  context: RequestContext,
  input: AddPageSectionInput,
): Promise<Result<PageSection, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const page = await dependencies.pages.findById(input.pageId);
  if (!page) return notFound("Page was not found.");

  if (!mayMutateContent(actor) || !hasWorldScope(actor, page.worldKey)) {
    return forbidden();
  }

  if (page.lifecycle !== "DRAFT") return pageNotDraft();

  const now = context.clock.now();
  const sectionResult = createPageSectionDomain({
    id: input.id,
    pageId: input.pageId,
    sectionType: input.sectionType,
    order: input.order,
    payload: input.payload,
    payloadSchemaVersion: input.payloadSchemaVersion,
    createdAt: now,
    updatedAt: now,
  });
  if (!sectionResult.ok) return validationFailure(sectionResult.error);

  await dependencies.sections.save(sectionResult.value);
  return { ok: true, value: sectionResult.value };
}

export type ListPageSectionsInput = Readonly<{ pageId: string }>;

export async function listPageSections(
  dependencies: PageSectionDependencies,
  context: RequestContext,
  input: ListPageSectionsInput,
): Promise<Result<readonly PageSection[], ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const page = await dependencies.pages.findById(input.pageId);
  if (!page) return notFound("Page was not found.");
  if (!hasWorldScope(actorResult.value, page.worldKey)) return forbidden();

  const sections = await dependencies.sections.listByPage(input.pageId);
  return { ok: true, value: sections };
}

export type EditPageSectionInput = Readonly<{
  id: string;
  expectedVersion: number;
  sectionType: string;
  order: number;
  payload: PageSectionPayload;
  payloadSchemaVersion: number;
}>;

export async function editPageSection(
  dependencies: PageSectionDependencies,
  context: RequestContext,
  input: EditPageSectionInput,
): Promise<Result<PageSection, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const section = await dependencies.sections.findById(input.id);
  if (!section) return notFound("PageSection was not found.");

  const page = await dependencies.pages.findById(section.pageId);
  if (!page) return notFound("Page was not found.");

  if (!mayMutateContent(actor) || !hasWorldScope(actor, page.worldKey)) {
    return forbidden();
  }
  if (page.lifecycle !== "DRAFT") return pageNotDraft();

  if (section.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The section has changed since it was last read.",
      },
    };
  }

  const editResult = editPageSectionDomain(
    section,
    {
      sectionType: input.sectionType,
      order: input.order,
      payload: input.payload,
      payloadSchemaVersion: input.payloadSchemaVersion,
    },
    context.clock.now(),
  );
  if (!editResult.ok) return validationFailure(editResult.error);

  await dependencies.sections.save(editResult.value);
  return { ok: true, value: editResult.value };
}

export type RemovePageSectionInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function removePageSection(
  dependencies: PageSectionDependencies,
  context: RequestContext,
  input: RemovePageSectionInput,
): Promise<Result<void, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const section = await dependencies.sections.findById(input.id);
  if (!section) return notFound("PageSection was not found.");

  const page = await dependencies.pages.findById(section.pageId);
  if (!page) return notFound("Page was not found.");

  if (!mayMutateContent(actor) || !hasWorldScope(actor, page.worldKey)) {
    return forbidden();
  }
  if (page.lifecycle !== "DRAFT") return pageNotDraft();

  if (section.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The section has changed since it was last read.",
      },
    };
  }

  await dependencies.sections.deleteById(input.id);
  return { ok: true, value: undefined };
}

function pageNotDraft(): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: {
      code: "CONFLICT",
      message: "Sections can only be changed while the page is a draft.",
    },
  };
}

function notFound(message: string): Result<never, ContentApplicationError> {
  return { ok: false, error: { code: "NOT_FOUND", message } };
}

function validationFailure(
  error: PageSectionDomainError,
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
