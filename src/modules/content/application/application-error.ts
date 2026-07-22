import type { PageDomainErrorCode } from "../domain/page";
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
      validationCode: PageDomainErrorCode | ServiceDomainErrorCode;
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
