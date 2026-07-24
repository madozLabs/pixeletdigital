import { describe, expect, it } from "vitest";

import {
  applyInvoicePayment,
  cancelInvoice,
  createDraftInvoice,
  markInvoiceSent,
  restoreInvoice,
} from "./invoice";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createDraftInvoice", () => {
  it("creates a DRAFT invoice with computed totals", () => {
    const result = createDraftInvoice(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("DRAFT");
    expect(result.value.version).toBe(1);
    expect(result.value.subtotalCents).toBe(90000);
    expect(result.value.totalCents).toBe(90000);
  });

  it("applies discount then tax on top of the line subtotal", () => {
    const result = createDraftInvoice({
      ...validInput(),
      discountCents: 10000,
      taxRateBps: 1000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // (90000 - 10000) * 1.10 = 88000
    expect(result.value.totalCents).toBe(88000);
  });

  it("rejects an invoice with no lines", () => {
    const result = createDraftInvoice({ ...validInput(), lines: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LINES");
  });

  it("rejects a negative discount", () => {
    const result = createDraftInvoice({ ...validInput(), discountCents: -1 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_DISCOUNT_CENTS");
  });
});

describe("invoice lifecycle", () => {
  it("transitions DRAFT -> SENT", () => {
    const draft = validInvoice();
    const sent = markInvoiceSent(draft, now);

    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.status).toBe("SENT");
  });

  it("cancels a DRAFT, SENT, PARTIALLY_PAID, or OVERDUE invoice", () => {
    const draft = validInvoice();
    const cancelled = cancelInvoice(draft, now);

    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.status).toBe("CANCELLED");
  });

  it("rejects cancelling a PAID invoice", () => {
    const draft = validInvoice();
    const paid = applyInvoicePayment(draft, draft.totalCents, now);
    if (!paid.ok) throw new Error("expected payment to succeed");

    const result = cancelInvoice(paid.value, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("applyInvoicePayment", () => {
  it("marks PARTIALLY_PAID when the cumulative payment is below total", () => {
    const draft = validInvoice();
    const result = applyInvoicePayment(draft, draft.totalCents - 1000, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PARTIALLY_PAID");
    expect(result.value.paidAt).toBeNull();
  });

  it("marks PAID and sets paidAt when the cumulative payment reaches total", () => {
    const draft = validInvoice();
    const result = applyInvoicePayment(draft, draft.totalCents, now);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("PAID");
    expect(result.value.paidAt).toEqual(now);
  });

  it("rejects a zero or negative payment amount", () => {
    const draft = validInvoice();
    const result = applyInvoicePayment(draft, 0, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_PAYMENT_AMOUNT");
  });

  it("rejects a payment against a cancelled invoice", () => {
    const draft = validInvoice();
    const cancelled = cancelInvoice(draft, now);
    if (!cancelled.ok) throw new Error("expected cancel to succeed");

    const result = applyInvoicePayment(cancelled.value, 1000, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });
});

describe("restoreInvoice", () => {
  it("round-trips a persisted invoice", () => {
    const draft = validInvoice();

    const result = restoreInvoice(draft);

    expect(result).toEqual({ ok: true, value: draft });
  });

  it("accepts PARTIALLY_PAID and OVERDUE as valid persisted statuses", () => {
    const result = restoreInvoice({
      ...validInvoice(),
      status: "PARTIALLY_PAID",
    });

    expect(result.ok).toBe(true);
  });
});

function validInput() {
  return {
    id: "invoice_test_01",
    worldKey: "pixel-digital",
    clientId: "client_test_01",
    number: "PD-FA-2026-0001",
    lines: [
      {
        id: "line_01",
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
      {
        id: "line_02",
        label: "Charte graphique",
        quantity: 1,
        unitPriceCents: 45000,
      },
    ],
    issuedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function validInvoice() {
  const result = createDraftInvoice(validInput());
  if (!result.ok) throw new Error("expected a valid draft invoice");
  return result.value;
}
