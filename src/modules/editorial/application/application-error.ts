import type { EditorialItemDomainErrorCode } from "../domain/editorial-item";

export type EditorialApplicationError =
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>
  | Readonly<{ code: "FORBIDDEN"; message: string }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode: EditorialItemDomainErrorCode;
      message: string;
    }>
  | Readonly<{ code: "NOT_FOUND"; message: string }>
  | Readonly<{ code: "CONFLICT"; message: string }>;
