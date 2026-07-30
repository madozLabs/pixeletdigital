import type { Quote } from "../domain/quote";

export interface QuoteRepository {
  findById(id: string): Promise<Quote | null>;
  listByWorld(worldKey: string): Promise<readonly Quote[]>;
  countByWorld(worldKey: string): Promise<number>;
  hasInvoice(quoteId: string): Promise<boolean>;
  // Returns false when a concurrent write already moved the row past the
  // version this quote was read at (optimistic-lock conflict), true
  // otherwise -- mirrors InvoiceRepository.save.
  save(quote: Quote): Promise<boolean>;
}
