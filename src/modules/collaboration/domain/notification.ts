export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const NOTIFICATION_TYPES = ["MENTIONED", "REVIEW_REQUESTED"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export type NotificationDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_USER_ID"
  | "INVALID_TYPE"
  | "INVALID_ENTITY_TYPE"
  | "INVALID_ENTITY_ID"
  | "INVALID_WORLD_KEY";

export type NotificationDomainError = Readonly<{
  code: NotificationDomainErrorCode;
  message: string;
}>;

export type Notification = Readonly<{
  id: string;
  userId: string;
  type: NotificationType;
  commentId: string | null;
  entityType: string;
  entityId: string;
  worldKey: string;
  readAt: Date | null;
  createdAt: Date;
}>;

export function createNotification(
  input: Readonly<{
    id: string;
    userId: string;
    type: string;
    commentId?: string | null;
    entityType: string;
    entityId: string;
    worldKey: string;
    createdAt: Date;
  }>,
): Result<Notification, NotificationDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Notification id must be a non-empty opaque identifier.",
    );
  }

  const userId = input.userId.trim();
  if (!userId) {
    return failure(
      "INVALID_USER_ID",
      "Notification userId must be a non-empty identifier.",
    );
  }

  if (!isNotificationType(input.type)) {
    return failure(
      "INVALID_TYPE",
      "Notification type is not part of the controlled vocabulary.",
    );
  }

  const entityType = input.entityType.trim();
  if (!entityType) {
    return failure(
      "INVALID_ENTITY_TYPE",
      "Notification entityType must be a non-empty identifier.",
    );
  }

  const entityId = input.entityId.trim();
  if (!entityId) {
    return failure(
      "INVALID_ENTITY_ID",
      "Notification entityId must be a non-empty identifier.",
    );
  }

  const worldKey = input.worldKey.trim();
  if (!worldKey) {
    return failure(
      "INVALID_WORLD_KEY",
      "Notification worldKey must be a non-empty identifier.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      userId,
      type: input.type,
      commentId: input.commentId?.trim() || null,
      entityType,
      entityId,
      worldKey,
      readAt: null,
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function restoreNotification(
  input: Readonly<{
    id: string;
    userId: string;
    type: string;
    commentId: string | null;
    entityType: string;
    entityId: string;
    worldKey: string;
    readAt: Date | null;
    createdAt: Date;
  }>,
): Result<Notification, NotificationDomainError> {
  const created = createNotification(input);
  if (!created.ok) return created;
  return {
    ok: true,
    value: Object.freeze({ ...created.value, readAt: input.readAt }),
  };
}

export function markNotificationRead(
  notification: Notification,
  readAt: Date,
): Notification {
  return Object.freeze({ ...notification, readAt: new Date(readAt) });
}

function failure(
  code: NotificationDomainErrorCode,
  message: string,
): Result<never, NotificationDomainError> {
  return { ok: false, error: { code, message } };
}
