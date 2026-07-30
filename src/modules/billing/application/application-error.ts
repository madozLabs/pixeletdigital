import type { BillingAttachmentDomainErrorCode } from "../domain/billing-attachment";
import type { CatalogueItemDomainErrorCode } from "../domain/catalogue-item";
import type { ClientContactDomainErrorCode } from "../domain/client-contact";
import type { ClientDomainErrorCode } from "../domain/client";
import type { InvoiceDomainErrorCode } from "../domain/invoice";
import type { PaymentDomainErrorCode } from "../domain/payment";
import type { QuoteDomainErrorCode } from "../domain/quote";

export type BillingApplicationError =
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>
  | Readonly<{ code: "FORBIDDEN"; message: string }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode:
        | ClientDomainErrorCode
        | ClientContactDomainErrorCode
        | CatalogueItemDomainErrorCode
        | InvoiceDomainErrorCode
        | QuoteDomainErrorCode
        | PaymentDomainErrorCode
        | BillingAttachmentDomainErrorCode;
      message: string;
    }>
  | Readonly<{ code: "NOT_FOUND"; message: string }>
  | Readonly<{ code: "CONFLICT"; message: string }>;
