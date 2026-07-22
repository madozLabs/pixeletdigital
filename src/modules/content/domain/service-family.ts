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

export type ServiceFamilyLifecycleState = ContentLifecycleState;

export type ServiceFamilyDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_LABEL"
  | "INVALID_ORDER"
  | "INVALID_LIFECYCLE_STATE"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

export type ServiceFamilyDomainError = Readonly<{
  code: ServiceFamilyDomainErrorCode;
  message: string;
}>;

export type ServiceFamily = Readonly<{
  id: string;
  worldKey: string;
  label: string;
  order: number;
  lifecycle: ServiceFamilyLifecycleState;
  version: number;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

const ENTITY_LABEL = "service family";

export function createDraftServiceFamily(
  input: Readonly<{
    id: string;
    worldKey: string;
    label: string;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<ServiceFamily, ServiceFamilyDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "ServiceFamily id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const labelResult = parseLabel(input.label);
  if (!labelResult.ok) return labelResult;

  const orderResult = parseOrder(input.order);
  if (!orderResult.ok) return orderResult;

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      label: labelResult.value,
      order: orderResult.value,
      lifecycle: "DRAFT",
      version: 1,
      publishedAt: null,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreServiceFamily(
  input: Readonly<{
    id: string;
    worldKey: string;
    label: string;
    order: number;
    lifecycle: string;
    version: number;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<ServiceFamily, ServiceFamilyDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "ServiceFamily id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const labelResult = parseLabel(input.label);
  if (!labelResult.ok) return labelResult;

  const orderResult = parseOrder(input.order);
  if (!orderResult.ok) return orderResult;

  if (!isContentLifecycleState(input.lifecycle)) {
    return failure(
      "INVALID_LIFECYCLE_STATE",
      "ServiceFamily lifecycle is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "ServiceFamily version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      label: labelResult.value,
      order: orderResult.value,
      lifecycle: input.lifecycle,
      version: input.version,
      publishedAt: input.publishedAt ? new Date(input.publishedAt) : null,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function editDraftServiceFamily(
  family: ServiceFamily,
  changes: Readonly<{ label: string; order: number }>,
  updatedAt: Date,
): Result<ServiceFamily, ServiceFamilyDomainError> {
  if (family.lifecycle !== "DRAFT") {
    return failure(
      "INVALID_TRANSITION",
      `Only a draft service family can be edited directly, but lifecycle is ${family.lifecycle}.`,
    );
  }

  const labelResult = parseLabel(changes.label);
  if (!labelResult.ok) return labelResult;

  const orderResult = parseOrder(changes.order);
  if (!orderResult.ok) return orderResult;

  return {
    ok: true,
    value: Object.freeze({
      ...family,
      label: labelResult.value,
      order: orderResult.value,
      version: family.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function submitServiceFamilyForReview(
  family: ServiceFamily,
  updatedAt: Date,
): Result<ServiceFamily, ServiceFamilyDomainError> {
  return submitForReview(family, updatedAt, ENTITY_LABEL);
}

export function rejectServiceFamily(
  family: ServiceFamily,
  updatedAt: Date,
): Result<ServiceFamily, ServiceFamilyDomainError> {
  return reject(family, updatedAt, ENTITY_LABEL);
}

export function publishServiceFamily(
  family: ServiceFamily,
  publishedAt: Date,
): Result<ServiceFamily, ServiceFamilyDomainError> {
  return publish(family, publishedAt, ENTITY_LABEL);
}

export function archiveServiceFamily(
  family: ServiceFamily,
  updatedAt: Date,
): Result<ServiceFamily, ServiceFamilyDomainError> {
  return archive(family, updatedAt, ENTITY_LABEL);
}

function parseWorldKey(
  rawWorldKey: string,
): Result<string, ServiceFamilyDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "ServiceFamily worldKey must be a non-empty world stable key.",
    );
  }

  return { ok: true, value: worldKey };
}

function parseLabel(
  rawLabel: string,
): Result<string, ServiceFamilyDomainError> {
  const label = rawLabel.trim();
  if (!label || label.length > 120) {
    return failure(
      "INVALID_LABEL",
      "ServiceFamily label must contain between 1 and 120 characters.",
    );
  }

  return { ok: true, value: label };
}

function parseOrder(
  rawOrder: number,
): Result<number, ServiceFamilyDomainError> {
  if (!Number.isInteger(rawOrder) || rawOrder < 0) {
    return failure(
      "INVALID_ORDER",
      "ServiceFamily order must be a non-negative integer.",
    );
  }

  return { ok: true, value: rawOrder };
}

function failure(
  code: ServiceFamilyDomainErrorCode,
  message: string,
): Result<never, ServiceFamilyDomainError> {
  return { ok: false, error: { code, message } };
}
