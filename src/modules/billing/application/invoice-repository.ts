import type { Invoice } from "../domain/invoice";

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  listByWorld(worldKey: string): Promise<readonly Invoice[]>;
  countByWorld(worldKey: string): Promise<number>;
  /**
   * Creates a new invoice, or applies an update guarded by the version the
   * caller last read (invoice.version - 1, since every domain transition
   * increments version by exactly 1). Returns false instead of throwing
   * when an update loses that race, so callers can surface a CONFLICT
   * result instead of silently overwriting a concurrent write.
   */
  save(invoice: Invoice): Promise<boolean>;
}
