import { describe, expect, it } from "vitest";

import { recordPayment, restorePayment } from "./payment";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("recordPayment", () => {
  it("creates a valid payment", () => {
    const result = recordPayment(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountCents).toBe(45000);
    expect(result.value.method).toBe("MOBILE_MONEY");
  });

  it("rejects a zero amount", () => {
    const result = recordPayment({ ...validInput(), amountCents: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_AMOUNT_CENTS");
  });

  it("rejects an unknown method", () => {
    const result = recordPayment({ ...validInput(), method: "CRYPTO" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_METHOD");
  });
});

describe("restorePayment", () => {
  it("round-trips a persisted payment", () => {
    const created = recordPayment(validInput());
    if (!created.ok) throw new Error("expected a valid payment");

    const result = restorePayment(created.value);

    expect(result).toEqual({ ok: true, value: created.value });
  });
});

function validInput() {
  return {
    id: "payment_test_01",
    invoiceId: "invoice_test_01",
    amountCents: 45000,
    method: "MOBILE_MONEY",
    paidAt: now,
    createdAt: now,
  };
}
