import { describe, expect, it } from "vitest";

import { recordRevenueEntry, restoreRevenueEntry } from "./revenue-entry";

const now = new Date("2026-07-31T00:00:00.000Z");

describe("recordRevenueEntry", () => {
  it("creates a valid revenue entry", () => {
    const result = recordRevenueEntry(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountCents).toBe(75000);
  });

  it("rejects a zero or negative amount", () => {
    const result = recordRevenueEntry({ ...validInput(), amountCents: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_AMOUNT_CENTS");
  });

  it("rejects an empty label", () => {
    const result = recordRevenueEntry({ ...validInput(), label: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LABEL");
  });
});

describe("restoreRevenueEntry", () => {
  it("round-trips a persisted revenue entry", () => {
    const created = recordRevenueEntry(validInput());
    if (!created.ok) throw new Error("expected a valid revenue entry");

    const result = restoreRevenueEntry(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "revenue_entry_test_01",
    worldKey: "pixel-digital",
    label: "Vente comptoir - impression flyers",
    amountCents: 75000,
    revenueDate: now,
    createdAt: now,
  };
}
