export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const QUOTE_STATUSES = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CONVERTED",
  "CANCELLED",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export type QuoteDomainErrorCode =
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
  | "INVALID_TRANSITION";

export type QuoteDomainError = Readonly<{
  code: QuoteDomainErrorCode;
  message: string;
}>;

export type QuoteLine = Readonly<{
  id: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}>;

export type Quote = Readonly<{
  id: string;
  worldKey: string;
  clientId: string;
  number: string;
  status: QuoteStatus;
  subtotalCents: number;
  discountCents: number;
  taxRateBps: number;
  totalCents: number;
  notes: string | null;
  lines: readonly QuoteLine[];
  issuedAt: Date;
  validUntil: Date | null;
  convertedAt: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function isQuoteStatus(value: string): value is QuoteStatus {
  return QUOTE_STATUSES.includes(value as QuoteStatus);
}

export type DraftQuoteLineInput = Readonly<{
  id: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
}>;

export type DraftQuoteInput = Readonly<{
  id: string;
  worldKey: string;
  clientId: string;
  number: string;
  lines: readonly DraftQuoteLineInput[];
  discountCents?: number;
  taxRateBps?: number;
  notes?: string | null;
  issuedAt: Date;
  validUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export function createDraftQuote(
  input: DraftQuoteInput,
): Result<Quote, QuoteDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Quote id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const clientId = input.clientId.trim();
  if (!clientId) {
    return failure(
      "INVALID_CLIENT_ID",
      "Quote clientId must be a non-empty identifier.",
    );
  }

  const number = input.number.trim();
  if (!number || number.length > 40) {
    return failure(
      "INVALID_NUMBER",
      "Quote number must contain between 1 and 40 characters.",
    );
  }

  if (input.lines.length === 0) {
    return failure("INVALID_LINES", "Quote must contain at least one line.");
  }

  const lines: QuoteLine[] = [];
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
      number,
      status: "DRAFT",
      subtotalCents,
      discountCents: discountResult.value,
      taxRateBps: taxRateResult.value,
      totalCents,
      notes: notesResult.value,
      lines: Object.freeze(lines),
      issuedAt: new Date(input.issuedAt),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      convertedAt: null,
      version: 1,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreQuote(
  input: Readonly<{
    id: string;
    worldKey: string;
    clientId: string;
    number: string;
    status: string;
    discountCents: number;
    taxRateBps: number;
    notes: string | null;
    lines: readonly QuoteLine[];
    issuedAt: Date;
    validUntil: Date | null;
    convertedAt: Date | null;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<Quote, QuoteDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Quote id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  if (!isQuoteStatus(input.status)) {
    return failure(
      "INVALID_STATUS",
      "Quote status is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "Quote version must be a positive integer.",
    );
  }

  if (input.lines.length === 0) {
    return failure("INVALID_LINES", "Quote must contain at least one line.");
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
      number: input.number,
      status: input.status,
      subtotalCents,
      discountCents: input.discountCents,
      taxRateBps: input.taxRateBps,
      totalCents,
      notes: input.notes,
      lines: Object.freeze([...input.lines]),
      issuedAt: new Date(input.issuedAt),
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      convertedAt: input.convertedAt ? new Date(input.convertedAt) : null,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

const SETTABLE_STATUSES: readonly QuoteStatus[] = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "CANCELLED",
];

export function setQuoteStatus(
  quote: Quote,
  status: string,
  updatedAt: Date,
): Result<Quote, QuoteDomainError> {
  if (quote.status === "CONVERTED") {
    return failure(
      "INVALID_TRANSITION",
      "A converted quote can no longer change status.",
    );
  }
  if (!isQuoteStatus(status) || !SETTABLE_STATUSES.includes(status)) {
    return failure(
      "INVALID_STATUS",
      "Quote status is not part of the controlled vocabulary.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...quote,
      status,
      version: quote.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

export function markQuoteConverted(
  quote: Quote,
  convertedAt: Date,
): Result<Quote, QuoteDomainError> {
  if (quote.status !== "ACCEPTED") {
    return failure(
      "INVALID_TRANSITION",
      `Only an accepted quote can be converted, but status is ${quote.status}.`,
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...quote,
      status: "CONVERTED",
      convertedAt: new Date(convertedAt),
      version: quote.version + 1,
      updatedAt: new Date(convertedAt),
    }),
  };
}

function buildLine(
  rawLine: DraftQuoteLineInput,
): Result<QuoteLine, QuoteDomainError> {
  const id = rawLine.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Quote line id must be a non-empty opaque identifier.",
    );
  }

  const label = rawLine.label.trim();
  if (!label || label.length > 160) {
    return failure(
      "INVALID_LINE_LABEL",
      "Quote line label must contain between 1 and 160 characters.",
    );
  }

  if (!Number.isInteger(rawLine.quantity) || rawLine.quantity < 1) {
    return failure(
      "INVALID_LINE_QUANTITY",
      "Quote line quantity must be a positive integer.",
    );
  }

  if (!Number.isInteger(rawLine.unitPriceCents) || rawLine.unitPriceCents < 0) {
    return failure(
      "INVALID_LINE_UNIT_PRICE_CENTS",
      "Quote line unitPriceCents must be a non-negative integer.",
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

function sumLines(lines: readonly QuoteLine[]): number {
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

function parseWorldKey(rawWorldKey: string): Result<string, QuoteDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "Quote worldKey must be a non-empty world stable key.",
    );
  }
  return { ok: true, value: worldKey };
}

function parseDiscountCents(value: number): Result<number, QuoteDomainError> {
  if (!Number.isInteger(value) || value < 0) {
    return failure(
      "INVALID_DISCOUNT_CENTS",
      "Quote discountCents must be a non-negative integer.",
    );
  }
  return { ok: true, value };
}

function parseTaxRateBps(value: number): Result<number, QuoteDomainError> {
  if (!Number.isInteger(value) || value < 0 || value > 10000) {
    return failure(
      "INVALID_TAX_RATE_BPS",
      "Quote taxRateBps must be between 0 and 10000.",
    );
  }
  return { ok: true, value };
}

function parseNotes(
  value: string | null | undefined,
): Result<string | null, QuoteDomainError> {
  if (!value || !value.trim()) return { ok: true, value: null };
  const notes = value.trim();
  if (notes.length > 1200) {
    return failure(
      "INVALID_NOTES",
      "Quote notes must contain at most 1200 characters.",
    );
  }
  return { ok: true, value: notes };
}

function failure(
  code: QuoteDomainErrorCode,
  message: string,
): Result<never, QuoteDomainError> {
  return { ok: false, error: { code, message } };
}
