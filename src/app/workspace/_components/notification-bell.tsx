"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

import {
  fetchMyNotifications,
  fetchUnreadNotificationCount,
  markAllMyNotificationsRead,
  markOneNotificationRead,
  type NotificationDto,
} from "./notification-bell-actions";

const POLL_MS = 45_000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<
    readonly NotificationDto[] | null
  >(null);

  useEffect(() => {
    let active = true;
    const refreshCount = () => {
      void fetchUnreadNotificationCount().then((count) => {
        if (active) setUnreadCount(count);
      });
    };
    refreshCount();
    const interval = window.setInterval(refreshCount, POLL_MS);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      const list = await fetchMyNotifications();
      setNotifications(list);
    }
  }

  async function handleNotificationClick(id: string) {
    await markOneNotificationRead(id);
    setUnreadCount((count) => Math.max(0, count - 1));
    setNotifications(
      (prev) => prev?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? null,
    );
  }

  async function handleMarkAll() {
    await markAllMyNotificationsRead();
    setUnreadCount(0);
    setNotifications((prev) => prev?.map((n) => ({ ...n, read: true })) ?? null);
  }

  return (
    <div className="notification-bell">
      <button
        type="button"
        className="notification-bell__trigger"
        onClick={() => void handleToggle()}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} non lues)` : ""}`}
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="notification-bell__badge">{unreadCount}</span>
        ) : null}
      </button>
      {open ? (
        <div className="notification-bell__panel" role="menu">
          <div className="notification-bell__panel-header">
            <strong>Notifications</strong>
            <button type="button" onClick={() => void handleMarkAll()}>
              Tout marquer lu
            </button>
          </div>
          {notifications === null ? (
            <p className="admin-empty">Chargement…</p>
          ) : notifications.length === 0 ? (
            <p className="admin-empty">Aucune notification.</p>
          ) : (
            <ul>
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={
                    notification.read
                      ? "notification-bell__item"
                      : "notification-bell__item notification-bell__item--unread"
                  }
                >
                  <Link
                    href={notification.href}
                    onClick={() => void handleNotificationClick(notification.id)}
                  >
                    {notification.message}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
