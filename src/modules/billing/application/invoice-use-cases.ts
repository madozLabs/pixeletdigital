import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  cancelInvoice as cancelInvoiceDomain,
  createDraftInvoice as createDraftInvoiceDomain,
  markInvoiceSent as markInvoiceSentDomain,
  type DraftInvoiceLineInput,
  type Invoice,
  type InvoiceDomainError,
  type Result,
} from "../domain/invoice";
import type { BillingApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { InvoiceRepository } from "./invoice-repository";

export type InvoiceDependencies = Readonly<{
  invoices: InvoiceRepository;
  worlds: WorldRepository;
}>;

const WORLD_INVOICE_PREFIXES: Readonly<Record<string, string>> = {
  "pixel-digital": "PD-FA",
  "kwaliti-print": "KP-FA",
};

export type CreateDraftInvoiceInput = Readonly<{
  id: string;
  worldKey: string;
  clientId: string;
  quoteId?: string | null;
  lines: readonly DraftInvoiceLineInput[];
  discountCents?: number;
  taxRateBps?: number;
  notes?: string | null;
  issuedAt: Date;
  dueAt?: Date | null;
}>;

export async function createDraftInvoice(
  dependencies: InvoiceDependencies,
  context: RequestContext,
  input: CreateDraftInvoiceInput,
): Promise<Result<Invoice, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_WORLD_KEY",
        message: worldKeyResult.error.message,
      },
    };
  }

  if (!mayAccessBilling(actor) || !hasWorldScope(actor, worldKeyResult.value)) {
    return forbidden();
  }

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "World was not found." },
    };
  }
  if (world.mode === "INACTIVE") return forbidden();

  const now = context.clock.now();
  const existingCount = await dependencies.invoices.countByWorld(world.key);
  const prefix =
    WORLD_INVOICE_PREFIXES[world.key] ?? world.key.slice(0, 2).toUpperCase();
  const number = `${prefix}-${now.getUTCFullYear()}-${String(existingCount + 1).padStart(4, "0")}`;

  const invoiceResult = createDraftInvoiceDomain({
    id: input.id,
    worldKey: world.key,
    clientId: input.clientId,
    quoteId: input.quoteId,
    number,
    lines: input.lines,
    discountCents: input.discountCents,
    taxRateBps: input.taxRateBps,
    notes: input.notes,
    issuedAt: input.issuedAt,
    dueAt: input.dueAt,
    createdAt: now,
    updatedAt: now,
  });
  if (!invoiceResult.ok) return validationFailure(invoiceResult.error);

  await dependencies.invoices.save(invoiceResult.value);
  return { ok: true, value: invoiceResult.value };
}

export type ListInvoicesByWorldInput = Readonly<{ worldKey: string }>;

export async function listInvoicesByWorld(
  dependencies: InvoiceDependencies,
  context: RequestContext,
  input: ListInvoicesByWorldInput,
): Promise<Result<readonly Invoice[], BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_WORLD_KEY",
        message: worldKeyResult.error.message,
      },
    };
  }

  if (
    !mayAccessBilling(actorResult.value) ||
    !hasWorldScope(actorResult.value, worldKeyResult.value)
  ) {
    return forbidden();
  }

  const invoices = await dependencies.invoices.listByWorld(
    worldKeyResult.value,
  );
  return { ok: true, value: invoices };
}

export type GetInvoiceByIdInput = Readonly<{ id: string }>;

export async function getInvoiceById(
  dependencies: InvoiceDependencies,
  context: RequestContext,
  input: GetInvoiceByIdInput,
): Promise<Result<Invoice, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;

  const invoice = await dependencies.invoices.findById(input.id);
  if (!invoice) return notFound();
  if (
    !mayAccessBilling(actorResult.value) ||
    !hasWorldScope(actorResult.value, invoice.worldKey)
  ) {
    return forbidden();
  }

  return { ok: true, value: invoice };
}

export type TransitionInvoiceInput = Readonly<{
  id: string;
  expectedVersion: number;
}>;

export async function markInvoiceSent(
  dependencies: InvoiceDependencies,
  context: RequestContext,
  input: TransitionInvoiceInput,
): Promise<Result<Invoice, BillingApplicationError>> {
  return withMutableInvoice(dependencies, context, input, (invoice, now) =>
    markInvoiceSentDomain(invoice, now),
  );
}

export async function cancelInvoice(
  dependencies: InvoiceDependencies,
  context: RequestContext,
  input: TransitionInvoiceInput,
): Promise<Result<Invoice, BillingApplicationError>> {
  return withMutableInvoice(dependencies, context, input, (invoice, now) =>
    cancelInvoiceDomain(invoice, now),
  );
}

async function withMutableInvoice(
  dependencies: InvoiceDependencies,
  context: RequestContext,
  input: Readonly<{ id: string; expectedVersion: number }>,
  transition: (
    invoice: Invoice,
    now: Date,
  ) => Result<Invoice, InvoiceDomainError>,
): Promise<Result<Invoice, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const invoice = await dependencies.invoices.findById(input.id);
  if (!invoice) return notFound();

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

  const transitioned = transition(invoice, context.clock.now());
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.invoices.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

function notFound(): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Invoice was not found." },
  };
}

function validationFailure(
  error: InvoiceDomainError,
): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      validationCode: error.code,
      message: error.message,
    },
  };
}
