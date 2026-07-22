import type { ConsentDomainErrorCode } from "../domain/consent-record";
import type { EnquiryDomainErrorCode } from "../domain/enquiry";

export type EnquiryApplicationError =
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode: EnquiryDomainErrorCode | ConsentDomainErrorCode;
      message: string;
    }>
  | Readonly<{
      code: "NOT_FOUND";
      message: string;
    }>
  | Readonly<{
      code: "RATE_LIMITED";
      message: string;
    }>
  | Readonly<{
      code: "UNAUTHENTICATED";
      message: string;
    }>
  | Readonly<{
      code: "FORBIDDEN";
      message: string;
    }>;
