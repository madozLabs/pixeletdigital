import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { RequestContext } from "@/shared/request-context";

import {
  createDraftInvoice as createDraftInvoiceDomain,
  type Invoice,
} from "../domain/invoice";
import {
  createDraftQuote as createDraftQuoteDomain,
  markQuoteConverted as markQuoteConvertedDomain,
  setQuoteStatus as setQuoteStatusDomain,
  type DraftQuoteLineInput,
  type Quote,
  type QuoteDomainError,
  type Result,
} from "../domain/quote";
import type { BillingApplicationError } from "./application-error";
import {
  forbidden,
  hasWorldScope,
  mayAccessBilling,
  requireActiveActor,
} from "./billing-authorization";
import type { InvoiceRepository } from "./invoice-repository";
import type { QuoteRepository } from "./quote-repository";

export type QuoteDependencies = Readonly<{
  quotes: QuoteRepository;
  worlds: WorldRepository;
}>;

const WORLD_QUOTE_PREFIXES: Readonly<Record<string, string>> = {
  "pixel-digital": "PD-DV",
  "kwaliti-print": "KP-DV",
};

export type CreateDraftQuoteInput = Readonly<{
  id: string;
  worldKey: string;
  clientId: string;
  lines: readonly DraftQuoteLineInput[];
  discountCents?: number;
  taxRateBps?: number;
  notes?: string | null;
  issuedAt: Date;
  validUntil?: Date | null;
}>;

export async function createDraftQuote(
  dependencies: QuoteDependencies,
  context: RequestContext,
  input: CreateDraftQuoteInput,
): Promise<Result<Quote, BillingApplicationError>> {
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
  const existingCount = await dependencies.quotes.countByWorld(world.key);
  const prefix =
    WORLD_QUOTE_PREFIXES[world.key] ?? world.key.slice(0, 2).toUpperCase();
  const number = `${prefix}-${now.getUTCFullYear()}-${String(existingCount + 1).padStart(4, "0")}`;

  const quoteResult = createDraftQuoteDomain({
    id: input.id,
    worldKey: world.key,
    clientId: input.clientId,
    number,
    lines: input.lines,
    discountCents: input.discountCents,
    taxRateBps: input.taxRateBps,
    notes: input.notes,
    issuedAt: input.issuedAt,
    validUntil: input.validUntil,
    createdAt: now,
    updatedAt: now,
  });
  if (!quoteResult.ok) return validationFailure(quoteResult.error);

  await dependencies.quotes.save(quoteResult.value);
  return { ok: true, value: quoteResult.value };
}

export type ListQuotesByWorldInput = Readonly<{ worldKey: string }>;

export async function listQuotesByWorld(
  dependencies: QuoteDependencies,
  context: RequestContext,
  input: ListQuotesByWorldInput,
): Promise<Result<readonly Quote[], BillingApplicationError>> {
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

  const quotes = await dependencies.quotes.listByWorld(worldKeyResult.value);
  return { ok: true, value: quotes };
}

export type UpdateQuoteStatusInput = Readonly<{
  id: string;
  expectedVersion: number;
  status: string;
}>;

export async function updateQuoteStatus(
  dependencies: QuoteDependencies,
  context: RequestContext,
  input: UpdateQuoteStatusInput,
): Promise<Result<Quote, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const quote = await dependencies.quotes.findById(input.id);
  if (!quote) return notFound();
  if (!mayAccessBilling(actor) || !hasWorldScope(actor, quote.worldKey))
    return forbidden();
  if (quote.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The quote has changed since it was last read.",
      },
    };
  }

  const transitioned = setQuoteStatusDomain(
    quote,
    input.status,
    context.clock.now(),
  );
  if (!transitioned.ok) return validationFailure(transitioned.error);

  await dependencies.quotes.save(transitioned.value);
  return { ok: true, value: transitioned.value };
}

export type ConvertQuoteToInvoiceInput = Readonly<{
  id: string;
  expectedVersion: number;
  invoiceId: string;
  dueInDays?: number;
}>;

export async function convertQuoteToInvoice(
  dependencies: QuoteDependencies & { invoices: InvoiceRepository },
  context: RequestContext,
  input: ConvertQuoteToInvoiceInput,
): Promise<Result<Invoice, BillingApplicationError>> {
  const actorResult = requireActiveActor(context);
  if (!actorResult.ok) return actorResult;
  const actor = actorResult.value;

  const quote = await dependencies.quotes.findById(input.id);
  if (!quote) return notFound();
  if (!mayAccessBilling(actor) || !hasWorldScope(actor, quote.worldKey))
    return forbidden();
  if (quote.version !== input.expectedVersion) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "The quote has changed since it was last read.",
      },
    };
  }
  if (quote.status !== "ACCEPTED") {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        validationCode: "INVALID_TRANSITION",
        message: `Only an accepted quote can be converted, but status is ${quote.status}.`,
      },
    };
  }
  if (await dependencies.quotes.hasInvoice(quote.id)) {
    return {
      ok: false,
      error: {
        code: "CONFLICT",
        message: "This quote has already been converted to an invoice.",
      },
    };
  }

  const now = context.clock.now();
  const existingInvoiceCount = await dependencies.invoices.countByWorld(
    quote.worldKey,
  );
  const prefix =
    WORLD_QUOTE_PREFIXES[quote.worldKey]?.replace("DV", "FA") ??
    quote.worldKey.slice(0, 2).toUpperCase();
  const number = `${prefix}-${now.getUTCFullYear()}-${String(existingInvoiceCount + 1).padStart(4, "0")}`;
  const dueAt = new Date(now);
  dueAt.setUTCDate(dueAt.getUTCDate() + (input.dueInDays ?? 30));

  const invoiceResult = createDraftInvoiceDomain({
    id: input.invoiceId,
    worldKey: quote.worldKey,
    clientId: quote.clientId,
    quoteId: quote.id,
    number,
    lines: quote.lines,
    discountCents: quote.discountCents,
    taxRateBps: quote.taxRateBps,
    notes: quote.notes,
    issuedAt: now,
    dueAt,
    createdAt: now,
    updatedAt: now,
  });
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

  const convertedQuote = markQuoteConvertedDomain(quote, now);
  if (!convertedQuote.ok) return validationFailure(convertedQuote.error);

  // Sequential, not a batch transaction: worst case on a crash between the
  // two writes is an invoice without its quote marked CONVERTED, recoverable
  // by manual review -- same accepted-risk shape as PrismaEnquiryRepository.
  await dependencies.invoices.save(invoiceResult.value);
  await dependencies.quotes.save(convertedQuote.value);
  return { ok: true, value: invoiceResult.value };
}

function notFound(): Result<never, BillingApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Quote was not found." },
  };
}

function validationFailure(
  error: QuoteDomainError,
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
