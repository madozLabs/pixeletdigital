export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const INVOICE_STATUSES = ["DRAFT", "SENT", "PAID", "CANCELLED"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_CLIENT_ID"
  | "INVALID_NUMBER"
  | "INVALID_LINES"
  | "INVALID_LINE_LABEL"
  | "INVALID_LINE_QUANTITY"
  | "INVALID_LINE_UNIT_PRICE_CENTS"
  | "INVALID_STATUS"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

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
  number: string;
  status: InvoiceStatus;
  totalCents: number;
  lines: readonly InvoiceLine[];
  issuedAt: Date;
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

export function createDraftInvoice(
  input: Readonly<{
    id: string;
    worldKey: string;
    clientId: string;
    number: string;
    lines: readonly DraftInvoiceLineInput[];
    issuedAt: Date;
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

  const totalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      clientId,
      number,
      status: "DRAFT",
      totalCents,
      lines: Object.freeze(lines),
      issuedAt: new Date(input.issuedAt),
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
    number: string;
    status: string;
    lines: readonly InvoiceLine[];
    issuedAt: Date;
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

  const totalCents = input.lines.reduce(
    (sum, line) => sum + line.totalCents,
    0,
  );

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey: worldKeyResult.value,
      clientId: input.clientId,
      number: input.number,
      status: input.status,
      totalCents,
      lines: Object.freeze([...input.lines]),
      issuedAt: new Date(input.issuedAt),
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
  return transition(invoice, "SENT", updatedAt);
}

export function markInvoicePaid(
  invoice: Invoice,
  updatedAt: Date,
): Result<Invoice, InvoiceDomainError> {
  if (invoice.status !== "SENT") {
    return failure(
      "INVALID_TRANSITION",
      `Only a sent invoice can be marked paid, but status is ${invoice.status}.`,
    );
  }
  return transition(invoice, "PAID", updatedAt);
}

export function cancelInvoice(
  invoice: Invoice,
  updatedAt: Date,
): Result<Invoice, InvoiceDomainError> {
  if (invoice.status !== "DRAFT" && invoice.status !== "SENT") {
    return failure(
      "INVALID_TRANSITION",
      `Only a draft or sent invoice can be cancelled, but status is ${invoice.status}.`,
    );
  }
  return transition(invoice, "CANCELLED", updatedAt);
}

function transition(
  invoice: Invoice,
  status: InvoiceStatus,
  updatedAt: Date,
): Result<Invoice, InvoiceDomainError> {
  return {
    ok: true,
    value: Object.freeze({
      ...invoice,
      status,
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

function failure(
  code: InvoiceDomainErrorCode,
  message: string,
): Result<never, InvoiceDomainError> {
  return { ok: false, error: { code, message } };
}
