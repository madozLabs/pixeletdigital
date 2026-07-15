import type { WorldValidationCode } from "../domain/world";

export type WorldApplicationError =
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode: WorldValidationCode;
      message: string;
    }>
  | Readonly<{
      code: "NOT_FOUND";
      message: string;
    }>;
