export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export type ExpenseDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_WORLD_KEY"
  | "INVALID_CATEGORY_ID"
  | "INVALID_LABEL"
  | "INVALID_AMOUNT_CENTS"
  | "INVALID_NOTES"
  | "INVALID_EXPENSE_DATE";

export type ExpenseDomainError = Readonly<{
  code: ExpenseDomainErrorCode;
  message: string;
}>;

export type Expense = Readonly<{
  id: string;
  worldKey: string;
  categoryId: string;
  label: string;
  amountCents: number;
  expenseDate: Date;
  notes: string | null;
  createdById: string | null;
  createdAt: Date;
}>;

export function recordExpense(
  input: Readonly<{
    id: string;
    worldKey: string;
    categoryId: string;
    label: string;
    amountCents: number;
    expenseDate: Date;
    notes?: string | null;
    createdById?: string | null;
    createdAt: Date;
  }>,
): Result<Expense, ExpenseDomainError> {
  const id = input.id.trim();
  if (!id) {
    return failure(
      "INVALID_ID",
      "Expense id must be a non-empty opaque identifier.",
    );
  }

  const worldKey = input.worldKey.trim();
  if (!worldKey) {
    return failure(
      "INVALID_WORLD_KEY",
      "Expense worldKey must be a non-empty identifier.",
    );
  }

  const categoryId = input.categoryId.trim();
  if (!categoryId) {
    return failure(
      "INVALID_CATEGORY_ID",
      "Expense categoryId must be a non-empty identifier.",
    );
  }

  const label = input.label.trim();
  if (!label || label.length > 200) {
    return failure(
      "INVALID_LABEL",
      "Expense label must contain between 1 and 200 characters.",
    );
  }

  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    return failure(
      "INVALID_AMOUNT_CENTS",
      "Expense amountCents must be a positive integer.",
    );
  }

  if (Number.isNaN(new Date(input.expenseDate).getTime())) {
    return failure("INVALID_EXPENSE_DATE", "Expense date must be a valid date.");
  }

  const notes = input.notes?.trim() || null;
  if (notes && notes.length > 1200) {
    return failure(
      "INVALID_NOTES",
      "Expense notes must contain at most 1200 characters.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      worldKey,
      categoryId,
      label,
      amountCents: input.amountCents,
      expenseDate: new Date(input.expenseDate),
      notes,
      createdById: input.createdById?.trim() || null,
      createdAt: new Date(input.createdAt),
    }),
  };
}

export function restoreExpense(
  input: Readonly<{
    id: string;
    worldKey: string;
    categoryId: string;
    label: string;
    amountCents: number;
    expenseDate: Date;
    notes: string | null;
    createdById: string | null;
    createdAt: Date;
  }>,
): Result<Expense, ExpenseDomainError> {
  return recordExpense(input);
}

function failure(
  code: ExpenseDomainErrorCode,
  message: string,
): Result<never, ExpenseDomainError> {
  return { ok: false, error: { code, message } };
}
