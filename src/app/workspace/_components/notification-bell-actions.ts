"use server";

import {
  countUnreadNotifications,
  listMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/modules/collaboration/application/notification-use-cases";
import { PrismaNotificationRepository } from "@/modules/collaboration/infrastructure/prisma-notification-repository";
import { prisma } from "@/infrastructure/shared/prisma-client";

import { getWorkspaceRequestContext } from "../get-workspace-context";

function dependencies() {
  return { notifications: new PrismaNotificationRepository(prisma) };
}

const ENTITY_PATH: Readonly<Record<string, (worldKey: string) => string>> = {
  TASK: (worldKey) => `/workspace/tasks?world=${worldKey}`,
  EDITORIAL_ITEM: (worldKey) => `/workspace/editorial?world=${worldKey}`,
  PROJECT: (worldKey) => `/workspace/projects?world=${worldKey}`,
};

export type NotificationDto = Readonly<{
  id: string;
  message: string;
  href: string;
  read: boolean;
  createdAt: string;
}>;

export async function fetchUnreadNotificationCount(): Promise<number> {
  const context = await getWorkspaceRequestContext();
  if (!context) return 0;
  const result = await countUnreadNotifications(dependencies(), context);
  return result.ok ? result.value : 0;
}

export async function fetchMyNotifications(): Promise<
  readonly NotificationDto[]
> {
  const context = await getWorkspaceRequestContext();
  if (!context) return [];
  const result = await listMyNotifications(dependencies(), context, {
    skip: 0,
    take: 20,
  });
  if (!result.ok) return [];

  const commentIds = result.value
    .map((n) => n.commentId)
    .filter((id): id is string => Boolean(id));
  const comments = commentIds.length
    ? await prisma.comment.findMany({
        where: { id: { in: commentIds } },
        include: { author: { select: { displayName: true, normalizedEmail: true } } },
      })
    : [];
  const commentById = new Map(comments.map((c) => [c.id, c]));

  return result.value.map((notification) => {
    const comment = notification.commentId
      ? commentById.get(notification.commentId)
      : null;
    const authorName = comment
      ? comment.author.displayName || comment.author.normalizedEmail || "Un collègue"
      : "Un collègue";
    return {
      id: notification.id,
      message: comment
        ? `${authorName} vous a mentionné : « ${comment.body.slice(0, 80)}${comment.body.length > 80 ? "…" : ""} »`
        : "Nouvelle notification",
      href: (ENTITY_PATH[notification.entityType] ?? (() => "/workspace"))(
        notification.worldKey,
      ),
      read: notification.readAt !== null,
      createdAt: notification.createdAt.toISOString(),
    };
  });
}

export async function markOneNotificationRead(id: string): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;
  await markNotificationRead(dependencies(), context, { id });
}

export async function markAllMyNotificationsRead(): Promise<void> {
  const context = await getWorkspaceRequestContext();
  if (!context) return;
  await markAllNotificationsRead(dependencies(), context);
}
