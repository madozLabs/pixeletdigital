import type { ExpenseCategoryDomainErrorCode } from "../domain/expense-category";
import type { ExpenseDomainErrorCode } from "../domain/expense";
import type { RevenueEntryDomainErrorCode } from "../domain/revenue-entry";

export type FinanceApplicationError =
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>
  | Readonly<{ code: "FORBIDDEN"; message: string }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode:
        | ExpenseCategoryDomainErrorCode
        | ExpenseDomainErrorCode
        | RevenueEntryDomainErrorCode;
      message: string;
    }>
  | Readonly<{ code: "NOT_FOUND"; message: string }>
  | Readonly<{ code: "CONFLICT"; message: string }>;
