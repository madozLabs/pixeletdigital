import { describe, expect, it } from "vitest";

import type { Clock } from "@/shared/clock";
import type {
  ApprovedRole,
  AuthorizationScope,
  RequestContext,
} from "@/shared/request-context";

import { createDraftInvoice as createDraftInvoiceDomain } from "../domain/invoice";
import { recordInvoicePayment } from "./payment-use-cases";
import { InMemoryInvoiceRepository } from "./testing/in-memory-invoice-repository";
import { InMemoryPaymentRepository } from "./testing/in-memory-payment-repository";

const createdAt = new Date("2026-07-15T08:00:00.000Z");
const clockTime = new Date("2026-07-23T10:30:00.000Z");

describe("recordInvoicePayment", () => {
  it("records a partial payment and marks the invoice PARTIALLY_PAID", async () => {
    const dependencies = dependenciesWithInvoice();
    const invoice = await dependencies.invoices.findById("invoice_test_01");
    if (!invoice) throw new Error("expected invoice to be seeded");

    const result = await recordInvoicePayment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        invoiceId: invoice.id,
        expectedVersion: invoice.version,
        amountCents: 20000,
        method: "MOBILE_MONEY",
      },
    );

    expect(result).toMatchObject({ ok: true, value: { amountCents: 20000 } });
    const updated = await dependencies.invoices.findById(invoice.id);
    expect(updated?.status).toBe("PARTIALLY_PAID");
  });

  it("marks the invoice PAID once cumulative payments reach the total", async () => {
    const dependencies = dependenciesWithInvoice();
    const invoice = await dependencies.invoices.findById("invoice_test_01");
    if (!invoice) throw new Error("expected invoice to be seeded");

    const first = await recordInvoicePayment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        invoiceId: invoice.id,
        expectedVersion: invoice.version,
        amountCents: 20000,
        method: "CASH",
      },
    );
    if (!first.ok) throw new Error("expected first payment to succeed");
    const afterFirst = await dependencies.invoices.findById(invoice.id);
    if (!afterFirst) throw new Error("expected invoice to still exist");

    const result = await recordInvoicePayment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        invoiceId: invoice.id,
        expectedVersion: afterFirst.version,
        amountCents: invoice.totalCents - 20000,
        method: "BANK_TRANSFER",
      },
    );

    expect(result.ok).toBe(true);
    const updated = await dependencies.invoices.findById(invoice.id);
    expect(updated?.status).toBe("PAID");
  });

  it("returns CONFLICT on a stale invoice version", async () => {
    const dependencies = dependenciesWithInvoice();
    const invoice = await dependencies.invoices.findById("invoice_test_01");
    if (!invoice) throw new Error("expected invoice to be seeded");

    const result = await recordInvoicePayment(
      dependencies,
      context("ADMIN", [{ type: "GLOBAL" }]),
      {
        invoiceId: invoice.id,
        expectedVersion: invoice.version + 1,
        amountCents: 1000,
        method: "CASH",
      },
    );

    expect(result).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
  });

  it.each<ApprovedRole>(["EDITOR", "SALES", "CONTRIBUTOR", "READER"])(
    "denies %s",
    async (role) => {
      const dependencies = dependenciesWithInvoice();
      const invoice = await dependencies.invoices.findById("invoice_test_01");
      if (!invoice) throw new Error("expected invoice to be seeded");

      const result = await recordInvoicePayment(
        dependencies,
        context(role, [{ type: "GLOBAL" }]),
        {
          invoiceId: invoice.id,
          expectedVersion: invoice.version,
          amountCents: 1000,
          method: "CASH",
        },
      );

      expect(result).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    },
  );
});

function dependenciesWithInvoice() {
  const invoices = new InMemoryInvoiceRepository();
  const payments = new InMemoryPaymentRepository();
  const invoiceResult = createDraftInvoiceDomain({
    id: "invoice_test_01",
    worldKey: "pixel-digital",
    clientId: "client_01",
    number: "PD-FA-2026-0001",
    lines: [
      {
        id: "line_01",
        label: "Création de logo",
        quantity: 1,
        unitPriceCents: 45000,
      },
    ],
    issuedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  });
  if (!invoiceResult.ok) throw new Error("expected a valid draft invoice");
  invoices.save(invoiceResult.value);
  return { invoices, payments };
}

function context(
  role: ApprovedRole,
  scopes: readonly AuthorizationScope[],
): RequestContext {
  const clock: Clock = { now: () => clockTime };
  return {
    actor: { id: "actor_01", active: true, role, scopes },
    correlationId: "test-correlation-id",
    clock,
    origin: { channel: "WORKSPACE" },
  };
}
