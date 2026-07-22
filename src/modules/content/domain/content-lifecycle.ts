export const CONTENT_LIFECYCLE_STATES = [
  "DRAFT",
  "IN_REVIEW",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export type ContentLifecycleState = (typeof CONTENT_LIFECYCLE_STATES)[number];

export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type ContentTransitionError = Readonly<{
  code: "INVALID_TRANSITION";
  message: string;
}>;

export type TransitionResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; error: ContentTransitionError }>;

export type Lifecycled = Readonly<{
  lifecycle: ContentLifecycleState;
  version: number;
  publishedAt: Date | null;
  updatedAt: Date;
}>;

export function isContentLifecycleState(
  value: string,
): value is ContentLifecycleState {
  return CONTENT_LIFECYCLE_STATES.includes(value as ContentLifecycleState);
}

export function submitForReview<T extends Lifecycled>(
  entity: T,
  updatedAt: Date,
  entityLabel: string,
): TransitionResult<T> {
  if (entity.lifecycle !== "DRAFT") {
    return transitionError(
      `Only a draft ${entityLabel} can be submitted for review, but lifecycle is ${entity.lifecycle}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...entity,
      lifecycle: "IN_REVIEW",
      version: entity.version + 1,
      updatedAt: new Date(updatedAt),
    }) as T,
  };
}

export function reject<T extends Lifecycled>(
  entity: T,
  updatedAt: Date,
  entityLabel: string,
): TransitionResult<T> {
  if (entity.lifecycle !== "IN_REVIEW") {
    return transitionError(
      `Only a ${entityLabel} in review can be rejected, but lifecycle is ${entity.lifecycle}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...entity,
      lifecycle: "DRAFT",
      version: entity.version + 1,
      updatedAt: new Date(updatedAt),
    }) as T,
  };
}

export function publish<T extends Lifecycled>(
  entity: T,
  publishedAt: Date,
  entityLabel: string,
): TransitionResult<T> {
  if (entity.lifecycle !== "IN_REVIEW") {
    return transitionError(
      `Only a ${entityLabel} in review can be published, but lifecycle is ${entity.lifecycle}.`,
    );
  }

  const timestamp = new Date(publishedAt);
  return {
    ok: true,
    value: Object.freeze({
      ...entity,
      lifecycle: "PUBLISHED",
      version: entity.version + 1,
      publishedAt: timestamp,
      updatedAt: timestamp,
    }) as T,
  };
}

export function archive<T extends Lifecycled>(
  entity: T,
  updatedAt: Date,
  entityLabel: string,
): TransitionResult<T> {
  if (entity.lifecycle === "ARCHIVED") {
    return transitionError(`${capitalize(entityLabel)} is already archived.`);
  }

  return {
    ok: true,
    value: Object.freeze({
      ...entity,
      lifecycle: "ARCHIVED",
      version: entity.version + 1,
      updatedAt: new Date(updatedAt),
    }) as T,
  };
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0]!.toUpperCase() + value.slice(1);
}

function transitionError(message: string): TransitionResult<never> {
  return { ok: false, error: { code: "INVALID_TRANSITION", message } };
}
