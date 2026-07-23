import { describe, expect, it } from "vitest";

import {
  cancelInvoice,
  createDraftInvoice,
  markInvoicePaid,
  markInvoiceSent,
  restoreInvoice,
} from "./invoice";

const now = new Date("2026-07-23T00:00:00.000Z");

describe("createDraftInvoice", () => {
  it("creates a DRAFT invoice with computed totalCents", () => {
    const result = createDraftInvoice(validInput());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("DRAFT");
    expect(result.value.version).toBe(1);
    expect(result.value.totalCents).toBe(90000);
  });

  it("rejects an invoice with no lines", () => {
    const result = createDraftInvoice({ ...validInput(), lines: [] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LINES");
  });

  it("rejects a line with zero quantity", () => {
    const result = createDraftInvoice({
      ...validInput(),
      lines: [
        {
          id: "line_01",
          label: "Prestation",
          quantity: 0,
          unitPriceCents: 1000,
        },
      ],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_LINE_QUANTITY");
  });
});

describe("invoice lifecycle", () => {
  it("transitions DRAFT -> SENT -> PAID", () => {
    const draft = validInvoice();
    const sent = markInvoiceSent(draft, now);
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.value.status).toBe("SENT");

    const paid = markInvoicePaid(sent.value, now);
    expect(paid.ok).toBe(true);
    if (!paid.ok) return;
    expect(paid.value.status).toBe("PAID");
  });

  it("rejects marking a DRAFT invoice as paid directly", () => {
    const draft = validInvoice();

    const result = markInvoicePaid(draft, now);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_TRANSITION");
  });

  it("cancels a DRAFT or SENT invoice", () => {
    const draft = validInvoice();
    const cancelled = cancelInvoice(draft, now);
    expect(cancelled.ok).toBe(true);
    if (!cancelled.ok) return;
    expect(cancelled.value.status).toBe("CANCELLED");
  });

  it("rejects cancelling a PAID invoice", () => {
    const draft = validInvoice();
    const sent = markInvoiceSent(draft, now);
    if (!sent.ok) throw new Error("expected transition to succeed");
    const paid = markInvoicePaid(sent.value, now);
    if (!paid.ok) throw new Error("expected transition to succeed");

    const result = cancelInvoice(paid.value, now);

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
});

function validInput() {
  return {
    id: "invoice_test_01",
    worldKey: "pixel-digital",
    clientId: "client_test_01",
    number: "PD-2026-0001",
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
