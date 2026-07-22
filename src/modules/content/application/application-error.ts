import type { PageDomainErrorCode } from "../domain/page";
import type { PageSectionDomainErrorCode } from "../domain/page-section";
import type { ServiceDomainErrorCode } from "../domain/service";

export type ContentApplicationError =
  | Readonly<{
      code: "UNAUTHENTICATED";
      message: string;
    }>
  | Readonly<{
      code: "FORBIDDEN";
      message: string;
    }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode:
        | PageDomainErrorCode
        | ServiceDomainErrorCode
        | PageSectionDomainErrorCode;
      message: string;
    }>
  | Readonly<{
      code: "NOT_FOUND";
      message: string;
    }>
  | Readonly<{
      code: "CONFLICT";
      message: string;
    }>;
