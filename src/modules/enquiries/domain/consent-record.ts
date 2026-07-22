import type { Result } from "./enquiry";

export type ConsentDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_ENQUIRY_ID"
  | "INVALID_PURPOSE_KEY"
  | "INVALID_VERSION"
  | "INVALID_RESPONSE"
  | "INVALID_SOURCE";

export type ConsentDomainError = Readonly<{
  code: ConsentDomainErrorCode;
  message: string;
}>;

export type ConsentRecord = Readonly<{
  id: string;
  enquiryId: string;
  purposeKey: string;
  version: number;
  response: boolean;
  source: string;
  capturedAt: Date;
}>;

export function createConsentRecord(
  input: Readonly<{
    id: string;
    enquiryId: string;
    purposeKey: string;
    version: number;
    response: boolean;
    source: string;
    capturedAt: Date;
  }>,
): Result<ConsentRecord, ConsentDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Consent record id must be a non-empty opaque identifier.",
    );
  }

  const enquiryId = input.enquiryId.trim();
  if (!enquiryId || enquiryId.length > 128) {
    return failure(
      "INVALID_ENQUIRY_ID",
      "Consent record enquiryId must be a non-empty opaque identifier.",
    );
  }

  const purposeKey = input.purposeKey.trim();
  if (!purposeKey || purposeKey.length > 64) {
    return failure(
      "INVALID_PURPOSE_KEY",
      "Consent record purposeKey must contain between 1 and 64 characters.",
    );
  }

  if (!Number.isInteger(input.version) || input.version < 1) {
    return failure(
      "INVALID_VERSION",
      "Consent record version must be a positive integer.",
    );
  }

  if (input.response !== true) {
    return failure(
      "INVALID_RESPONSE",
      "Only an affirmative response may be recorded as consent.",
    );
  }

  const source = input.source.trim();
  if (!source || source.length > 64) {
    return failure(
      "INVALID_SOURCE",
      "Consent record source must contain between 1 and 64 characters.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      enquiryId,
      purposeKey,
      version: input.version,
      response: true,
      source,
      capturedAt: new Date(input.capturedAt),
    }),
  };
}

function failure(
  code: ConsentDomainErrorCode,
  message: string,
): Result<never, ConsentDomainError> {
  return { ok: false, error: { code, message } };
}
