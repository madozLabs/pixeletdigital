import type { ConsentRecord } from "../domain/consent-record";
import type { Enquiry } from "../domain/enquiry";

export interface EnquiryRepository {
  findByIdempotencyKey(idempotencyKey: string): Promise<Enquiry | null>;
  countRecentByEmail(
    worldKey: string,
    email: string,
    since: Date,
  ): Promise<number>;
  listByWorld(worldKey: string): Promise<readonly Enquiry[]>;
  save(enquiry: Enquiry, consent: ConsentRecord): Promise<void>;
}
