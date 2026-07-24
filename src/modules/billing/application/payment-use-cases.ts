import { randomUUID } from "node:crypto";

import type { RequestContext } from "@/shared/request-context";

import { applyInvoicePayment } from "../domain/invoice";
import {
  recordPayment as recordPaymentDomain,
  type Payment,
  type Result,
} from "../domain/payment";
import type { BillingApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { InvoiceRepository } from "./invoice-repository";
import type { PaymentRepository } from "./payment-repository";

export type PaymentDependencies = Readonly<{
  invoices: InvoiceRepository;
  payments: PaymentRepository;
}>;

export type RecordPaymentInput = Readonly<{
  invoiceId: string;
  expectedVersion: number;
  amountCents: number;
  method: string;
  reference?: string | null;
  notes?: string | null;
}>;

export async function recordInvoicePayment(
  dependencies: PaymentDependencies,
  context: RequestContext,
  input: RecordPaymentInput,
): Promise<Result<Payment, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const invoice = await dependencies.invoices.findById(input.invoiceId);
  if (!invoice) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Invoice was not found." },
    };
  }
  if (!mayAccessBilling(actor) || !hasWorldScope(actor, invoice.worldKey)) {
    return forbidden();
  }
  if (invoice.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The invoice has changed since it was last read.",
      },
    };
  }

  const now = context.clock.now();
  const paymentResult = recordPaymentDomain({
    id: randomUUID(),
    invoiceId: input.invoiceId,
    amountCents: input.amountCents,
    method: input.method,
    reference: input.reference,
    notes: input.notes,
    paidAt: now,
    createdAt: now,
  });
  if (!paymentResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: paymentResult.error.code,
        message: paymentResult.error.message,
      },
    };
  }

  const paidSoFar = await dependencies.payments.totalPaidForInvoice(
    input.invoiceId,
  );
  const totalPaidCents = paidSoFar + input.amountCents;
  const invoiceResult = applyInvoicePayment(invoice, totalPaidCents, now);
  if (!invoiceResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: invoiceResult.error.code,
        message: invoiceResult.error.message,
      },
    };
  }

  // Save the payment first: it's an immutable, append-only record that is
  // safe to have even if the invoice status update below fails (recoverable
  // by re-deriving the invoice status from its payments), matching the
  // sequential-writes pattern used by PrismaEnquiryRepository.
  await dependencies.payments.save(paymentResult.value);
  await dependencies.invoices.save(invoiceResult.value);
  return { ok: true, value: paymentResult.value };
}
