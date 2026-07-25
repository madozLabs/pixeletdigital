import { describe, expect, it } from "vitest";

import { createLeadActivity } from "./lead-activity";

const now = new Date("2026-07-25T00:00:00.000Z");

describe("createLeadActivity", () => {
  it("creates an activity with an actor", () => {
    const result = createLeadActivity({
      id: "lead_activity_1",
      leadId: "lead_1",
      type: "STATUS_CHANGED",
      actorId: "user_1",
      detail: "NEW -> IN_REVIEW",
      occurredAt: now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe("STATUS_CHANGED");
    expect(result.value.actorId).toBe("user_1");
  });

  it("allows a system activity with no actor", () => {
    const result = createLeadActivity({
      id: "lead_activity_2",
      leadId: "lead_1",
      type: "CREATED",
      occurredAt: now,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.actorId).toBeNull();
  });

  it("rejects a type outside the controlled vocabulary", () => {
    const result = createLeadActivity({
      id: "lead_activity_3",
      leadId: "lead_1",
      type: "SOMETHING_ELSE",
      occurredAt: now,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TYPE");
  });
});
