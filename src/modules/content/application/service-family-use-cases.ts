import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  archiveServiceFamily as archiveServiceFamilyDomain,
  createDraftServiceFamily as createDraftServiceFamilyDomain,
  editDraftServiceFamily as editDraftServiceFamilyDomain,
  publishServiceFamily as publishServiceFamilyDomain,
  rejectServiceFamily as rejectServiceFamilyDomain,
  submitServiceFamilyForReview as submitServiceFamilyForReviewDomain,
  type Result,
  type ServiceFamily,
  type ServiceFamilyDomainError,
} from "../domain/service-family";
import type { ContentApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayMutateContent,
  mayReviewContent,
  requireActiveActor,
} from "./content-authorization";
import type { ServiceFamilyRepository } from "./service-family-repository";

export type ServiceFamilyDependencies = Readonly<{
  families: ServiceFamilyRepository;
  worlds: WorldRepository;
}>;

export type CreateDraftServiceFamilyInput = Readonly<{
  id: string;
  worldKey: string;
  label: string;
  order: number;
}>;

export async function createDraftServiceFamily(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: CreateDraftServiceFamilyInput,
): Promise<Result<ServiceFamily, ContentApplicationError>> {
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
  const familyResult = createDraftServiceFamilyDomain({
    id: input.id,
    worldKey: world.key,
    label: input.label,
    order: input.order,
    createdAt: now,
    updatedAt: now,
  });
  if (!familyResult.ok) return validationFailure(familyResult.error);

  await dependencies.families.save(familyResult.value);
  return { ok: true, value: familyResult.value };
}

export type ListServiceFamiliesInput = Readonly<{ worldKey: string }>;

export async function listServiceFamilies(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: ListServiceFamiliesInput,
): Promise<Result<readonly ServiceFamily[], ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

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

  if (!hasWorldScope(actorResult.value, worldKeyResult.value))
    return forbidden();

  const families = await dependencies.families.listByWorld(
    worldKeyResult.value,
  );
  return { ok: true, value: families };
}

export type EditDraftServiceFamilyInput = Readonly<{
  id: string;
  expectedVersion: number;
  label: string;
  order: number;
}>;

export async function editDraftServiceFamily(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: EditDraftServiceFamilyInput,
): Promise<Result<ServiceFamily, ContentApplicationError>> {
  return withMutableFamily(
    dependencies,
    context,
    input,
    mayMutateContent,
    (family, now) =>
      editDraftServiceFamilyDomain(
        family,
        { label: input.label, order: input.order },
        now,
      ),
  );
}

export type SubmitServiceFamilyForReviewInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function submitServiceFamilyForReview(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: SubmitServiceFamilyForReviewInput,
): Promise<Result<ServiceFamily, ContentApplicationError>> {
  return withMutableFamily(
    dependencies,
    context,
    input,
    mayMutateContent,
    (family, now) => submitServiceFamilyForReviewDomain(family, now),
  );
}

export type RejectServiceFamilyInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function rejectServiceFamily(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: RejectServiceFamilyInput,
): Promise<Result<ServiceFamily, ContentApplicationError>> {
  return withMutableFamily(
    dependencies,
    context,
    input,
    mayReviewContent,
    (family, now) => rejectServiceFamilyDomain(family, now),
  );
}

export type PublishServiceFamilyInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function publishServiceFamily(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: PublishServiceFamilyInput,
): Promise<Result<ServiceFamily, ContentApplicationError>> {
  return withMutableFamily(
    dependencies,
    context,
    input,
    mayReviewContent,
    (family, now) => publishServiceFamilyDomain(family, now),
  );
}

export type ArchiveServiceFamilyInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function archiveServiceFamily(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: ArchiveServiceFamilyInput,
): Promise<Result<ServiceFamily, ContentApplicationError>> {
  return withMutableFamily(
    dependencies,
    context,
    input,
    mayReviewContent,
    (family, now) => archiveServiceFamilyDomain(family, now),
  );
}

async function withMutableFamily(
  dependencies: ServiceFamilyDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  isAuthorizedRole: (actor: NonNullable<RequestContext["actor"]>) => boolean,
  transition: (
    family: ServiceFamily,
    now: Date,
  ) => Result<ServiceFamily, ServiceFamilyDomainError>,
): Promise<Result<ServiceFamily, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const family = await dependencies.families.findById(input.id);
  if (!family) return notFound();

  if (!isAuthorizedRole(actor) || !hasWorldScope(actor, family.worldKey)) {
    return forbidden();
  }

  if (family.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The service family has changed since it was last read.",
      },
    };
  }

  const transitioned = transition(family, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.families.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

function notFound(): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "ServiceFamily was not found." },
  };
}

function validationFailure(
  error: ServiceFamilyDomainError,
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
