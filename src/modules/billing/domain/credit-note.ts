export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type CreditNoteDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_INVOICE_ID"
  | "INVALID_NUMBER"
  | "INVALID_REASON"
  | "INVALID_NOTES"
  | "INVALID_TAX_RATE_BPS"
  | "INVALID_LINES"
  | "INVALID_LINE_LABEL"
  | "INVALID_LINE_QUANTITY"
  | "INVALID_LINE_UNIT_PRICE_CENTS";

export type CreditNoteDomainError = Readonly<{
  code: CreditNoteDomainErrorCode;
  message: string;
}>;

export type CreditNoteLine = Readonly<{
  id: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}>;

export type CreditNote = Readonly<{
  id: string;
  worldKey: string;
  invoiceId: string;
  number: string;
  reason: string;
  notes: string | null;
  taxRateBps: number;
  subtotalCents: number;
  totalCents: number;
  lines: readonly CreditNoteLine[];
  issuedAt: Date;
  createdAt: Date;
}>;

export type DraftCreditNoteLineInput = Readonly<{
  id: string;
  label: string;
  quantity: number;
  unitPriceCents: number;
}>;

export type DraftCreditNoteInput = Readonly<{
  id: string;
  worldKey: string;
  invoiceId: string;
  number: string;
  reason: string;
  notes?: string | null;
  taxRateBps: number;
  lines: readonly DraftCreditNoteLineInput[];
  issuedAt: Date;
  createdAt: Date;
}>;

export function issueCreditNote(
  input: DraftCreditNoteInput,
): Result<CreditNote, CreditNoteDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Credit note id must be a non-empty opaque identifier.",
    );
  }

  const worldKey = input.worldKey.trim();
  if (!worldKey) {
    return failure(
      "INVALID_WORLD_KEY",
      "Credit note worldKey must be a non-empty identifier.",
    );
  }

  const invoiceId = input.invoiceId.trim();
  if (!invoiceId) {
    return failure(
      "INVALID_INVOICE_ID",
      "Credit note invoiceId must be a non-empty identifier.",
    );
  }

  const number = input.number.trim();
  if (!number || number.length > 40) {
    return failure(
      "INVALID_NUMBER",
      "Credit note number must contain between 1 and 40 characters.",
    );
  }

  const reason = input.reason.trim();
  if (!reason || reason.length < 3 || reason.length > 500) {
    return failure(
      "INVALID_REASON",
      "Le motif de l'avoir doit contenir entre 3 et 500 caractères.",
    );
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 1200) {
    return failure(
      "INVALID_NOTES",
      "Credit note notes must contain at most 1200 characters.",
    );
  }

  if (
    !Number.isInteger(input.taxRateBps) ||
    input.taxRateBps < 0 ||
    input.taxRateBps > 10000
  ) {
    return failure(
      "INVALID_TAX_RATE_BPS",
      "Credit note taxRateBps must be between 0 and 10000.",
    );
  }

  if (input.lines.length === 0) {
    return failure(
      "INVALID_LINES",
      "Credit note must contain at least one line.",
    );
  }

  const lines: CreditNoteLine[] = [];
  for (const rawLine of input.lines) {
    const lineResult = buildLine(rawLine);
    if (!lineResult.ok) return lineResult;
    lines.push(lineResult.value);
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  const totalCents =
    subtotalCents + Math.round((subtotalCents * input.taxRateBps) / 10000);

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey,
      invoiceId,
      number,
      reason,
      notes,
      taxRateBps: input.taxRateBps,
      subtotalCents,
      totalCents,
      lines: Object.freeze(lines),
      issuedAt: new Date(input.issuedAt),
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function restoreCreditNote(
  input: Readonly<{
    id: string;
    worldKey: string;
    invoiceId: string;
    number: string;
    reason: string;
    notes: string | null;
    taxRateBps: number;
    lines: readonly CreditNoteLine[];
    issuedAt: Date;
    createdAt: Date;
  }>,
): Result<CreditNote, CreditNoteDomainError> {
  if (input.lines.length === 0) {
    return failure(
      "INVALID_LINES",
      "Credit note must contain at least one line.",
    );
  }
  const subtotalCents = input.lines.reduce(
    (sum, line) => sum + line.totalCents,
    0,
  );
  const totalCents =
    subtotalCents + Math.round((subtotalCents * input.taxRateBps) / 10000);

  return {
    ok: true,
    value: Object.freeze({
      id: input.id,
      worldKey: input.worldKey,
      invoiceId: input.invoiceId,
      number: input.number,
      reason: input.reason,
      notes: input.notes,
      taxRateBps: input.taxRateBps,
      subtotalCents,
      totalCents,
      lines: Object.freeze([...input.lines]),
      issuedAt: new Date(input.issuedAt),
      createdAt: new Date(input.createdAt),
    }),
  };
}

function buildLine(
  rawLine: DraftCreditNoteLineInput,
): Result<CreditNoteLine, CreditNoteDomainError> {
  const id = rawLine.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Credit note line id must be a non-empty opaque identifier.",
    );
  }

  const label = rawLine.label.trim();
  if (!label || label.length > 160) {
    return failure(
      "INVALID_LINE_LABEL",
      "Credit note line label must contain between 1 and 160 characters.",
    );
  }

  if (!Number.isInteger(rawLine.quantity) || rawLine.quantity < 1) {
    return failure(
      "INVALID_LINE_QUANTITY",
      "Credit note line quantity must be a positive integer.",
    );
  }

  if (!Number.isInteger(rawLine.unitPriceCents) || rawLine.unitPriceCents < 0) {
    return failure(
      "INVALID_LINE_UNIT_PRICE_CENTS",
      "Credit note line unitPriceCents must be a non-negative integer.",
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

function failure(
  code: CreditNoteDomainErrorCode,
  message: string,
): Result<never, CreditNoteDomainError> {
  return { ok: false, error: { code, message } };
}
