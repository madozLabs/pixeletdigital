import { describe, expect, it } from "vitest";

import { recordExpense, restoreExpense } from "./expense";

const now = new Date("2026-07-31T00:00:00.000Z");

describe("recordExpense", () => {
  it("creates a valid expense", () => {
    const result = recordExpense(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountCents).toBe(50000);
    expect(result.value.label).toBe("Facture électricité juillet");
  });

  it("rejects a zero or negative amount", () => {
    const result = recordExpense({ ...validInput(), amountCents: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_AMOUNT_CENTS");
  });

  it("rejects an empty label", () => {
    const result = recordExpense({ ...validInput(), label: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LABEL");
  });

  it("rejects an invalid expense date", () => {
    const result = recordExpense({
      ...validInput(),
      expenseDate: new Date("not-a-date"),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_EXPENSE_DATE");
  });
});

describe("restoreExpense", () => {
  it("round-trips a persisted expense", () => {
    const created = recordExpense(validInput());
    if (!created.ok) throw new Error("expected a valid expense");

    const result = restoreExpense(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "expense_test_01",
    worldKey: "pixel-digital",
    categoryId: "expense_category_test_01",
    label: "Facture électricité juillet",
    amountCents: 50000,
    expenseDate: now,
    createdAt: now,
  };
}
