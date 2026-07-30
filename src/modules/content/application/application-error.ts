import type { PageDomainErrorCode } from "../domain/page";
import type { PageRevisionErrorCode } from "../domain/page-revision";
import type { ServiceDomainErrorCode } from "../domain/service";
import type { ServiceFamilyDomainErrorCode } from "../domain/service-family";

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
        | PageRevisionErrorCode
        | ServiceDomainErrorCode
        | ServiceFamilyDomainErrorCode;
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
