import type { Invoice } from "../domain/invoice";

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  listByWorld(worldKey: string): Promise<readonly Invoice[]>;
  countByWorld(worldKey: string): Promise<number>;
  save(invoice: Invoice): Promise<void>;
}
