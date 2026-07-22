import type { PageDomainErrorCode } from "../domain/page";

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
      validationCode: PageDomainErrorCode;
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
