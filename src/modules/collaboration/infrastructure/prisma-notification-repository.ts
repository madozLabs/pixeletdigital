import type { Notification as PrismaNotification, PrismaClient } from "@/generated/prisma/client";

import type { NotificationRepository } from "../application/notification-repository";
import { restoreNotification, type Notification } from "../domain/notification";

export class PrismaNotificationRepository implements NotificationRepository {
  constructor(private readonly client: PrismaClient) {}

  async findById(id: string): Promise<Notification | null> {
    const record = await this.client.notification.findUnique({
      where: { id },
    });
    return record ? toDomain(record) : null;
  }

  async listForUser(
    userId: string,
    pagination: Readonly<{ skip: number; take: number }>,
  ): Promise<readonly Notification[]> {
    const records = await this.client.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
    });
    return records.map(toDomain);
  }

  async countUnreadForUser(userId: string): Promise<number> {
    return this.client.notification.count({
      where: { userId, readAt: null },
    });
  }

  async save(notification: Notification): Promise<void> {
    await this.client.notification.create({
      data: {
        id: notification.id,
        userId: notification.userId,
        type: notification.type,
        commentId: notification.commentId,
        entityType: notification.entityType,
        entityId: notification.entityId,
        worldKey: notification.worldKey,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
      },
    });
  }

  async markRead(id: string, readAt: Date): Promise<void> {
    await this.client.notification.updateMany({
      where: { id, readAt: null },
      data: { readAt },
    });
  }

  async markAllRead(userId: string, readAt: Date): Promise<void> {
    await this.client.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt },
    });
  }
}

function toDomain(record: PrismaNotification): Notification {
  const result = restoreNotification(record);
  if (!result.ok) {
    throw new Error(`Persisted Notification is invalid: ${result.error.code}`);
  }
  return result.value;
}
