import { describe, expect, it } from "vitest";

import {
  createNotification,
  markNotificationRead,
  restoreNotification,
} from "./notification";

const now = new Date("2026-07-31T00:00:00.000Z");

describe("createNotification", () => {
  it("creates an unread notification", () => {
    const result = createNotification(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.readAt).toBeNull();
    expect(result.value.type).toBe("MENTIONED");
  });

  it("rejects an unknown type", () => {
    const result = createNotification({ ...validInput(), type: "REMINDER" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TYPE");
  });
});

describe("markNotificationRead", () => {
  it("sets readAt", () => {
    const created = createNotification(validInput());
    if (!created.ok) throw new Error("expected a valid notification");

    const read = markNotificationRead(created.value, now);

    expect(read.readAt).toEqual(now);
  });
});

describe("restoreNotification", () => {
  it("round-trips a persisted notification", () => {
    const created = createNotification(validInput());
    if (!created.ok) throw new Error("expected a valid notification");

    const result = restoreNotification(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "notification_test_01",
    userId: "user_fatou",
    type: "MENTIONED",
    commentId: "comment_test_01",
    entityType: "TASK",
    entityId: "task_test_01",
    worldKey: "pixel-digital",
    createdAt: now,
  };
}
