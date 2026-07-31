import type { Notification } from "../domain/notification";

export interface NotificationRepository {
  findById(id: string): Promise<Notification | null>;
  listForUser(
    userId: string,
    pagination: Readonly<{ skip: number; take: number }>,
  ): Promise<readonly Notification[]>;
  countUnreadForUser(userId: string): Promise<number>;
  save(notification: Notification): Promise<void>;
  markRead(id: string, readAt: Date): Promise<void>;
  markAllRead(userId: string, readAt: Date): Promise<void>;
}
