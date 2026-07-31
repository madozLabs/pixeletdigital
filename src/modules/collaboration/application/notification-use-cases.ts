import type { RequestContext } from "@/shared/request-context";

import type { Notification, Result } from "../domain/notification";
import type { CollaborationApplicationError } from "./application-error";
import type { NotificationRepository } from "./notification-repository";
import { forbidden, requireActiveActor } from "./collaboration-authorization";

export type NotificationDependencies = Readonly<{
  notifications: NotificationRepository;
}>;

export type ListMyNotificationsInput = Readonly<{
  skip: number;
  take: number;
}>;

export async function listMyNotifications(
  dependencies: NotificationDependencies,
  context: RequestContext,
  input: ListMyNotificationsInput,
): Promise<Result<readonly Notification[], CollaborationApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  return {
    ok: true,
    value: await dependencies.notifications.listForUser(actorResult.value.id, input),
  };
}

export async function countUnreadNotifications(
  dependencies: NotificationDependencies,
  context: RequestContext,
): Promise<Result<number, CollaborationApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  return {
    ok: true,
    value: await dependencies.notifications.countUnreadForUser(
      actorResult.value.id,
    ),
  };
}

export type MarkNotificationReadInput = Readonly<{ id: string }>;

export async function markNotificationRead(
  dependencies: NotificationDependencies,
  context: RequestContext,
  input: MarkNotificationReadInput,
): Promise<Result<null, CollaborationApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const notification = await dependencies.notifications.findById(input.id);
  if (!notification) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Notification was not found." },
    };
  }
  if (notification.userId !== actorResult.value.id) return forbidden();

  await dependencies.notifications.markRead(input.id, context.clock.now());
  return { ok: true, value: null };
}

export async function markAllNotificationsRead(
  dependencies: NotificationDependencies,
  context: RequestContext,
): Promise<Result<null, CollaborationApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  await dependencies.notifications.markAllRead(
    actorResult.value.id,
    context.clock.now(),
  );
  return { ok: true, value: null };
}
