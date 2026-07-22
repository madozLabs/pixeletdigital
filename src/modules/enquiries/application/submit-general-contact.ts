import { parseWorldKey } from "@/modules/worlds/domain/world";
import type { WorldRepository } from "@/modules/worlds/application/world-repository";
import type { ServiceRepository } from "@/modules/content/application/service-repository";
import type { Clock } from "@/shared/clock";

import {
  createConsentRecord,
  type ConsentDomainErrorCode,
} from "../domain/consent-record";
import {
  createGeneralEnquiry,
  type EnquiryDomainErrorCode,
  type Result,
} from "../domain/enquiry";
import type { EnquiryApplicationError } from "./application-error";
import type { EnquiryRepository } from "./enquiry-repository";

export const GENERAL_CONTACT_CONSENT_PURPOSE = "general_contact";
export const GENERAL_CONTACT_CONSENT_VERSION = 1;

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 3;

export type EnquiryDependencies = Readonly<{
  enquiries: EnquiryRepository;
  worlds: WorldRepository;
  services: ServiceRepository;
  clock: Clock;
}>;

export type SubmitGeneralContactInput = Readonly<{
  id: string;
  consentRecordId: string;
  worldKey: string;
  serviceSlug?: string | null;
  name: string;
  email: string;
  phone?: string | null;
  message: string;
  sourcePage: string;
  idempotencyKey: string;
  consentGiven: boolean;
  honeypot: string;
}>;

export type SubmitGeneralContactOutput = Readonly<{ receiptId: string }>;

export async function submitGeneralContact(
  dependencies: EnquiryDependencies,
  input: SubmitGeneralContactInput,
): Promise<Result<SubmitGeneralContactOutput, EnquiryApplicationError>> {
  const existing = await dependencies.enquiries.findByIdempotencyKey(
    input.idempotencyKey,
  );
  if (existing) return { ok: true, value: { receiptId: existing.id } };

  const worldKeyResult = parseWorldKey(input.worldKey);
  if (!worldKeyResult.ok) return notFound();

  const world = await dependencies.worlds.findByKey(worldKeyResult.value);
  if (!world || world.mode !== "ACTIVE") return notFound();

  let serviceId: string | null = null;
  if (input.serviceSlug) {
    const service = await dependencies.services.findPublishedByWorldAndSlug(
      world.key,
      input.serviceSlug,
    );
    if (!service) {
      return validationFailure(
        "INVALID_SERVICE_ID",
        "The referenced service is not currently published.",
      );
    }
    serviceId = service.id;
  }

  if (!input.consentGiven) {
    return validationFailure(
      "INVALID_RESPONSE",
      "Consent is required to submit this form.",
    );
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  const now = dependencies.clock.now();
  const since = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
  const recentCount = await dependencies.enquiries.countRecentByEmail(
    world.key,
    normalizedEmail,
    since,
  );
  if (recentCount >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: "Too many submissions from this address recently.",
      },
    };
  }

  const isSuspected = input.honeypot.trim() !== "";

  const enquiryResult = createGeneralEnquiry({
    id: input.id,
    worldKey: world.key,
    serviceId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    message: input.message,
    sourcePage: input.sourcePage,
    idempotencyKey: input.idempotencyKey,
    abuseStatus: isSuspected ? "FLAGGED" : "ACCEPTED",
    submittedAt: now,
  });
  if (!enquiryResult.ok) {
    return validationFailure(
      enquiryResult.error.code,
      enquiryResult.error.message,
    );
  }

  const consentResult = createConsentRecord({
    id: input.consentRecordId,
    enquiryId: enquiryResult.value.id,
    purposeKey: GENERAL_CONTACT_CONSENT_PURPOSE,
    version: GENERAL_CONTACT_CONSENT_VERSION,
    response: true,
    source: "contact_form",
    capturedAt: now,
  });
  if (!consentResult.ok) {
    return validationFailure(
      consentResult.error.code,
      consentResult.error.message,
    );
  }

  await dependencies.enquiries.save(enquiryResult.value, consentResult.value);
  return { ok: true, value: { receiptId: enquiryResult.value.id } };
}

function notFound(): Result<never, EnquiryApplicationError> {
  return {
    ok: false,
    error: { code: "NOT_FOUND", message: "Destination was not found." },
  };
}

function validationFailure(
  validationCode: EnquiryDomainErrorCode | ConsentDomainErrorCode,
  message: string,
): Result<never, EnquiryApplicationError> {
  return {
    ok: false,
    error: { code: "VALIDATION_ERROR", validationCode, message },
  };
}
