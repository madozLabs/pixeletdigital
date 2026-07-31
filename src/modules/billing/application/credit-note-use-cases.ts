import { randomUUID } from "node:crypto";

import type { RequestContext } from "@/shared/request-context";

import { applyCreditNote } from "../domain/invoice";
import {
  issueCreditNote as issueCreditNoteDomain,
  type CreditNote,
  type DraftCreditNoteLineInput,
  type Result,
} from "../domain/credit-note";
import type { BillingApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { CreditNoteRepository } from "./credit-note-repository";
import type { InvoiceRepository } from "./invoice-repository";

export type CreditNoteDependencies = Readonly<{
  invoices: InvoiceRepository;
  creditNotes: CreditNoteRepository;
}>;

const WORLD_CREDIT_NOTE_PREFIXES: Readonly<Record<string, string>> = {
  "pixel-digital": "PD-AV",
  "kwaliti-print": "KP-AV",
};

export type IssueCreditNoteInput = Readonly<{
  invoiceId: string;
  expectedVersion: number;
  lines: readonly DraftCreditNoteLineInput[];
  reason: string;
  notes?: string | null;
  issuedAt?: Date | null;
}>;

export async function issueCreditNote(
  dependencies: CreditNoteDependencies,
  context: RequestContext,
  input: IssueCreditNoteInput,
): Promise<Result<CreditNote, BillingApplicationError>> {
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
        message: "La facture a changé entre-temps. Rechargez la page.",
      },
    };
  }

  const now = context.clock.now();

  // Same bounded-retry shape as createDraftInvoice: (worldKey, number) is
  // unique, so a number collision under concurrent issuance is recomputed
  // and retried transparently instead of surfacing as a generic failure.
  const MAX_NUMBER_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_NUMBER_ATTEMPTS; attempt++) {
    const alreadyCreditedCents =
      await dependencies.creditNotes.totalCreditedForInvoice(input.invoiceId);

    const creditNoteResult = issueCreditNoteDomain({
      id: randomUUID(),
      worldKey: invoice.worldKey,
      invoiceId: invoice.id,
      number: await nextNumber(dependencies, invoice.worldKey, now),
      reason: input.reason,
      notes: input.notes,
      taxRateBps: invoice.taxRateBps,
      lines: input.lines,
      issuedAt: input.issuedAt ?? now,
      createdAt: now,
    });
    if (!creditNoteResult.ok) return validationFailure(creditNoteResult.error);
    const creditNote = creditNoteResult.value;

    const prospectiveTotalCents = alreadyCreditedCents + creditNote.totalCents;
    if (prospectiveTotalCents > invoice.totalCents) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          validationCode: "EXCEEDS_INVOICE_BALANCE",
          message:
            "Le montant de l'avoir dépasse le solde restant de la facture.",
        },
      };
    }

    const invoiceResult = applyCreditNote(
      invoice,
      prospectiveTotalCents,
      now,
    );
    if (!invoiceResult.ok) return validationFailure(invoiceResult.error);

    try {
      // The credit note is an immutable, append-only record: safe to persist
      // even if the invoice's guarded update below loses a race, exactly
      // like Payment/recordInvoicePayment -- a retry re-reads the invoice
      // and recomputes the credited total from every credit note, so it
      // converges to the right status without losing this one.
      await dependencies.creditNotes.save(creditNote);
      const invoiceSaved = await dependencies.invoices.save(invoiceResult.value);
      if (!invoiceSaved) {
        return {
          ok: false,
          error: {
            code: "CONFLICT",
            message:
              "L'avoir a été enregistré, mais la facture a changé entre-temps. Rechargez la page pour voir le solde à jour.",
          },
        };
      }
      return { ok: true, value: creditNote };
    } catch (error) {
      const isNumberCollision = isUniqueConstraintViolation(error);
      if (!isNumberCollision || attempt === MAX_NUMBER_ATTEMPTS) throw error;
    }
  }
  throw new Error("unreachable: retry loop always returns or throws");
}

async function nextNumber(
  dependencies: CreditNoteDependencies,
  worldKey: string,
  now: Date,
): Promise<string> {
  const existingCount = await dependencies.creditNotes.countByWorld(worldKey);
  const prefix =
    WORLD_CREDIT_NOTE_PREFIXES[worldKey] ?? worldKey.slice(0, 2).toUpperCase();
  return `${prefix}-${now.getUTCFullYear()}-${String(existingCount + 1).padStart(4, "0")}`;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export type ListCreditNotesByInvoiceInput = Readonly<{ invoiceId: string }>;

export async function listCreditNotesByInvoice(
  dependencies: CreditNoteDependencies,
  context: RequestContext,
  input: ListCreditNotesByInvoiceInput,
): Promise<Result<readonly CreditNote[], BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const invoice = await dependencies.invoices.findById(input.invoiceId);
  if (!invoice) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Invoice was not found." },
    };
  }
  if (
    !mayAccessBilling(actorResult.value) ||
    !hasWorldScope(actorResult.value, invoice.worldKey)
  ) {
    return forbidden();
  }

  return {
    ok: true,
    value: await dependencies.creditNotes.listByInvoice(input.invoiceId),
  };
}

export type GetCreditNoteByIdInput = Readonly<{ id: string }>;

export async function getCreditNoteById(
  dependencies: CreditNoteDependencies,
  context: RequestContext,
  input: GetCreditNoteByIdInput,
): Promise<Result<CreditNote, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const creditNote = await dependencies.creditNotes.findById(input.id);
  if (!creditNote) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Credit note was not found." },
    };
  }
  if (
    !mayAccessBilling(actorResult.value) ||
    !hasWorldScope(actorResult.value, creditNote.worldKey)
  ) {
    return forbidden();
  }

  return { ok: true, value: creditNote };
}

function validationFailure(
  error: Readonly<{ code: string; message: string }>,
): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code as never,
      message: error.message,
    },
  };
}
