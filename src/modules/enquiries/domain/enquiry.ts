export type Result<T, E> =
  Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; error: E }>;

export const ENQUIRY_TYPES = ["GENERAL"] as const;
export type EnquiryType = (typeof ENQUIRY_TYPES)[number];

export const ENQUIRY_ABUSE_STATUSES = ["ACCEPTED", "FLAGGED"] as const;
export type EnquiryAbuseStatus = (typeof ENQUIRY_ABUSE_STATUSES)[number];

export type EnquiryDomainErrorCode =
  | "INVALID_ID"
  | "INVALID_TYPE"
  | "INVALID_WORLD_KEY"
  | "INVALID_SERVICE_ID"
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "INVALID_PHONE"
  | "INVALID_MESSAGE"
  | "INVALID_SOURCE_PAGE"
  | "INVALID_IDEMPOTENCY_KEY"
  | "INVALID_ABUSE_STATUS";

export type EnquiryDomainError = Readonly<{
  code: EnquiryDomainErrorCode;
  message: string;
}>;

export type Enquiry = Readonly<{
  id: string;
  type: EnquiryType;
  worldKey: string;
  serviceId: string | null;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  sourcePage: string;
  idempotencyKey: string;
  abuseStatus: EnquiryAbuseStatus;
  submittedAt: Date;
}>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+()\-\s.]{1,32}$/;

export function createGeneralEnquiry(
  input: Readonly<{
    id: string;
    worldKey: string;
    serviceId?: string | null;
    name: string;
    email: string;
    phone?: string | null;
    message: string;
    sourcePage: string;
    idempotencyKey: string;
    abuseStatus: string;
    submittedAt: Date;
  }>,
): Result<Enquiry, EnquiryDomainError> {
  const id = input.id.trim();
  if (!id || id.length > 128) {
    return failure(
      "INVALID_ID",
      "Enquiry id must be a non-empty opaque identifier.",
    );
  }

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return worldKeyResult;

  const serviceIdResult = parseServiceId(input.serviceId ?? null);
  if (!serviceIdResult.ok) return serviceIdResult;

  const nameResult = parseName(input.name);
  if (!nameResult.ok) return nameResult;

  const emailResult = parseEmail(input.email);
  if (!emailResult.ok) return emailResult;

  const phoneResult = parsePhone(input.phone ?? null);
  if (!phoneResult.ok) return phoneResult;

  const messageResult = parseMessage(input.message);
  if (!messageResult.ok) return messageResult;

  const sourcePageResult = parseSourcePage(input.sourcePage);
  if (!sourcePageResult.ok) return sourcePageResult;

  const idempotencyKeyResult = parseIdempotencyKey(input.idempotencyKey);
  if (!idempotencyKeyResult.ok) return idempotencyKeyResult;

  if (!isEnquiryAbuseStatus(input.abuseStatus)) {
    return failure(
      "INVALID_ABUSE_STATUS",
      "Enquiry abuse status is not part of the controlled vocabulary.",
    );
  }

  return {
    ok: true,
    value: Object.freeze({
      id,
      type: "GENERAL",
      worldKey: worldKeyResult.value,
      serviceId: serviceIdResult.value,
      name: nameResult.value,
      email: emailResult.value,
      phone: phoneResult.value,
      message: messageResult.value,
      sourcePage: sourcePageResult.value,
      idempotencyKey: idempotencyKeyResult.value,
      abuseStatus: input.abuseStatus,
      submittedAt: new Date(input.submittedAt),
    }),
  };
}

export function isEnquiryAbuseStatus(
  value: string,
): value is EnquiryAbuseStatus {
  return ENQUIRY_ABUSE_STATUSES.includes(value as EnquiryAbuseStatus);
}

function parseWorldKey(
  rawWorldKey: string,
): Result<string, EnquiryDomainError> {
  const worldKey = rawWorldKey.trim();
  if (!worldKey || worldKey.length > 64) {
    return failure(
      "INVALID_WORLD_KEY",
      "Enquiry worldKey must be a non-empty world stable key.",
    );
  }

  return { ok: true, value: worldKey };
}

function parseServiceId(
  rawServiceId: string | null,
): Result<string | null, EnquiryDomainError> {
  if (rawServiceId === null) return { ok: true, value: null };

  const serviceId = rawServiceId.trim();
  if (!serviceId || serviceId.length > 128) {
    return failure(
      "INVALID_SERVICE_ID",
      "Enquiry serviceId must be a non-empty opaque identifier when present.",
    );
  }

  return { ok: true, value: serviceId };
}

function parseName(rawName: string): Result<string, EnquiryDomainError> {
  const name = rawName.trim();
  if (!name || name.length > 160) {
    return failure(
      "INVALID_NAME",
      "Enquiry name must contain between 1 and 160 characters.",
    );
  }

  return { ok: true, value: name };
}

function parseEmail(rawEmail: string): Result<string, EnquiryDomainError> {
  const email = rawEmail.trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return failure("INVALID_EMAIL", "Enquiry email must be a valid address.");
  }

  return { ok: true, value: email };
}

function parsePhone(
  rawPhone: string | null,
): Result<string | null, EnquiryDomainError> {
  if (rawPhone === null) return { ok: true, value: null };

  const phone = rawPhone.trim();
  if (!phone) return { ok: true, value: null };

  if (!PHONE_PATTERN.test(phone)) {
    return failure(
      "INVALID_PHONE",
      "Enquiry phone must contain only digits and common separators.",
    );
  }

  return { ok: true, value: phone };
}

function parseMessage(rawMessage: string): Result<string, EnquiryDomainError> {
  const message = rawMessage.trim();
  if (!message || message.length > 4000) {
    return failure(
      "INVALID_MESSAGE",
      "Enquiry message must contain between 1 and 4000 characters.",
    );
  }

  return { ok: true, value: message };
}

function parseSourcePage(
  rawSourcePage: string,
): Result<string, EnquiryDomainError> {
  const sourcePage = rawSourcePage.trim();
  if (!sourcePage || sourcePage.length > 200) {
    return failure(
      "INVALID_SOURCE_PAGE",
      "Enquiry sourcePage must contain between 1 and 200 characters.",
    );
  }

  return { ok: true, value: sourcePage };
}

function parseIdempotencyKey(
  rawKey: string,
): Result<string, EnquiryDomainError> {
  const key = rawKey.trim();
  if (!key || key.length > 128) {
    return failure(
      "INVALID_IDEMPOTENCY_KEY",
      "Enquiry idempotencyKey must contain between 1 and 128 characters.",
    );
  }

  return { ok: true, value: key };
}

function failure(
  code: EnquiryDomainErrorCode,
  message: string,
): Result<never, EnquiryDomainError> {
  return { ok: false, error: { code, message } };
}
