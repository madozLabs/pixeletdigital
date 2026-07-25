import type { LeadActivityDomainErrorCode } from "../domain/lead-activity";
import type { LeadDomainErrorCode } from "../domain/lead";
import type { LeadNoteDomainErrorCode } from "../domain/lead-note";
import type { NextActionDomainErrorCode } from "../domain/next-action";

export type LeadApplicationError =
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>
  | Readonly<{ code: "FORBIDDEN"; message: string }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode:
        | LeadDomainErrorCode
        | LeadNoteDomainErrorCode
        | NextActionDomainErrorCode
        | LeadActivityDomainErrorCode;
      message: string;
    }>
  | Readonly<{ code: "NOT_FOUND"; message: string }>
  | Readonly<{ code: "CONFLICT"; message: string }>;
