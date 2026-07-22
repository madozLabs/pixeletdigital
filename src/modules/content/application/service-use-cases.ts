import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  approveServiceAsCurrent as approveServiceAsCurrentDomain,
  archiveService as archiveServiceDomain,
  createDraftService as createDraftServiceDomain,
  editDraftService as editDraftServiceDomain,
  publishService as publishServiceDomain,
  rejectService as rejectServiceDomain,
  revokeServiceApproval as revokeServiceApprovalDomain,
  setServiceAvailability as setServiceAvailabilityDomain,
  submitServiceForReview as submitServiceForReviewDomain,
  type Result,
  type Service,
  type ServiceDomainError,
} from "../domain/service";
import type { ContentApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayApproveServiceAvailability,
  mayMutateContent,
  mayReviewContent,
  requireActiveActor,
} from "./content-authorization";
import type { ServiceRepository } from "./service-repository";

export type ServiceDependencies = Readonly<{
  services: ServiceRepository;
  worlds: WorldRepository;
}>;

export type CreateDraftServiceInput = Readonly<{
  id: string;
  worldKey: string;
  familyId?: string | null;
  name: string;
  description: string;
  availabilityStatus: string;
}>;

export async function createDraftService(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: CreateDraftServiceInput,
): Promise<Result<Service, ContentApplicationError>> {
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
  const serviceResult = createDraftServiceDomain({
    id: input.id,
    worldKey: world.key,
    familyId: input.familyId,
    name: input.name,
    description: input.description,
    availabilityStatus: input.availabilityStatus,
    createdAt: now,
    updatedAt: now,
  });
  if (!serviceResult.ok) return validationFailure(serviceResult.error);

  await dependencies.services.save(serviceResult.value);
  return { ok: true, value: serviceResult.value };
}

export type GetServiceByIdInput = Readonly<{ id: string }>;

export async function getServiceById(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: GetServiceByIdInput,
): Promise<Result<Service, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const service = await dependencies.services.findById(input.id);
  if (!service) return notFound();
  if (!hasWorldScope(actorResult.value, service.worldKey)) return forbidden();

  return { ok: true, value: service };
}

export type EditDraftServiceInput = Readonly<{
  id: string;
  expectedVersion: number;
  name: string;
  description: string;
}>;

export async function editDraftService(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: EditDraftServiceInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayMutateContent,
    (service, now) =>
      editDraftServiceDomain(
        service,
        { name: input.name, description: input.description },
        now,
      ),
  );
}

export type SetServiceAvailabilityInput = Readonly<{
  id: string;
  expectedVersion: number;
  availabilityStatus: string;
}>;

export async function setServiceAvailability(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: SetServiceAvailabilityInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayMutateContent,
    (service, now) =>
      setServiceAvailabilityDomain(service, input.availabilityStatus, now),
  );
}

export type ApproveServiceAsCurrentInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function approveServiceAsCurrent(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: ApproveServiceAsCurrentInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayApproveServiceAvailability,
    (service, now) => approveServiceAsCurrentDomain(service, now),
  );
}

export type RevokeServiceApprovalInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function revokeServiceApproval(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: RevokeServiceApprovalInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayApproveServiceAvailability,
    (service, now) => revokeServiceApprovalDomain(service, now),
  );
}

export type SubmitServiceForReviewInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function submitServiceForReview(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: SubmitServiceForReviewInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayMutateContent,
    (service, now) => submitServiceForReviewDomain(service, now),
  );
}

export type RejectServiceInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function rejectService(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: RejectServiceInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayReviewContent,
    (service, now) => rejectServiceDomain(service, now),
  );
}

export type PublishServiceInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function publishService(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: PublishServiceInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayReviewContent,
    (service, now) => publishServiceDomain(service, now),
  );
}

export type ArchiveServiceInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function archiveService(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: ArchiveServiceInput,
): Promise<Result<Service, ContentApplicationError>> {
  return withMutableService(
    dependencies,
    context,
    input,
    mayReviewContent,
    (service, now) => archiveServiceDomain(service, now),
  );
}

async function withMutableService(
  dependencies: ServiceDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  isAuthorizedRole: (actor: NonNullable<RequestContext["actor"]>) => boolean,
  transition: (
    service: Service,
    now: Date,
  ) => Result<Service, ServiceDomainError>,
): Promise<Result<Service, ContentApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const service = await dependencies.services.findById(input.id);
  if (!service) return notFound();

  if (!isAuthorizedRole(actor) || !hasWorldScope(actor, service.worldKey)) {
    return forbidden();
  }

  if (service.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The service has changed since it was last read.",
      },
    };
  }

  const transitioned = transition(service, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.services.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

function notFound(): Result<never, ContentApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Service was not found." },
  };
}

function validationFailure(
  error: ServiceDomainError,
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
