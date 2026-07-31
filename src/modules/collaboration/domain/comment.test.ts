import { describe, expect, it } from "vitest";

import { postComment, restoreComment } from "./comment";

const now = new Date("2026-07-31T00:00:00.000Z");

describe("postComment", () => {
  it("creates a valid comment", () => {
    const result = postComment(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toBe("Vérifie ce visuel avant demain.");
    expect(result.value.mentionedUserIds).toEqual(["user_fatou"]);
  });

  it("rejects an unknown entityType", () => {
    const result = postComment({ ...validInput(), entityType: "INVOICE" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_ENTITY_TYPE");
  });

  it("rejects an empty body", () => {
    const result = postComment({ ...validInput(), body: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_BODY");
  });

  it("rejects a body over the length limit", () => {
    const result = postComment({ ...validInput(), body: "x".repeat(2001) });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_BODY");
  });

  it("deduplicates mentioned user ids", () => {
    const result = postComment({
      ...validInput(),
      mentionedUserIds: ["user_fatou", "user_fatou", "user_ali"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mentionedUserIds).toEqual(["user_fatou", "user_ali"]);
  });

  it("rejects more than 20 mentions", () => {
    const result = postComment({
      ...validInput(),
      mentionedUserIds: Array.from({ length: 21 }, (_, i) => `user_${i}`),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("TOO_MANY_MENTIONS");
  });
});

describe("restoreComment", () => {
  it("round-trips a persisted comment", () => {
    const created = postComment(validInput());
    if (!created.ok) throw new Error("expected a valid comment");

    const result = restoreComment(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "comment_test_01",
    entityType: "TASK",
    entityId: "task_test_01",
    worldKey: "pixel-digital",
    authorId: "user_admin",
    body: "Vérifie ce visuel avant demain.",
    mentionedUserIds: ["user_fatou"],
    createdAt: now,
  };
}
