import type {
  Enquiry as PrismaEnquiry,
  PrismaClient,
} from "@/generated/prisma/client";

import type { ConsentRecord } from "../domain/consent-record";
import { createGeneralEnquiry, type Enquiry } from "../domain/enquiry";
import type { EnquiryRepository } from "../application/enquiry-repository";

export class PrismaEnquiryRepository implements EnquiryRepository {
  constructor(private readonly client: PrismaClient) {}

  async findByIdempotencyKey(idempotencyKey: string): Promise<Enquiry | null> {
    const record = await this.client.enquiry.findUnique({
      where: { idempotencyKey },
    });
    return record ? toDomain(record) : null;
  }

  async countRecentByEmail(
    worldKey: string,
    email: string,
    since: Date,
  ): Promise<number> {
    return this.client.enquiry.count({
      where: { worldKey, email, submittedAt: { gte: since } },
    });
  }

  async save(enquiry: Enquiry, consent: ConsentRecord): Promise<void> {
    await this.client.$transaction([
      this.client.enquiry.create({
        data: {
          id: enquiry.id,
          type: enquiry.type,
          worldKey: enquiry.worldKey,
          serviceId: enquiry.serviceId,
          name: enquiry.name,
          email: enquiry.email,
          phone: enquiry.phone,
          message: enquiry.message,
          sourcePage: enquiry.sourcePage,
          idempotencyKey: enquiry.idempotencyKey,
          abuseStatus: enquiry.abuseStatus,
          submittedAt: enquiry.submittedAt,
        },
      }),
      this.client.consentRecord.create({
        data: {
          id: consent.id,
          enquiryId: consent.enquiryId,
          purposeKey: consent.purposeKey,
          version: consent.version,
          response: consent.response,
          source: consent.source,
          capturedAt: consent.capturedAt,
        },
      }),
    ]);
  }
}

function toDomain(record: PrismaEnquiry): Enquiry {
  const result = createGeneralEnquiry({
    id: record.id,
    worldKey: record.worldKey,
    serviceId: record.serviceId,
    name: record.name,
    email: record.email,
    phone: record.phone,
    message: record.message,
    sourcePage: record.sourcePage,
    idempotencyKey: record.idempotencyKey,
    abuseStatus: record.abuseStatus,
    submittedAt: record.submittedAt,
  });
  if (!result.ok) {
    throw new Error(`Persisted Enquiry is invalid: ${result.error.code}`);
  }

  return result.value;
}
