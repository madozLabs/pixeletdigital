import { describe, expect, it } from "vitest";

import {
  cancelEditorialItem,
  createDraftEditorialItem,
  editPlannedEditorialItem,
  isEditorialItemLate,
  markEditorialItemDone,
  restoreEditorialItem,
  type EditorialItem,
} from "./editorial-item";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createDraftEditorialItem", () => {
  it("creates a PLANNED item with version 1", () => {
    const result = createDraftEditorialItem(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PLANNED");
    expect(result.value.version).toBe(1);
    expect(result.value.proofUrl).toBeNull();
    expect(result.value.realizedAt).toBeNull();
  });

  it("rejects an empty title", () => {
    const result = createDraftEditorialItem(validInput({ title: "  " }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TITLE");
  });

  it("rejects an invalid scheduledFor", () => {
    const result = createDraftEditorialItem(
      validInput({ scheduledFor: new Date("not-a-date") }),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_SCHEDULED_FOR");
  });
});

describe("markEditorialItemDone", () => {
  it("transitions PLANNED to DONE and stores the proof link", () => {
    const item = plannedItem();
    const result = markEditorialItemDone(
      item,
      "https://instagram.com/p/abc",
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("DONE");
    expect(result.value.proofUrl).toBe("https://instagram.com/p/abc");
    expect(result.value.realizedAt).toEqual(now);
    expect(result.value.version).toBe(item.version + 1);
  });

  it("rejects marking done without a proof link", () => {
    const item = plannedItem();
    const result = markEditorialItemDone(item, "   ", now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PROOF_URL");
  });

  it("rejects marking an already-done item as done again", () => {
    const item = plannedItem();
    const done = markEditorialItemDone(
      item,
      "https://instagram.com/p/abc",
      now,
    );
    if (!done.ok) throw new Error("expected first transition to succeed");

    const result = markEditorialItemDone(
      done.value,
      "https://instagram.com/p/def",
      now,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("cancelEditorialItem", () => {
  it("transitions PLANNED to CANCELLED", () => {
    const item = plannedItem();
    const result = cancelEditorialItem(item, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("CANCELLED");
  });
});

describe("editPlannedEditorialItem", () => {
  it("updates fields while still PLANNED", () => {
    const item = plannedItem();
    const result = editPlannedEditorialItem(
      item,
      {
        clientLabel: "Client B",
        channel: "TikTok",
        title: "New title",
        scheduledFor: new Date("2026-08-01T00:00:00.000Z"),
      },
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.clientLabel).toBe("Client B");
    expect(result.value.version).toBe(item.version + 1);
  });

  it("rejects editing a DONE item", () => {
    const item = plannedItem();
    const done = markEditorialItemDone(
      item,
      "https://instagram.com/p/abc",
      now,
    );
    if (!done.ok) throw new Error("expected transition to succeed");

    const result = editPlannedEditorialItem(
      done.value,
      {
        clientLabel: "Client B",
        channel: "TikTok",
        title: "New title",
        scheduledFor: now,
      },
      now,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("restoreEditorialItem", () => {
  it("round-trips a persisted item", () => {
    const item = plannedItem();
    const result = restoreEditorialItem(item);

    expect(result).toEqual({ ok: true, value: item });
  });

  it("rejects an unknown status", () => {
    const result = restoreEditorialItem({
      ...plannedItem(),
      status: "UNKNOWN",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_STATUS");
  });
});

describe("isEditorialItemLate", () => {
  it("is late when PLANNED and scheduledFor is in the past", () => {
    const item = plannedItem({
      scheduledFor: new Date("2026-07-01T00:00:00.000Z"),
    });

    expect(isEditorialItemLate(item, now)).toBe(true);
  });

  it("is not late when DONE even if scheduledFor is in the past", () => {
    const item = plannedItem({
      scheduledFor: new Date("2026-07-01T00:00:00.000Z"),
    });
    const done = markEditorialItemDone(
      item,
      "https://instagram.com/p/abc",
      now,
    );
    if (!done.ok) throw new Error("expected transition to succeed");

    expect(isEditorialItemLate(done.value, now)).toBe(false);
  });

  it("is not late when scheduledFor is in the future", () => {
    const item = plannedItem({
      scheduledFor: new Date("2026-08-01T00:00:00.000Z"),
    });

    expect(isEditorialItemLate(item, now)).toBe(false);
  });
});

function validInput(
  overrides: Partial<{
    id: string;
    worldKey: string;
    clientLabel: string;
    channel: string;
    title: string;
    scheduledFor: Date;
  }> = {},
) {
  return {
    id: overrides.id ?? "editorial_test_01",
    worldKey: overrides.worldKey ?? "pixel-digital",
    clientLabel: overrides.clientLabel ?? "Client A",
    channel: overrides.channel ?? "Instagram",
    title: overrides.title ?? "Post produit",
    scheduledFor:
      overrides.scheduledFor ?? new Date("2026-07-25T00:00:00.000Z"),
    createdAt: now,
    updatedAt: now,
  };
}

function plannedItem(
  overrides: Partial<{ scheduledFor: Date }> = {},
): EditorialItem {
  const result = createDraftEditorialItem(validInput(overrides));
  if (!result.ok) throw new Error("expected a valid draft editorial item");
  return result.value;
}
