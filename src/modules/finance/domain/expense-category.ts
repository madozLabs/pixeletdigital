export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const EXPENSE_CATEGORY_STATUSES = ["ACTIVE", "ARCHIVED"] as const;
export type ExpenseCategoryStatus = (typeof EXPENSE_CATEGORY_STATUSES)[number];

export type ExpenseCategoryDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_LABEL"
  | "INVALID_STATUS"
  | "INVALID_VERSION"
  | "INVALID_TRANSITION";

export type ExpenseCategoryDomainError = Readonly<{
  code: ExpenseCategoryDomainErrorCode;
  message: string;
}>;

export type ExpenseCategory = Readonly<{
  id: string;
  label: string;
  status: ExpenseCategoryStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}>;

export function isExpenseCategoryStatus(
  value: string,
): value is ExpenseCategoryStatus {
  return EXPENSE_CATEGORY_STATUSES.includes(value as ExpenseCategoryStatus);
}

export function createExpenseCategory(
  input: Readonly<{
    id: string;
    label: string;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<ExpenseCategory, ExpenseCategoryDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "ExpenseCategory id must be a non-empty opaque identifier.",
    );
  }

  const labelResult = parseLabel(input.label);
  if (!labelResult.ok) return labelResult;

  return {
    ok: true,
    value: Object.freeze({
      id,
      label: labelResult.value,
      status: "ACTIVE",
      version: 1,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function restoreExpenseCategory(
  input: Readonly<{
    id: string;
    label: string;
    status: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }>,
): Result<ExpenseCategory, ExpenseCategoryDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "ExpenseCategory id must be a non-empty opaque identifier.",
    );
  }

  const labelResult = parseLabel(input.label);
  if (!labelResult.ok) return labelResult;

  if (!isExpenseCategoryStatus(input.status)) {
    return failure(
      "INVALID_STATUS",
      "ExpenseCategory status is not part of the controlled vocabulary.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "ExpenseCategory version must be a positive integer.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      label: labelResult.value,
      status: input.status,
      version: input.version,
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    }),
  };
}

export function archiveExpenseCategory(
  category: ExpenseCategory,
  updatedAt: Date,
): Result<ExpenseCategory, ExpenseCategoryDomainError> {
  if (category.status === "ARCHIVED") {
    return failure(
      "INVALID_TRANSITION",
      "ExpenseCategory is already archived.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      ...category,
      status: "ARCHIVED",
      version: category.version + 1,
      updatedAt: new Date(updatedAt),
    }),
  };
}

function parseLabel(
  rawLabel: string,
): Result<string, ExpenseCategoryDomainError> {
  const label = rawLabel.trim();
  if (!label || label.length > 80) {
    return failure(
      "INVALID_LABEL",
      "ExpenseCategory label must contain between 1 and 80 characters.",
    );
  }
  return { ok: true, value: label };
}

function failure(
  code: ExpenseCategoryDomainErrorCode,
  message: string,
): Result<never, ExpenseCategoryDomainError> {
  return { ok: false, error: { code, message } };
}
