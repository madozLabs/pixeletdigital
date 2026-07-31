import type { CommentDomainErrorCode } from "../domain/comment";
import type { NotificationDomainErrorCode } from "../domain/notification";

export type CollaborationApplicationError =
  | Readonly<{ code: "UNAUTHENTICATED"; message: string }>
  | Readonly<{ code: "FORBIDDEN"; message: string }>
  | Readonly<{
      code: "VALIDATION_ERROR";
      validationCode: CommentDomainErrorCode | NotificationDomainErrorCode;
      message: string;
    }>
  | Readonly<{ code: "NOT_FOUND"; message: string }>;
