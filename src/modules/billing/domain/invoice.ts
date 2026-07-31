export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

// A draft was never sent to the client and carries no financial commitment,
// so it can still be cancelled outright. Once sent (or paid), cancelling in
// place would erase the trail of a document the client may already hold --
// applyCreditNote is the only way to reduce or close it from there on.
const DIRECTLY_CANCELLABLE_STATUSES: readonly InvoiceStatus[] = ["DRAFT"];
const PAYABLE_STATUSES: readonly InvoiceStatus[] = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "OVERDUE",
];
const CREDITABLE_STATUSES: readonly InvoiceStatus[] = [
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
];

export type InvoiceDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_CLIENT_ID"
  | "INVALID_NUMBER"
  | "INVALID_LINES"
  | "INVALID_LINE_LABEL"
  | "INVALID_LINE_QUANTITY"
  | "INVALID_LINE_UNIT_PRICE_CENTS"
  | "INVALID_DISCOUNT_CENTS"
  | "INVALID_TAX_RATE_BPS"
  | "INVALID_NOTES"
  | "INVALID_STATUS"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION"
  | "INVALID_PAYMENT_AMOUNT"
  | "INVALID_CREDIT_AMOUNT";

export type InvoiceDomainError = Readonly<{
  code: InvoiceDomainErrorCode;
  message: string;
}>;

export type InvoiceLine = Readonly<{
  id: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}>;

export type Invoice = Readonly<{
  id: string;
  worldKey: string;
  clientId: string;
  quoteId: string | null;
  number: string;
  status: InvoiceStatus;
  subtotalCents: number;
  discountCents: number;
  taxRateBps: number;
  totalCents: number;
  notes: string | null;
  lines: readonly InvoiceLine[];
  issuedAt: Date;
  dueAt: Date | null;
  paidAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return INVOICE_STATUSES.includes(value as InvoiceStatus);
}

export type DraftInvoiceLineInput = Readonly<{
  id: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
}>;

export type DraftInvoiceInput = Readonly<{
  id: string;
  worldKey: string;
  clientId: string;
  quoteId?: string | null;
  number: string;
  lines: readonly DraftInvoiceLineInput[];
  discountCents?: number;
  taxRateBps?: number;
  notes?: string | null;
  issuedAt: Date;
  dueAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export function createDraftInvoice(
  input: DraftInvoiceInput,
): Result<Invoice, InvoiceDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Invoice id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const clientId = input.clientId.trim();
  if (!clientId) {
    return failure(
      "INVALID_CLIENT_ID",
      "Invoice clientId must be a non-empty identifier.",
    );
  }

  const number = input.number.trim();
  if (!number || number.length > 40) {
    return failure(
      "INVALID_NUMBER",
      "Invoice number must contain between 1 and 40 characters.",
    );
  }

  if (input.lines.length === 0) {
    return failure("INVALID_LINES", "Invoice must contain at least one line.");
  }

  const lines: InvoiceLine[] = [];
  for (const rawLine of input.lines) {
    const lineResult = buildLine(rawLine);
    if (!lineResult.ok) return lineResult;
    lines.push(lineResult.value);
  }

  const discountResult = parseDiscountCents(input.discountCents ?? 0);
  if (!discountResult.ok) return discountResult;

  const taxRateResult = parseTaxRateBps(input.taxRateBps ?? 0);
  if (!taxRateResult.ok) return taxRateResult;

  const notesResult = parseNotes(input.notes);
  if (!notesResult.ok) return notesResult;

  const subtotalCents = sumLines(lines);
  const totalCents = computeTotal(
    subtotalCents,
    discountResult.value,
    taxRateResult.value,
  );

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      clientId,
      quoteId: input.quoteId?.trim() || null,
      number,
      status: "DRAFT",
      subtotalCents,
      discountCents: discountResult.value,
      taxRateBps: taxRateResult.value,
      totalCents,
      notes: notesResult.value,
      lines: Object.freeze(lines),
      issuedAt: new Date(input.issuedAt),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      paidAt: null,
      version: 1,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreInvoice(
  input: Readonly<{
    id: string;
    worldKey: string;
    clientId: string;
    quoteId: string | null;
    number: string;
    status: string;
    discountCents: number;
    taxRateBps: number;
    notes: string | null;
    lines: readonly InvoiceLine[];
    issuedAt: Date;
    dueAt: Date | null;
    paidAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<Invoice, InvoiceDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Invoice id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  if (!isInvoiceStatus(input.status)) {
    return failure(
      "INVALID_STATUS",
      "Invoice status is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "Invoice version must be a positive integer.",
    );
  }

  if (input.lines.length === 0) {
    return failure("INVALID_LINES", "Invoice must contain at least one line.");
  }

  const subtotalCents = sumLines(input.lines);
  const totalCents = computeTotal(
    subtotalCents,
    input.discountCents,
    input.taxRateBps,
  );

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      clientId: input.clientId,
      quoteId: input.quoteId,
      number: input.number,
      status: input.status,
      subtotalCents,
      discountCents: input.discountCents,
      taxRateBps: input.taxRateBps,
      totalCents,
      notes: input.notes,
      lines: Object.freeze([...input.lines]),
      issuedAt: new Date(input.issuedAt),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      paidAt: input.paidAt ? new Date(input.paidAt) : null,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function markInvoiceSent(
  invoice: Invoice,
  updatedAt: Date,
): Result<Invoice, InvoiceDomainError> {
  if (invoice.status !== "DRAFT") {
    return failure(
      "INVALID_TRANSITION",
      `Only a draft invoice can be sent, but status is ${invoice.status}.`,
    );
  }
  return transition(invoice, { status: "SENT" }, updatedAt);
}

export function cancelInvoice(
  invoice: Invoice,
  updatedAt: Date,
): Result<Invoice, InvoiceDomainError> {
  if (!DIRECTLY_CANCELLABLE_STATUSES.includes(invoice.status)) {
    return failure(
      "INVALID_TRANSITION",
      invoice.status === "CANCELLED"
        ? "Cette facture est déjà annulée."
        : "Une facture envoyée, payée ou en retard ne peut plus être annulée directement : émettez un avoir pour la corriger.",
    );
  }
  return transition(invoice, { status: "CANCELLED" }, updatedAt);
}

export function applyInvoicePayment(
  invoice: Invoice,
  totalPaidCents: number,
  paidAt: Date,
): Result<Invoice, InvoiceDomainError> {
  if (!PAYABLE_STATUSES.includes(invoice.status)) {
    return failure(
      "INVALID_TRANSITION",
      `Cannot record a payment against an invoice with status ${invoice.status}.`,
    );
  }
  if (!Number.isInteger(totalPaidCents) || totalPaidCents <= 0) {
    return failure(
      "INVALID_PAYMENT_AMOUNT",
      "Payment amount must be a positive integer.",
    );
  }

  const isFullyPaid = totalPaidCents >= invoice.totalCents;
  return transition(
    invoice,
    {
      status: isFullyPaid ? "PAID" : "PARTIALLY_PAID",
      paidAt: isFullyPaid ? paidAt : invoice.paidAt,
    },
    paidAt,
  );
}

// totalCreditedCents is the cumulative total of every credit note already
// issued against this invoice, including the one about to be saved -- the
// caller (issueCreditNote use case) computes it fresh from the ledger under
// the same version guard used everywhere else, so two concurrent partial
// credit notes can never together exceed the invoice total even though
// neither one alone would trip this check.
export function applyCreditNote(
  invoice: Invoice,
  totalCreditedCents: number,
  now: Date,
): Result<Invoice, InvoiceDomainError> {
  if (!CREDITABLE_STATUSES.includes(invoice.status)) {
    return failure(
      "INVALID_TRANSITION",
      invoice.status === "DRAFT"
        ? "Une facture brouillon n'a pas encore été envoyée : annulez-la directement plutôt que d'émettre un avoir."
        : "Cette facture est déjà annulée, aucun avoir ne peut plus lui être associé.",
    );
  }
  if (!Number.isInteger(totalCreditedCents) || totalCreditedCents <= 0) {
    return failure(
      "INVALID_CREDIT_AMOUNT",
      "Le montant cumulé des avoirs doit être un entier positif.",
    );
  }
  if (totalCreditedCents > invoice.totalCents) {
    return failure(
      "INVALID_CREDIT_AMOUNT",
      "Le montant cumulé des avoirs ne peut pas dépasser le total de la facture.",
    );
  }

  const isFullyCredited = totalCreditedCents >= invoice.totalCents;
  return transition(
    invoice,
    { status: isFullyCredited ? "CANCELLED" : invoice.status },
    now,
  );
}

function transition(
  invoice: Invoice,
  changes: Readonly<{ status: InvoiceStatus; paidAt?: Date | null }>,
  updatedAt: Date,
): Result<Invoice, InvoiceDomainError> {
  return {
    ok: true,
    value: Object.freeze({
      ...invoice,
      ...changes,
      version: invoice.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

function buildLine(
  rawLine: DraftInvoiceLineInput,
): Result<InvoiceLine, InvoiceDomainError> {
  const id = rawLine.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Invoice line id must be a non-empty opaque identifier.",
    );
  }

  const label = rawLine.label.trim();
  if (!label || label.length > 160) {
    return failure(
      "INVALID_LINE_LABEL",
      "Invoice line label must contain between 1 and 160 characters.",
    );
  }

  if (!Number.isInteger(rawLine.quantity) || rawLine.quantity < 1) {
    return failure(
      "INVALID_LINE_QUANTITY",
      "Invoice line quantity must be a positive integer.",
    );
  }

  if (!Number.isInteger(rawLine.unitPriceCents) || rawLine.unitPriceCents < 0) {
    return failure(
      "INVALID_LINE_UNIT_PRICE_CENTS",
      "Invoice line unitPriceCents must be a non-negative integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      label,
      quantity: rawLine.quantity,
      unitPriceCents: rawLine.unitPriceCents,
      totalCents: rawLine.quantity * rawLine.unitPriceCents,
    }),
  };
}

function sumLines(lines: readonly InvoiceLine[]): number {
  return lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceCents,
    0,
  );
}

function computeTotal(
  subtotalCents: number,
  discountCents: number,
  taxRateBps: number,
): number {
  const taxable = Math.max(0, subtotalCents - discountCents);
  return taxable + Math.round((taxable * taxRateBps) / 10000);
}

function parseWorldKey(
  rawWorldKey: string,
): Result<string, InvoiceDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "Invoice worldKey must be a non-empty world stable key.",
    );
  }
  return { ok: true, value: worldKey };
}

function parseDiscountCents(value: number): Result<number, InvoiceDomainError> {
  if (!Number.isInteger(value) || value < 0) {
    return failure(
      "INVALID_DISCOUNT_CENTS",
      "Invoice discountCents must be a non-negative integer.",
    );
  }
  return { ok: true, value };
}

function parseTaxRateBps(value: number): Result<number, InvoiceDomainError> {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    return failure(
      "INVALID_TAX_RATE_BPS",
      "Invoice taxRateBps must be between 0 and 10000.",
    );
  }
  return { ok: true, value };
}

function parseNotes(
  value: string | null | undefined,
): Result<string | null, InvoiceDomainError> {
  if (!value || !value.trim()) return { ok: true, value: null };
  const notes = value.trim();
  if (notes.length > 1200) {
    return failure(
      "INVALID_NOTES",
      "Invoice notes must contain at most 1200 characters.",
    );
  }
  return { ok: true, value: notes };
}

function failure(
  code: InvoiceDomainErrorCode,
  message: string,
): Result<never, InvoiceDomainError> {
  return { ok: false, error: { code, message } };
}
