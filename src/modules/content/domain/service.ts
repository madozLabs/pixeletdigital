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

export const SERVICE_AVAILABILITY_STATUSES = [
  "CANDIDATE",
  "CURRENT_STATED",
  "APPROVED_CURRENT",
  "FUTURE_ONLY",
  "WITHDRAWN",
] as const;

export type ServiceAvailabilityStatus =
  (typeof SERVICE_AVAILABILITY_STATUSES)[number];

const CREATABLE_AVAILABILITY_STATUSES: readonly ServiceAvailabilityStatus[] = [
  "CANDIDATE",
  "CURRENT_STATED",
  "FUTURE_ONLY",
];

const EDITABLE_AVAILABILITY_STATUSES: readonly ServiceAvailabilityStatus[] = [
  "CANDIDATE",
  "CURRENT_STATED",
  "FUTURE_ONLY",
  "WITHDRAWN",
];

export type ServiceLifecycleState = ContentLifecycleState;

export type ServiceDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_NAME"
  | "INVALID_DESCRIPTION"
  | "INVALID_AVAILABILITY_STATUS"
  | "INVALID_LIFECYCLE_STATE"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

export type ServiceDomainError = Readonly<{
  code: ServiceDomainErrorCode;
  message: string;
}>;

export type Service = Readonly<{
  id: string;
  worldKey: string;
  familyId: string | null;
  name: string;
  description: string;
  availabilityStatus: ServiceAvailabilityStatus;
  lifecycle: ServiceLifecycleState;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

const ENTITY_LABEL = "service";

export function createDraftService(
  input: Readonly<{
    id: string;
    worldKey: string;
    familyId?: string | null;
    name: string;
    description: string;
    availabilityStatus: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<Service, ServiceDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Service id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const nameResult = parseName(input.name);
  if (!nameResult.ok) return nameResult;

  const descriptionResult = parseDescription(input.description);
  if (!descriptionResult.ok) return descriptionResult;

  if (
    !isServiceAvailabilityStatus(input.availabilityStatus) ||
    !CREATABLE_AVAILABILITY_STATUSES.includes(input.availabilityStatus)
  ) {
    return failure(
      "INVALID_AVAILABILITY_STATUS",
      "A new service must start as CANDIDATE, CURRENT_STATED, or FUTURE_ONLY. APPROVED_CURRENT requires a separate owner-governed approval.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      familyId: input.familyId?.trim() || null,
      name: nameResult.value,
      description: descriptionResult.value,
      availabilityStatus: input.availabilityStatus,
      lifecycle: "DRAFT",
      version: 1,
      publishedAt: null,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreService(
  input: Readonly<{
    id: string;
    worldKey: string;
    familyId: string | null;
    name: string;
    description: string;
    availabilityStatus: string;
    lifecycle: string;
    version: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<Service, ServiceDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Service id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const nameResult = parseName(input.name);
  if (!nameResult.ok) return nameResult;

  const descriptionResult = parseDescription(input.description);
  if (!descriptionResult.ok) return descriptionResult;

  if (!isServiceAvailabilityStatus(input.availabilityStatus)) {
    return failure(
      "INVALID_AVAILABILITY_STATUS",
      "Service availability status is not part of the controlled vocabulary.",
    );
  }

  if (!isContentLifecycleState(input.lifecycle)) {
    return failure(
      "INVALID_LIFECYCLE_STATE",
      "Service lifecycle is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "Service version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      familyId: input.familyId?.trim() || null,
      name: nameResult.value,
      description: descriptionResult.value,
      availabilityStatus: input.availabilityStatus,
      lifecycle: input.lifecycle,
      version: input.version,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editDraftService(
  service: Service,
  changes: Readonly<{ name: string; description: string }>,
  updatedAt: Date,
): Result<Service, ServiceDomainError> {
  if (service.lifecycle !== "DRAFT") {
    return failure(
      "INVALID_TRANSITION",
      `Only a draft service can be edited directly, but lifecycle is ${service.lifecycle}.`,
    );
  }

  const nameResult = parseName(changes.name);
  if (!nameResult.ok) return nameResult;

  const descriptionResult = parseDescription(changes.description);
  if (!descriptionResult.ok) return descriptionResult;

  return {
    ok: true,
    value: Object.freeze({
      ...service,
      name: nameResult.value,
      description: descriptionResult.value,
      version: service.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function setServiceAvailability(
  service: Service,
  status: string,
  updatedAt: Date,
): Result<Service, ServiceDomainError> {
  if (!EDITABLE_AVAILABILITY_STATUSES.includes(service.availabilityStatus)) {
    return failure(
      "INVALID_TRANSITION",
      `Service availability cannot be edited directly while APPROVED_CURRENT; use revokeServiceApproval first.`,
    );
  }

  if (
    !isServiceAvailabilityStatus(status) ||
    !EDITABLE_AVAILABILITY_STATUSES.includes(status)
  ) {
    return failure(
      "INVALID_AVAILABILITY_STATUS",
      "Availability can only be set to CANDIDATE, CURRENT_STATED, FUTURE_ONLY, or WITHDRAWN directly. APPROVED_CURRENT requires a separate owner-governed approval.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...service,
      availabilityStatus: status,
      version: service.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function approveServiceAsCurrent(
  service: Service,
  updatedAt: Date,
): Result<Service, ServiceDomainError> {
  if (service.availabilityStatus !== "CURRENT_STATED") {
    return failure(
      "INVALID_TRANSITION",
      `Only a CURRENT_STATED service can be approved as current, but availability is ${service.availabilityStatus}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...service,
      availabilityStatus: "APPROVED_CURRENT",
      version: service.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function revokeServiceApproval(
  service: Service,
  updatedAt: Date,
): Result<Service, ServiceDomainError> {
  if (service.availabilityStatus !== "APPROVED_CURRENT") {
    return failure(
      "INVALID_TRANSITION",
      `Only an APPROVED_CURRENT service can have its approval revoked, but availability is ${service.availabilityStatus}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...service,
      availabilityStatus: "CURRENT_STATED",
      version: service.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function submitServiceForReview(
  service: Service,
  updatedAt: Date,
): Result<Service, ServiceDomainError> {
  return submitForReview(service, updatedAt, ENTITY_LABEL);
}

export function rejectService(
  service: Service,
  updatedAt: Date,
): Result<Service, ServiceDomainError> {
  return reject(service, updatedAt, ENTITY_LABEL);
}

export function publishService(
  service: Service,
  publishedAt: Date,
): Result<Service, ServiceDomainError> {
  return publish(service, publishedAt, ENTITY_LABEL);
}

export function archiveService(
  service: Service,
  updatedAt: Date,
): Result<Service, ServiceDomainError> {
  return archive(service, updatedAt, ENTITY_LABEL);
}

export function isServiceAvailabilityStatus(
  value: string,
): value is ServiceAvailabilityStatus {
  return SERVICE_AVAILABILITY_STATUSES.includes(
    value as ServiceAvailabilityStatus,
  );
}

function parseWorldKey(
  rawWorldKey: string,
): Result<string, ServiceDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "Service worldKey must be a non-empty world stable key.",
    );
  }

  return { ok: true, value: worldKey };
}

function parseName(rawName: string): Result<string, ServiceDomainError> {
  const name = rawName.trim();
  if (!name || name.length > 160) {
    return failure(
      "INVALID_NAME",
      "Service name must contain between 1 and 160 characters.",
    );
  }

  return { ok: true, value: name };
}

function parseDescription(
  rawDescription: string,
): Result<string, ServiceDomainError> {
  const description = rawDescription.trim();
  if (!description || description.length > 4000) {
    return failure(
      "INVALID_DESCRIPTION",
      "Service description must contain between 1 and 4000 characters.",
    );
  }

  return { ok: true, value: description };
}

function failure(
  code: ServiceDomainErrorCode,
  message: string,
): Result<never, ServiceDomainError> {
  return { ok: false, error: { code, message } };
}
