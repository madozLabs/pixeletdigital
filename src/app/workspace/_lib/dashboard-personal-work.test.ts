import { describe, expect, it } from "vitest";

import { buildPersonalWorkFilters } from "./dashboard-personal-work";

describe("buildPersonalWorkFilters", () => {
  it("scopes every personal queue to the current user and selected world", () => {
    const filters = buildPersonalWorkFilters({
      actorId: "user_current",
      worldKey: "kwaliti-print",
    });

    expect(filters.tasks).toMatchObject({
      assigneeId: "user_current",
      project: { worldKey: "kwaliti-print" },
    });
    expect(filters.reviews).toMatchObject({
      reviewerId: "user_current",
      worldKey: "kwaliti-print",
    });
    expect(filters.leads).toMatchObject({
      ownerUserId: "user_current",
      worldKey: "kwaliti-print",
    });
  });

  it("does not fall back to a world-wide queue for another user", () => {
    const first = buildPersonalWorkFilters({
      actorId: "user_1",
      worldKey: "pixel-digital",
    });
    const second = buildPersonalWorkFilters({
      actorId: "user_2",
      worldKey: "pixel-digital",
    });

    expect(first.tasks.assigneeId).toBe("user_1");
    expect(second.tasks.assigneeId).toBe("user_2");
    expect(first.reviews.reviewerId).not.toBe(second.reviews.reviewerId);
    expect(first.leads.ownerUserId).not.toBe(second.leads.ownerUserId);
  });
});
