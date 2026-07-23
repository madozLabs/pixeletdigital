import type { CatalogueItemDomainErrorCode } from "../domain/catalogue-item";
import type { ClientDomainErrorCode } from "../domain/client";
import type { InvoiceDomainErrorCode } from "../domain/invoice";

export type BillingApplicationError =
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>
  | Readonly<{ code: "FORBIDDEN"; message: string }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode:
        | ClientDomainErrorCode
        | CatalogueItemDomainErrorCode
        | InvoiceDomainErrorCode;
      message: string;
    }>
  | Readonly<{ code: "NOT_FOUND"; message: string }>
  | Readonly<{ code: "CONFLICT"; message: string }>;
