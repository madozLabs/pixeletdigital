import { describe, expect, it } from "vitest";

import { issueCreditNote, restoreCreditNote } from "./credit-note";

const now = new Date("2026-07-31T00:00:00.000Z");

describe("issueCreditNote", () => {
  it("creates a valid credit note with computed totals", () => {
    const result = issueCreditNote(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.subtotalCents).toBe(20000);
    expect(result.value.totalCents).toBe(20000);
  });

  it("applies the inherited tax rate on top of the line subtotal", () => {
    const result = issueCreditNote({ ...validInput(), taxRateBps: 1000 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // 20000 * 1.10 = 22000
    expect(result.value.totalCents).toBe(22000);
  });

  it("rejects a credit note with no lines", () => {
    const result = issueCreditNote({ ...validInput(), lines: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LINES");
  });

  it("rejects a missing reason", () => {
    const result = issueCreditNote({ ...validInput(), reason: "" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_REASON");
  });

  it("rejects a reason that is too short", () => {
    const result = issueCreditNote({ ...validInput(), reason: "x" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_REASON");
  });

  it("rejects an invalid tax rate", () => {
    const result = issueCreditNote({ ...validInput(), taxRateBps: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TAX_RATE_BPS");
  });
});

describe("restoreCreditNote", () => {
  it("round-trips a persisted credit note", () => {
    const created = issueCreditNote(validInput());
    if (!created.ok) throw new Error("expected a valid credit note");

    const result = restoreCreditNote(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "credit_note_test_01",
    worldKey: "pixel-digital",
    invoiceId: "invoice_test_01",
    number: "PD-AV-2026-0001",
    reason: "Remboursement partiel accordé au client suite à un retard.",
    taxRateBps: 0,
    lines: [
      {
        id: "line_01",
        label: "Correction ligne 2",
        quantity: 1,
        unitPriceCents: 20000,
      },
    ],
    issuedAt: now,
    createdAt: now,
  };
}
