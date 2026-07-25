import { describe, expect, it } from "vitest";

import {
  cancelNextAction,
  completeNextAction,
  createNextAction,
} from "./next-action";

const now = new Date("2026-07-25T00:00:00.000Z");
const dueDate = new Date("2026-08-01T00:00:00.000Z");

function validInput() {
  return {
    id: "next_action_1",
    leadId: "lead_1",
    ownerUserId: "user_1",
    description: "Send updated quotation",
    dueDate,
    createdAt: now,
  };
}

describe("createNextAction", () => {
  it("creates a PENDING next action", () => {
    const result = createNextAction(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PENDING");
    expect(result.value.completedAt).toBeNull();
  });

  it("rejects an empty description", () => {
    const result = createNextAction({ ...validInput(), description: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_DESCRIPTION");
  });

  it("rejects an invalid due date", () => {
    const result = createNextAction({
      ...validInput(),
      dueDate: new Date("not-a-date"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_DUE_DATE");
  });
});

describe("completeNextAction", () => {
  it("marks a pending action completed", () => {
    const created = createNextAction(validInput());
    if (!created.ok) throw new Error("fixture should be valid");

    const result = completeNextAction(created.value, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("COMPLETED");
    expect(result.value.completedAt).toEqual(now);
  });

  it("rejects completing an already completed action", () => {
    const created = createNextAction(validInput());
    if (!created.ok) throw new Error("fixture should be valid");
    const completed = completeNextAction(created.value, now);
    if (!completed.ok) throw new Error("fixture should complete");

    const result = completeNextAction(completed.value, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("cancelNextAction", () => {
  it("cancels a pending action", () => {
    const created = createNextAction(validInput());
    if (!created.ok) throw new Error("fixture should be valid");

    const result = cancelNextAction(created.value);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("CANCELLED");
  });

  it("rejects cancelling a completed action", () => {
    const created = createNextAction(validInput());
    if (!created.ok) throw new Error("fixture should be valid");
    const completed = completeNextAction(created.value, now);
    if (!completed.ok) throw new Error("fixture should complete");

    const result = cancelNextAction(completed.value);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});
