import type { ConsentRecord } from "../../domain/consent-record";
import type { Enquiry } from "../../domain/enquiry";
import type { EnquiryRepository } from "../enquiry-repository";

export class InMemoryEnquiryRepository implements EnquiryRepository {
  readonly savedEnquiries: Enquiry[] = [];
  readonly savedConsents: ConsentRecord[] = [];
  private readonly enquiriesByIdempotencyKey = new Map<string, Enquiry>();

  async findByIdempotencyKey(idempotencyKey: string): Promise<Enquiry | null> {
    return this.enquiriesByIdempotencyKey.get(idempotencyKey) ?? null;
  }

  async countRecentByEmail(
    worldKey: string,
    email: string,
    since: Date,
  ): Promise<number> {
    return this.savedEnquiries.filter(
      (enquiry) =>
        enquiry.worldKey === worldKey &&
        enquiry.email === email &&
        enquiry.submittedAt >= since,
    ).length;
  }

  async save(enquiry: Enquiry, consent: ConsentRecord): Promise<void> {
    this.savedEnquiries.push(enquiry);
    this.savedConsents.push(consent);
    this.enquiriesByIdempotencyKey.set(enquiry.idempotencyKey, enquiry);
  }
}
