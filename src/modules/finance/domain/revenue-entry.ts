export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type RevenueEntryDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_LABEL"
  | "INVALID_AMOUNT_CENTS"
  | "INVALID_NOTES"
  | "INVALID_REVENUE_DATE";

export type RevenueEntryDomainError = Readonly<{
  code: RevenueEntryDomainErrorCode;
  message: string;
}>;

export type RevenueEntry = Readonly<{
  id: string;
  worldKey: string;
  label: string;
  amountCents: number;
  revenueDate: Date;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
}>;

export function recordRevenueEntry(
  input: Readonly<{
    id: string;
    worldKey: string;
    label: string;
    amountCents: number;
    revenueDate: Date;
    notes?: string | null;
    createdById?: string | null;
    createdAt: Date;
  }>,
): Result<RevenueEntry, RevenueEntryDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "RevenueEntry id must be a non-empty opaque identifier.",
    );
  }

  const worldKey = input.worldKey.trim();
  if (!worldKey) {
    return failure(
      "INVALID_WORLD_KEY",
      "RevenueEntry worldKey must be a non-empty identifier.",
    );
  }

  const label = input.label.trim();
  if (!label || label.length > 200) {
    return failure(
      "INVALID_LABEL",
      "RevenueEntry label must contain between 1 and 200 characters.",
    );
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return failure(
      "INVALID_AMOUNT_CENTS",
      "RevenueEntry amountCents must be a positive integer.",
    );
  }

  if (Number.isNaN(new Date(input.revenueDate).getTime())) {
    return failure(
      "INVALID_REVENUE_DATE",
      "RevenueEntry date must be a valid date.",
    );
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 1200) {
    return failure(
      "INVALID_NOTES",
      "RevenueEntry notes must contain at most 1200 characters.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey,
      label,
      amountCents: input.amountCents,
      revenueDate: new Date(input.revenueDate),
      notes,
      createdById: input.createdById?.trim() || null,
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function restoreRevenueEntry(
  input: Readonly<{
    id: string;
    worldKey: string;
    label: string;
    amountCents: number;
    revenueDate: Date;
    notes: string | null;
    createdById: string | null;
    createdAt: Date;
  }>,
): Result<RevenueEntry, RevenueEntryDomainError> {
  return recordRevenueEntry(input);
}

function failure(
  code: RevenueEntryDomainErrorCode,
  message: string,
): Result<never, RevenueEntryDomainError> {
  return { ok: false, error: { code, message } };
}
